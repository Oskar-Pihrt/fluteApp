import { createBitmap } from './bitmap'
import { type Bitmap, INK, PAPER } from './types'

/**
 * Sauvola adaptive thresholding, with a global fallback in flat regions.
 *
 * A single global threshold is adequate for a clean flatbed scan but fails the
 * moment there is any brightness gradient — a PDF screenshot with a drop shadow,
 * or a page photographed near a window. Sauvola compares each pixel to the mean
 * and standard deviation of its neighbourhood instead:
 *
 *     t(x,y) = mean * (1 + k * (stddev / R - 1))
 *
 * With integral images both statistics are O(1) per pixel, so the whole pass is
 * linear and costs little more than the global version it replaces.
 *
 * **The flat-region fallback is not optional.** Deep inside a large solid symbol
 * — a filled notehead is the obvious one — the whole neighbourhood is ink, so
 * the local mean is dark and the local rule classifies the blob's own interior as
 * background. The result is that every filled notehead comes out hollow, which
 * silently destroys notehead detection downstream. Where the neighbourhood is
 * near-uniform there is no local contrast to reason from, so we defer to a global
 * Otsu threshold, which gets both blob interiors and blank paper right.
 */

const K = 0.2
/** Dynamic range of the standard deviation. 128 for 8-bit input. */
const R = 128
/**
 * Below this neighbourhood standard deviation, the region is treated as flat and
 * decided globally. Comfortably above sensor/JPEG noise, far below any real edge.
 */
const FLAT_STDDEV = 15

export interface BinariseOptions {
  /** Neighbourhood side length in pixels. Forced odd. Defaults to ~1/12 of the short edge. */
  window?: number
  k?: number
}

/**
 * Ink coverage below this fraction means we probably thresholded noise on a
 * blank page rather than finding real content.
 */
export const LOW_CONTRAST_INK_FRACTION = 0.0015

export interface BinariseResult {
  bitmap: Bitmap
  /** Fraction of pixels that came out as ink — a cheap sanity signal. */
  inkFraction: number
  /** The global threshold used in flat regions, exposed for diagnostics. */
  globalThreshold: number
}

/** Otsu's method: the threshold maximising between-class variance. */
export function otsuThreshold(gray: Bitmap): number {
  const histogram = new Int32Array(256)
  for (const v of gray.data) histogram[v]++

  const total = gray.data.length
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * histogram[i]

  let weightBelow = 0
  let sumBelow = 0
  let best = 128
  let bestVariance = -1

  for (let t = 0; t < 256; t++) {
    weightBelow += histogram[t]
    if (weightBelow === 0) continue
    const weightAbove = total - weightBelow
    if (weightAbove === 0) break

    sumBelow += t * histogram[t]
    const meanBelow = sumBelow / weightBelow
    const meanAbove = (sum - sumBelow) / weightAbove
    const delta = meanBelow - meanAbove
    const variance = weightBelow * weightAbove * delta * delta

    if (variance > bestVariance) {
      bestVariance = variance
      best = t
    }
  }
  return best
}

export function binarise(gray: Bitmap, options: BinariseOptions = {}): BinariseResult {
  const { width, height, data } = gray
  const k = options.k ?? K
  const globalThreshold = otsuThreshold(gray)

  // A generous window: it must comfortably exceed the largest solid symbol, or
  // the flat-region fallback ends up carrying the whole notehead interior.
  let window = options.window ?? Math.round(Math.min(width, height) / 12)
  window = Math.max(15, window)
  if (window % 2 === 0) window += 1
  const radius = (window - 1) >> 1

  // Integral images of value and value², one row of padding so the four-corner
  // lookup needs no bounds checks. Float64 because the squared sums of a
  // multi-megapixel page overflow a Uint32 comfortably.
  const stride = width + 1
  const sum = new Float64Array(stride * (height + 1))
  const sumSq = new Float64Array(stride * (height + 1))

  for (let y = 0; y < height; y++) {
    let rowSum = 0
    let rowSumSq = 0
    const src = y * width
    const cur = (y + 1) * stride
    const prev = y * stride
    for (let x = 0; x < width; x++) {
      const v = data[src + x]
      rowSum += v
      rowSumSq += v * v
      sum[cur + x + 1] = sum[prev + x + 1] + rowSum
      sumSq[cur + x + 1] = sumSq[prev + x + 1] + rowSumSq
    }
  }

  const out = createBitmap(width, height, PAPER)
  let inkCount = 0

  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - radius)
    const y1 = Math.min(height - 1, y + radius)
    const top = y0 * stride
    const bottom = (y1 + 1) * stride
    const srcRow = y * width

    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - radius)
      const x1 = Math.min(width - 1, x + radius)
      const area = (y1 - y0 + 1) * (x1 - x0 + 1)

      const total = sum[bottom + x1 + 1] - sum[bottom + x0] - sum[top + x1 + 1] + sum[top + x0]
      const totalSq =
        sumSq[bottom + x1 + 1] - sumSq[bottom + x0] - sumSq[top + x1 + 1] + sumSq[top + x0]

      const mean = total / area
      // Clamped because floating-point cancellation can push this just below zero.
      const variance = Math.max(0, totalSq / area - mean * mean)
      const stddev = Math.sqrt(variance)

      const threshold =
        stddev < FLAT_STDDEV ? globalThreshold : mean * (1 + k * (stddev / R - 1))

      if (data[srcRow + x] < threshold) {
        out.data[srcRow + x] = INK
        inkCount++
      }
    }
  }

  return { bitmap: out, inkFraction: inkCount / (width * height), globalThreshold }
}
