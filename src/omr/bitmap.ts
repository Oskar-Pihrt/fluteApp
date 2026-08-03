import { type Bitmap, INK_THRESHOLD, PAPER } from './types'

/**
 * Bitmap primitives. Deliberately hand-rolled and allocation-light: these run
 * over several million pixels on a phone, so the inner loops index typed arrays
 * directly and nothing allocates per pixel.
 */

export function createBitmap(width: number, height: number, fill = PAPER): Bitmap {
  const data = new Uint8Array(width * height)
  if (fill !== 0) data.fill(fill)
  return { data, width, height }
}

export function cloneBitmap(bmp: Bitmap): Bitmap {
  return { data: new Uint8Array(bmp.data), width: bmp.width, height: bmp.height }
}

/**
 * Bounds-checked read. Out of bounds reads as paper, which suits every caller.
 *
 * Coordinates are rounded first, and that matters: indexing a typed array with a
 * fractional index yields `undefined` rather than throwing, so an unrounded
 * float here reads as "not ink" and silently makes real symbols disappear.
 * Callers routinely pass computed staff positions, which are fractional.
 */
export function getPixel(bmp: Bitmap, x: number, y: number): number {
  const xi = Math.round(x)
  const yi = Math.round(y)
  if (xi < 0 || yi < 0 || xi >= bmp.width || yi >= bmp.height) return PAPER
  return bmp.data[yi * bmp.width + xi]
}

export function isInk(bmp: Bitmap, x: number, y: number): boolean {
  return getPixel(bmp, x, y) < INK_THRESHOLD
}

/**
 * RGBA → grayscale using Rec. 601 luma. Sheet music is black on white, so the
 * exact luma weights matter far less than being consistent.
 */
export function grayscaleFromRgba(rgba: Uint8ClampedArray | Uint8Array, width: number, height: number): Bitmap {
  const data = new Uint8Array(width * height)
  for (let i = 0, p = 0; i < data.length; i++, p += 4) {
    data[i] = (rgba[p] * 77 + rgba[p + 1] * 150 + rgba[p + 2] * 29) >> 8
  }
  return { data, width, height }
}

/** Grayscale → RGBA, for painting an intermediate stage into a canvas. */
export function grayscaleToRgba(bmp: Bitmap): Uint8ClampedArray {
  const out = new Uint8ClampedArray(bmp.width * bmp.height * 4)
  for (let i = 0, p = 0; i < bmp.data.length; i++, p += 4) {
    const v = bmp.data[i]
    out[p] = v
    out[p + 1] = v
    out[p + 2] = v
    out[p + 3] = 255
  }
  return out
}

/**
 * Box-filtered downsample by an integer factor. Averaging rather than sampling
 * matters here: staff lines are only a few pixels thick, and nearest-neighbour
 * sampling drops them entirely at 1/4 scale.
 */
export function downsample(bmp: Bitmap, factor: number): Bitmap {
  if (factor <= 1) return cloneBitmap(bmp)
  const width = Math.max(1, Math.floor(bmp.width / factor))
  const height = Math.max(1, Math.floor(bmp.height / factor))
  const out = createBitmap(width, height, 0)

  for (let y = 0; y < height; y++) {
    const sy = y * factor
    for (let x = 0; x < width; x++) {
      const sx = x * factor
      let sum = 0
      let count = 0
      for (let dy = 0; dy < factor; dy++) {
        const yy = sy + dy
        if (yy >= bmp.height) break
        const row = yy * bmp.width
        for (let dx = 0; dx < factor; dx++) {
          const xx = sx + dx
          if (xx >= bmp.width) break
          sum += bmp.data[row + xx]
          count++
        }
      }
      out.data[y * width + x] = count ? Math.round(sum / count) : PAPER
    }
  }
  return out
}

/**
 * Nearest-neighbour upscale by an integer factor.
 *
 * Used when a page arrives at screen resolution: a full page of eleven systems
 * can land at a staff spacing of six or seven pixels, which is plenty to locate
 * the staves but far too few for an erosion element — at that size the element
 * rounds to two pixels and stops discriminating noteheads from stems. Upscaling
 * adds no information, it just gives the morphology room to work.
 *
 * Nearest-neighbour rather than bilinear on purpose: the input is strictly
 * two-valued at this point, and interpolation would produce greys that every
 * downstream stage would then have to re-threshold.
 */
