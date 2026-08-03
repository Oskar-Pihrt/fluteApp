import { createBitmap } from './bitmap'
import { type Bitmap, INK, INK_THRESHOLD, PAPER } from './types'

/**
 * Binary morphology with an elliptical structuring element.
 *
 * This is how noteheads get separated from the stems and beams they are fused
 * to. A notehead is a solid ellipse roughly one staff space across; stems and
 * beams are thin in one direction. Erode with an ellipse a little smaller than a
 * notehead and the noteheads survive as small blobs while everything thin
 * disappears — no shape analysis or template matching required.
 */

export interface EllipseElement {
  /** Column offsets per row of the element, as [dy, dxSpan] pairs. */
  offsets: Int32Array
  radiusX: number
  radiusY: number
}

/**
 * Build an elliptical element. Stored as a per-row horizontal span rather than a
 * full mask, so erosion tests a handful of spans per pixel instead of the whole
 * bounding box.
 */
export function ellipseElement(radiusX: number, radiusY: number): EllipseElement {
  const ry = Math.max(1, Math.round(radiusY))
  const rx = Math.max(1, Math.round(radiusX))
  const rows = ry * 2 + 1
  const offsets = new Int32Array(rows)
  for (let i = 0; i < rows; i++) {
    const dy = i - ry
    const t = 1 - (dy * dy) / (ry * ry)
    offsets[i] = t <= 0 ? 0 : Math.round(rx * Math.sqrt(t))
  }
  return { offsets, radiusX: rx, radiusY: ry }
}

/**
 * Erosion: a pixel survives only if every pixel of the element centred on it is
 * ink. Out-of-bounds counts as paper, so shapes touching the border erode away —
 * which is the desired behaviour for a page scan.
 */
export function erode(bmp: Bitmap, element: EllipseElement): Bitmap {
  const { width, height, data } = bmp
  const out = createBitmap(width, height, PAPER)
  const { offsets, radiusY } = element

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[y * width + x] >= INK_THRESHOLD) continue

      let survives = true
      for (let i = 0; i < offsets.length && survives; i++) {
        const span = offsets[i]
        if (span === 0) continue
        const yy = y + (i - radiusY)
        if (yy < 0 || yy >= height) {
          survives = false
          break
        }
        const row = yy * width
        const from = x - span
        const to = x + span
        if (from < 0 || to >= width) {
          survives = false
          break
        }
        for (let xx = from; xx <= to; xx++) {
          if (data[row + xx] >= INK_THRESHOLD) {
            survives = false
            break
          }
        }
      }
      if (survives) out.data[y * width + x] = INK
    }
  }
  return out
}

/** Dilation — the dual of `erode`. Used to reconnect a shape after eroding it. */
export function dilate(bmp: Bitmap, element: EllipseElement): Bitmap {
  const { width, height, data } = bmp
  const out = createBitmap(width, height, PAPER)
  const { offsets, radiusY } = element

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[y * width + x] >= INK_THRESHOLD) continue
      for (let i = 0; i < offsets.length; i++) {
        const span = offsets[i]
        if (span === 0) continue
        const yy = y + (i - radiusY)
        if (yy < 0 || yy >= height) continue
        const row = yy * width
        const from = Math.max(0, x - span)
        const to = Math.min(width - 1, x + span)
        for (let xx = from; xx <= to; xx++) out.data[row + xx] = INK
      }
    }
  }
  return out
}
