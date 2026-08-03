import { downsample } from './bitmap'
import { type Bitmap, INK_THRESHOLD } from './types'

/**
 * Skew estimation by projection-profile sharpness.
 *
 * When staff lines are horizontal, projecting ink onto the vertical axis gives
 * five tall spikes per staff. Tilt the page and those spikes smear out. So the
 * skew is the angle whose projection is most sharply peaked, measured as the sum
 * of squared bin counts.
 *
 * The projection is computed by binning rotated coordinates directly rather than
 * rotating the image for each candidate angle — one rotation at the end instead
 * of forty. The angle also doesn't need pixel detail, so the search runs on a
 * downsampled copy over a precomputed list of ink coordinates.
 *
 * Returns degrees `φ` such that `rotate(bitmap, -φ)` straightens the page,
 * matching the sign convention of `rotate`'s forward map.
 */

export interface DeskewOptions {
  /** Widest skew considered, in degrees. */
  maxDeg?: number
  /** Step of the first pass. */
  coarseStepDeg?: number
  /** Step of the refinement pass around the coarse winner. */
  fineStepDeg?: number
  /** Target long edge for the search copy. */
  searchLongEdge?: number
}

const DEFAULTS: Required<DeskewOptions> = {
  maxDeg: 6,
  coarseStepDeg: 1,
  fineStepDeg: 0.1,
  searchLongEdge: 700,
}

interface InkPoints {
  xs: Float64Array
  ys: Float64Array
  count: number
  width: number
  height: number
}

function collectInk(bmp: Bitmap): InkPoints {
  const { width, height, data } = bmp
  let count = 0
  for (let i = 0; i < data.length; i++) if (data[i] < INK_THRESHOLD) count++

  const xs = new Float64Array(count)
  const ys = new Float64Array(count)
  let k = 0
  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x < width; x++) {
      if (data[row + x] < INK_THRESHOLD) {
        xs[k] = x
        ys[k] = y
        k++
      }
    }
  }
  return { xs, ys, count, width, height }
}

/**
 * Sum of squared bin counts for the projection that a rotation of `-deg` would
 * make horizontal. Higher means more sharply peaked, so better aligned.
 */
function projectionSharpness(points: InkPoints, deg: number): number {
  const radians = (deg * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const cx = (points.width - 1) / 2
  const cy = (points.height - 1) / 2

  // Bin range has to cover the corners once rotated.
  const pad = Math.ceil(Math.abs(sin) * points.width) + 2
  const size = points.height + 2 * pad
  const bins = new Int32Array(size)

  for (let i = 0; i < points.count; i++) {
    const dx = points.xs[i] - cx
    const dy = points.ys[i] - cy
    // Forward map of `rotate(bmp, -deg)`; see the note in bitmap.ts.
    const yDest = -dx * sin + dy * cos + cy
    const bin = (yDest + pad) | 0
    if (bin >= 0 && bin < size) bins[bin]++
  }

  let score = 0
  for (let i = 0; i < size; i++) score += bins[i] * bins[i]
  return score
}

export function estimateSkew(binary: Bitmap, options: DeskewOptions = {}): number {
  const opts = { ...DEFAULTS, ...options }

  const factor = Math.max(1, Math.floor(Math.max(binary.width, binary.height) / opts.searchLongEdge))
  const small = factor > 1 ? downsample(binary, factor) : binary
  const points = collectInk(small)
  // Nothing to align.
  if (points.count < 50) return 0

  let best = 0
  let bestScore = -Infinity
  for (let deg = -opts.maxDeg; deg <= opts.maxDeg + 1e-9; deg += opts.coarseStepDeg) {
    const score = projectionSharpness(points, deg)
    if (score > bestScore) {
      bestScore = score
      best = deg
    }
  }

  const from = best - opts.coarseStepDeg
  const to = best + opts.coarseStepDeg
  for (let deg = from; deg <= to + 1e-9; deg += opts.fineStepDeg) {
    const score = projectionSharpness(points, deg)
    if (score > bestScore) {
      bestScore = score
      best = deg
    }
  }

  // Keep the reported value clean; sub-0.05° is not meaningful and rotating for
  // it only costs an interpolation pass.
  return Math.abs(best) < 0.05 ? 0 : Math.round(best * 100) / 100
}
