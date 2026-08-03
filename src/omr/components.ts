import { type Bitmap, type Box, INK_THRESHOLD } from './types'

/**
 * Connected-component labelling, 8-connected, by union-find over two passes.
 *
 * Used twice with opposite polarity: over ink to find symbols, and over paper to
 * find the enclosed holes that give away a hollow notehead. Hence the `target`
 * option rather than two near-identical functions.
 */

export interface Component {
  label: number
  bbox: Box
  /** Pixel count, which is not the same as the bounding-box area. */
  area: number
  centroidX: number
  centroidY: number
  /** True when the component touches the image border — used to reject the
   *  page background when labelling paper. */
  touchesBorder: boolean
}

export interface LabelResult {
  /** One label per pixel; 0 means "not part of any component". */
  labels: Int32Array
  components: Component[]
  width: number
  height: number
}

export interface LabelOptions {
  target?: 'ink' | 'paper'
  /** Discard components smaller than this many pixels. */
  minArea?: number
}

export function labelComponents(bmp: Bitmap, options: LabelOptions = {}): LabelResult {
  const target = options.target ?? 'ink'
  const minArea = options.minArea ?? 1
  const { width, height, data } = bmp
  const wantInk = target === 'ink'

  const labels = new Int32Array(width * height)
  // Provisional labels grow as we scan; parent[] is the union-find forest.
  const parent: number[] = [0]

  const find = (a: number): number => {
    let root = a
    while (parent[root] !== root) root = parent[root]
    // Path compression keeps the second pass linear in practice.
    let walk = a
    while (parent[walk] !== root) {
      const next = parent[walk]
      parent[walk] = root
      walk = next
    }
    return root
  }

  const union = (a: number, b: number) => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) parent[Math.max(rootA, rootB)] = Math.min(rootA, rootB)
  }

  const matches = (index: number) => (data[index] < INK_THRESHOLD) === wantInk

  // First pass: provisional labels, recording equivalences from the four
  // already-visited neighbours (W, NW, N, NE).
  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x < width; x++) {
      const index = row + x
      if (!matches(index)) continue

      let best = 0
      const consider = (nx: number, ny: number) => {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) return
        const neighbour = labels[ny * width + nx]
        if (neighbour === 0) return
        if (best === 0) best = neighbour
        else union(best, neighbour)
      }

      consider(x - 1, y)
      consider(x - 1, y - 1)
      consider(x, y - 1)
      consider(x + 1, y - 1)

      if (best === 0) {
        best = parent.length
        parent.push(best)
      }
      labels[index] = best
    }
  }

  // Second pass: resolve to roots and accumulate statistics in one sweep.
  const stats = new Map<number, {
    area: number
    minX: number
    minY: number
    maxX: number
    maxY: number
    sumX: number
    sumY: number
    border: boolean
  }>()

  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x < width; x++) {
      const index = row + x
      const provisional = labels[index]
      if (provisional === 0) continue
      const root = find(provisional)
      labels[index] = root

      let entry = stats.get(root)
      if (!entry) {
        entry = {
          area: 0,
          minX: x,
          minY: y,
          maxX: x,
          maxY: y,
          sumX: 0,
          sumY: 0,
          border: false,
        }
        stats.set(root, entry)
      }
      entry.area++
      if (x < entry.minX) entry.minX = x
      if (x > entry.maxX) entry.maxX = x
      if (y < entry.minY) entry.minY = y
      if (y > entry.maxY) entry.maxY = y
      entry.sumX += x
      entry.sumY += y
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) entry.border = true
    }
  }

  const components: Component[] = []
  for (const [label, entry] of stats) {
    if (entry.area < minArea) continue
    components.push({
      label,
      area: entry.area,
      bbox: {
        x: entry.minX,
        y: entry.minY,
        width: entry.maxX - entry.minX + 1,
        height: entry.maxY - entry.minY + 1,
      },
      centroidX: entry.sumX / entry.area,
      centroidY: entry.sumY / entry.area,
      touchesBorder: entry.border,
    })
  }

  // Reading order, so downstream results are deterministic.
  components.sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x)
  return { labels, components, width, height }
}