export function upsample(bmp: Bitmap, factor: number): Bitmap {
  if (factor <= 1) return cloneBitmap(bmp)
  const width = bmp.width * factor
  const height = bmp.height * factor
  const out = createBitmap(width, height, 0)

  for (let y = 0; y < height; y++) {
    const srcRow = Math.floor(y / factor) * bmp.width
    const dstRow = y * width
    for (let x = 0; x < width; x++) {
      out.data[dstRow + x] = bmp.data[srcRow + Math.floor(x / factor)]
    }
  }
  return out
}

/**
 * Rotate about the centre by `degrees`, sampling bilinearly and filling
 * uncovered corners with paper. Output keeps the input's dimensions — the page
 * is mostly margin, and a skew correction is only a degree or two.
 */
export function rotate(bmp: Bitmap, degrees: number): Bitmap {
  if (Math.abs(degrees) < 1e-4) return cloneBitmap(bmp)

  const { width, height } = bmp
  const out = createBitmap(width, height, PAPER)
  const radians = (degrees * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const cx = (width - 1) / 2
  const cy = (height - 1) / 2

  for (let y = 0; y < height; y++) {
    const dy = y - cy
    for (let x = 0; x < width; x++) {
      const dx = x - cx
      // Inverse map: where does this destination pixel come from?
      const sx = cx + dx * cos + dy * sin
      const sy = cy - dx * sin + dy * cos

      const x0 = Math.floor(sx)
      const y0 = Math.floor(sy)
      if (x0 < -1 || y0 < -1 || x0 > width - 1 || y0 > height - 1) continue

      const fx = sx - x0
      const fy = sy - y0
      const p00 = getPixel(bmp, x0, y0)
      const p10 = getPixel(bmp, x0 + 1, y0)
      const p01 = getPixel(bmp, x0, y0 + 1)
      const p11 = getPixel(bmp, x0 + 1, y0 + 1)

      const top = p00 + (p10 - p00) * fx
      const bottom = p01 + (p11 - p01) * fx
      out.data[y * width + x] = Math.round(top + (bottom - top) * fy)
    }
  }
  return out
}

/**
 * Map a point from the deskewed bitmap back to original-image coordinates.
 *
 * The recogniser measures everything on a rotated, possibly downsampled copy,
 * but the overlay is drawn over the untouched image the user is looking at — so
 * every reported box has to come back through here.
 */
export function toOriginalCoords(
  x: number,
  y: number,
  analysed: { width: number; height: number },
  skewDeg: number,
  scaleToOriginal: number,
): { x: number; y: number } {
  const radians = (-skewDeg * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const cx = (analysed.width - 1) / 2
  const cy = (analysed.height - 1) / 2
  const dx = x - cx
  const dy = y - cy
  return {
    x: (cx + dx * cos + dy * sin) * scaleToOriginal,
    y: (cy - dx * sin + dy * cos) * scaleToOriginal,
  }
}

/** Count of ink pixels per row — the basis of staff-line detection. */
export function rowInkProfile(bmp: Bitmap): Int32Array {
  const profile = new Int32Array(bmp.height)
  for (let y = 0; y < bmp.height; y++) {
    const row = y * bmp.width
    let count = 0
    for (let x = 0; x < bmp.width; x++) {
      if (bmp.data[row + x] < INK_THRESHOLD) count++
    }
    profile[y] = count
  }
  return profile
}

/** Count of ink pixels per column — used to find barlines and staff extents. */
export function columnInkProfile(bmp: Bitmap): Int32Array {
  const profile = new Int32Array(bmp.width)
  for (let y = 0; y < bmp.height; y++) {
    const row = y * bmp.width
    for (let x = 0; x < bmp.width; x++) {
      if (bmp.data[row + x] < INK_THRESHOLD) profile[x]++
    }
  }
  return profile
}

/**
 * For every ink pixel, the length of the vertical ink run it belongs to.
 * Computed once and reused by staff-line removal, which is the only cheap way
 * to erase lines without also erasing the stems crossing them.
 */
export function verticalRunLengths(bmp: Bitmap): Uint16Array {
  const { width, height, data } = bmp
  const runs = new Uint16Array(width * height)
  for (let x = 0; x < width; x++) {
    let y = 0
    while (y < height) {
      if (data[y * width + x] >= INK_THRESHOLD) {
        y++
        continue
      }
      let end = y
      while (end < height && data[end * width + x] < INK_THRESHOLD) end++
      const length = Math.min(end - y, 65535)
      for (let yy = y; yy < end; yy++) runs[yy * width + x] = length
      y = end
    }
  }
  return runs
}
