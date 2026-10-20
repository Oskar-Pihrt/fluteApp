import { type Net, runNet, type Tensor } from './net'
import type { Bitmap, Staff } from './types'

/**
 * Symbol detection with the trained network.
 *
 * The page is resampled so a staff space is the network's training size (10
 * px), then run in overlapping tiles along the staves only — margins, titles
 * and the gaps between systems hold nothing worth reading, and skipping them
 * roughly halves the work on a typical page. Each class's heatmap is reduced to
 * its local maxima above a threshold, refined by the predicted sub-cell offset.
 */

export interface Detection {
  /** Class name from the manifest, e.g. 'head_filled', 'sharp'. */
  cls: string
  /** Position in the resampled page's pixels. */
  x: number
  y: number
  score: number
  /**
   * Noteheads, with a version-2 network: each duration's probability, most
   * likely first — the runner-up is what a measure that doesn't add up tries.
   */
  durations?: { name: string; p: number }[]
  /** Noteheads and rests: the number of augmentation dots. */
  dots?: number
}

/** Softmax over the channels of one cell. */
function cellProbabilities(tensor: Tensor, gx: number, gy: number): number[] {
  const plane = tensor.h * tensor.w
  const logits = Array.from({ length: tensor.c }, (_, c) => tensor.data[c * plane + gy * tensor.w + gx])
  const top = Math.max(...logits)
  const exps = logits.map((l) => Math.exp(l - top))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map((e) => e / sum)
}

const HEAD_CLASSES = new Set(['head_filled', 'head_hollow'])

/** Per-class score a peak must reach. Noteheads are the precision that matters. */
const DEFAULT_THRESHOLD = 0.35
const THRESHOLDS: Record<string, number> = {
  head_filled: 0.35,
  head_hollow: 0.35,
  head_grace: 0.4,
  tied_head: 0.4,
  ottava_start: 0.4,
  ottava_end: 0.4,
}

/** Tile geometry in resampled pixels: a core, plus context on every side. */
const TILE_CORE = 640
const TILE_MARGIN = 48

/**
 * Resample a grayscale bitmap by an arbitrary factor: box-averaged when
 * shrinking (so one-pixel staff lines survive), bilinear when enlarging.
 */
export function resampleGray(src: Bitmap, factor: number): Bitmap {
  const width = Math.max(1, Math.round(src.width * factor))
  const height = Math.max(1, Math.round(src.height * factor))
  const out = new Uint8Array(width * height)
  if (factor < 1) {
    const inv = 1 / factor
    for (let y = 0; y < height; y++) {
      const y0 = y * inv
      const y1 = Math.min(src.height, y0 + inv)
      for (let x = 0; x < width; x++) {
        const x0 = x * inv
        const x1 = Math.min(src.width, x0 + inv)
        let sum = 0
        let area = 0
        for (let yy = Math.floor(y0); yy < y1; yy++) {
          const wy = Math.min(yy + 1, y1) - Math.max(yy, y0)
          const row = yy * src.width
          for (let xx = Math.floor(x0); xx < x1; xx++) {
            const w = wy * (Math.min(xx + 1, x1) - Math.max(xx, x0))
            sum += src.data[row + xx] * w
            area += w
          }
        }
        out[y * width + x] = area ? Math.round(sum / area) : 255
      }
    }
  } else {
    for (let y = 0; y < height; y++) {
      const sy = Math.min(src.height - 1, Math.max(0, (y + 0.5) / factor - 0.5))
      const y0 = Math.floor(sy)
      const y1 = Math.min(src.height - 1, y0 + 1)
      const fy = sy - y0
      for (let x = 0; x < width; x++) {
        const sx = Math.min(src.width - 1, Math.max(0, (x + 0.5) / factor - 0.5))
        const x0 = Math.floor(sx)
        const x1 = Math.min(src.width - 1, x0 + 1)
        const fx = sx - x0
        const top = src.data[y0 * src.width + x0] * (1 - fx) + src.data[y0 * src.width + x1] * fx
        const bottom = src.data[y1 * src.width + x0] * (1 - fx) + src.data[y1 * src.width + x1] * fx
        out[y * width + x] = Math.round(top * (1 - fy) + bottom * fy)
      }
    }
  }
  return { data: out, width, height }
}

/** Vertical bands, in page rows, that hold staves and their ledger-line reach. */
function staffBands(staves: Staff[], height: number): [number, number][] {
  const bands: [number, number][] = []
  for (const staff of staves) {
    const reach = staff.spaceHeight * 6
    const top = Math.max(0, Math.floor(staff.lines[0] - reach))
    const bottom = Math.min(height, Math.ceil(staff.lines[4] + reach))
    const last = bands[bands.length - 1]
    if (last && top <= last[1]) last[1] = Math.max(last[1], bottom)
    else bands.push([top, bottom])
  }
  return bands
}

export interface DetectOptions {
  /** Restrict inference to these staves' bands. Whole page when absent. */
  staves?: Staff[]
  onTile?: (done: number, total: number) => void
}

export function detectSymbols(net: Net, page: Bitmap, options: DetectOptions = {}): Detection[] {
  const { classes, stride, inputMultiple } = net.manifest
  const bands = options.staves?.length ? staffBands(options.staves, page.height) : [[0, page.height] as [number, number]]

  const tiles: { x: number; y: number; w: number; h: number }[] = []
  for (const [top, bottom] of bands) {
    for (let y = top; y < bottom; y += TILE_CORE) {
      for (let x = 0; x < page.width; x += TILE_CORE) {
        tiles.push({ x, y, w: Math.min(TILE_CORE, page.width - x), h: Math.min(TILE_CORE, bottom - y) })
      }
    }
  }

  const detections: Detection[] = []
  tiles.forEach((tile, index) => {
    // Input window: the core plus margin, rounded up to the network's multiple.
    const x0 = tile.x - TILE_MARGIN
    const y0 = tile.y - TILE_MARGIN
    const w = Math.ceil((tile.w + TILE_MARGIN * 2) / inputMultiple) * inputMultiple
    const h = Math.ceil((tile.h + TILE_MARGIN * 2) / inputMultiple) * inputMultiple
    const input: Tensor = { c: 1, h, w, data: new Float32Array(w * h) }
    for (let yy = 0; yy < h; yy++) {
      const py = y0 + yy
      if (py < 0 || py >= page.height) continue
      for (let xx = 0; xx < w; xx++) {
        const px = x0 + xx
        if (px < 0 || px >= page.width) continue
        // Ink is 1, paper 0 — as in training.
        input.data[yy * w + xx] = 1 - page.data[py * page.width + px] / 255
      }
    }

    const { heat, offset, dur, dots } = runNet(net, input)
    const durationNames = net.manifest.durations ?? []
    const plane = heat.h * heat.w
    for (let c = 0; c < classes.length; c++) {
      const threshold = THRESHOLDS[classes[c]] ?? DEFAULT_THRESHOLD
      const logit = Math.log(threshold / (1 - threshold))
      const base = c * plane
      for (let gy = 0; gy < heat.h; gy++) {
        for (let gx = 0; gx < heat.w; gx++) {
          const v = heat.data[base + gy * heat.w + gx]
          if (v < logit) continue
          // 3×3 local maximum.
          let isPeak = true
          for (let dy = -1; dy <= 1 && isPeak; dy++) {
            const yy = gy + dy
            if (yy < 0 || yy >= heat.h) continue
            for (let dx = -1; dx <= 1; dx++) {
              const xx = gx + dx
              if (xx < 0 || xx >= heat.w || (dx === 0 && dy === 0)) continue
              if (heat.data[base + yy * heat.w + xx] > v) {
                isPeak = false
                break
              }
            }
          }
          if (!isPeak) continue
          const x = x0 + (gx + offset.data[gy * heat.w + gx]) * stride
          const y = y0 + (gy + offset.data[plane + gy * heat.w + gx]) * stride
          // Keep only peaks in this tile's core; the margin belongs to a neighbour.
          if (x < tile.x || x >= tile.x + tile.w || y < tile.y || y >= tile.y + tile.h) continue
          const detection: Detection = { cls: classes[c], x, y, score: 1 / (1 + Math.exp(-v)) }
          const isHead = HEAD_CLASSES.has(classes[c])
          if (dur && isHead) {
            detection.durations = cellProbabilities(dur, gx, gy)
              .map((p, i) => ({ name: durationNames[i], p }))
              .sort((a, b) => b.p - a.p)
          }
          if (dots && (isHead || classes[c].startsWith('rest_'))) {
            const p = cellProbabilities(dots, gx, gy)
            detection.dots = p.indexOf(Math.max(...p))
          }
          detections.push(detection)
        }
      }
    }
    options.onTile?.(index + 1, tiles.length)
  })
  return detections
}
