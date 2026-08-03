import { createBitmap, rotate } from '../bitmap'
import type { Bitmap } from '../types'

/**
 * Synthetic score renderer, for test fixtures only.
 *
 * Draws directly into a grayscale `Bitmap` — no canvas, no fonts, no DOM — so
 * the recogniser's tests run in Vitest's `node` environment with nothing to set
 * up, and every fixture carries exact ground truth.
 *
 * These fixtures validate geometry and pipeline wiring. They are not a claim
 * about real-world accuracy: the renderer draws the idealised shapes the
 * detector expects, so a passing suite means "the maths is right", not "this
 * works on your scan". Real scans are checked by hand.
 */

const PAPER_TONE = 244
const INK_TONE = 24

export interface SyntheticStaff {
  /** y of the top line. */
  top: number
  /** Gap between adjacent lines. */
  spaceHeight: number
  x0: number
  x1: number
  lineThickness?: number
}

export interface SyntheticNote {
  x: number
  staffIndex: number
  /** Diatonic steps above the staff's bottom line. 0 = bottom line (E4). */
  relative: number
  /** Hollow (half/whole) noteheads default to filled. */
  filled?: boolean
  /** Stems are drawn by default; they must not confuse notehead detection. */
  stem?: boolean
  accidental?: '#' | 'b' | 'n'
}

export interface SyntheticScore {
  width: number
  height: number
  staves: SyntheticStaff[]
  notes: SyntheticNote[]
  barlines?: { x: number; staffIndex: number }[]
  /** Drawn just after the clef area, at the conventional staff positions. */
  keySignature?: { kind: '#' | 'b'; count: number; staffIndex: number }
  /** Rotate the finished page, to exercise deskew. */
  rotateDeg?: number
  /** Apply a left-to-right brightness ramp, to exercise adaptive thresholding. */
  gradient?: boolean
  /** Peak amplitude of uniform noise, 0–255. Deterministic. */
  noise?: number
}

/** Conventional staff positions of key-signature accidentals, in `relative` steps. */
const SHARP_POSITIONS = [8, 5, 9, 6, 3, 7, 4]
const FLAT_POSITIONS = [4, 7, 3, 6, 2, 5, 1]

function bottomLineY(staff: SyntheticStaff): number {
  return staff.top + 4 * staff.spaceHeight
}

function yForRelative(staff: SyntheticStaff, relative: number): number {
  return bottomLineY(staff) - (relative * staff.spaceHeight) / 2
}

function setInk(bmp: Bitmap, x: number, y: number) {
  const xi = Math.round(x)
  const yi = Math.round(y)
  if (xi < 0 || yi < 0 || xi >= bmp.width || yi >= bmp.height) return
  bmp.data[yi * bmp.width + xi] = INK_TONE
}

function fillRect(bmp: Bitmap, x: number, y: number, w: number, h: number) {
  for (let yy = Math.round(y); yy < Math.round(y + h); yy++) {
    for (let xx = Math.round(x); xx < Math.round(x + w); xx++) setInk(bmp, xx, yy)
  }
}

/** Filled ellipse, tilted like a real notehead. */
function fillEllipse(bmp: Bitmap, cx: number, cy: number, rx: number, ry: number, tiltDeg = -20) {
  const radians = (tiltDeg * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const reach = Math.ceil(Math.max(rx, ry)) + 1
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const u = (dx * cos + dy * sin) / rx
      const v = (-dx * sin + dy * cos) / ry
      if (u * u + v * v <= 1) setInk(bmp, cx + dx, cy + dy)
    }
  }
}

/** Ring — a hollow notehead, which erosion cannot find and hole-detection can. */
function strokeEllipse(
  bmp: Bitmap,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  thickness: number,
  tiltDeg = -20,
) {
  const radians = (tiltDeg * Math.PI) / 180
  const cos = Math.cos(radians)
  const sin = Math.sin(radians)
  const reach = Math.ceil(Math.max(rx, ry)) + 1
  const inner = Math.max(0.05, 1 - thickness / Math.min(rx, ry))
  for (let dy = -reach; dy <= reach; dy++) {
    for (let dx = -reach; dx <= reach; dx++) {
      const u = (dx * cos + dy * sin) / rx
      const v = (-dx * sin + dy * cos) / ry
      const r = u * u + v * v
      if (r <= 1 && r >= inner * inner) setInk(bmp, cx + dx, cy + dy)
    }
  }
}

function drawAccidental(
  bmp: Bitmap,
  kind: '#' | 'b' | 'n',
  cx: number,
  cy: number,
  spaceHeight: number,
) {
  const stroke = Math.max(1, Math.round(spaceHeight * 0.16))
  const halfHeight = spaceHeight * (kind === 'b' ? 1.1 : 1.0)
  const halfWidth = spaceHeight * 0.32

  if (kind === 'b') {
    // Flat: one vertical stem with a single enclosed bowl low down.
    fillRect(bmp, cx - halfWidth, cy - halfHeight * 1.3, stroke, halfHeight * 2.1)
    strokeEllipse(bmp, cx, cy + halfHeight * 0.35, halfWidth, halfHeight * 0.5, stroke, 0)
    return
  }

  // Sharp and natural: two verticals crossed by two horizontals. The sharp's
  // verticals sit inside the horizontals, the natural's are offset — which is
  // what distinguishes them by enclosed area.
  const spread = kind === '#' ? halfWidth * 0.55 : halfWidth * 0.5
  fillRect(bmp, cx - spread, cy - halfHeight, stroke, halfHeight * 2)
  fillRect(bmp, cx + spread, cy - halfHeight * (kind === '#' ? 1 : 0.6), stroke, halfHeight * (kind === '#' ? 2 : 1.6))
  fillRect(bmp, cx - halfWidth, cy - halfHeight * 0.35, halfWidth * 2, stroke)
  fillRect(bmp, cx - halfWidth, cy + halfHeight * 0.2, halfWidth * 2, stroke)
}

/** A blob standing in for a treble clef: tall, at the start of the staff. */
function drawClef(bmp: Bitmap, staff: SyntheticStaff) {
  const s = staff.spaceHeight
  const cx = staff.x0 + s * 1.2
  const top = staff.top - s * 0.8
  fillRect(bmp, cx - s * 0.15, top, Math.max(2, s * 0.3), s * 5.4)
  fillEllipse(bmp, cx, staff.top + s * 3, s * 0.7, s * 0.6, 0)
  fillEllipse(bmp, cx, staff.top + s * 1.1, s * 0.5, s * 0.45, 0)
}

export function renderScore(score: SyntheticScore): Bitmap {
  let bmp = createBitmap(score.width, score.height, PAPER_TONE)

  for (const staff of score.staves) {
    const thickness = staff.lineThickness ?? Math.max(1, Math.round(staff.spaceHeight * 0.11))
    for (let line = 0; line < 5; line++) {
      fillRect(bmp, staff.x0, staff.top + line * staff.spaceHeight, staff.x1 - staff.x0, thickness)
    }
    drawClef(bmp, staff)
  }

  if (score.keySignature) {
    const staff = score.staves[score.keySignature.staffIndex]
    const positions = score.keySignature.kind === '#' ? SHARP_POSITIONS : FLAT_POSITIONS
    for (let i = 0; i < score.keySignature.count; i++) {
      drawAccidental(
        bmp,
        score.keySignature.kind,
        staff.x0 + staff.spaceHeight * (3 + i * 0.85),
        yForRelative(staff, positions[i]),
        staff.spaceHeight,
      )
    }
  }

  for (const barline of score.barlines ?? []) {
    const staff = score.staves[barline.staffIndex]
    const thickness = Math.max(1, Math.round(staff.spaceHeight * 0.14))
    fillRect(bmp, barline.x, staff.top, thickness, staff.spaceHeight * 4)
  }

  for (const note of score.notes) {
    const staff = score.staves[note.staffIndex]
    const s = staff.spaceHeight
    const cy = yForRelative(staff, note.relative)
    const rx = s * 0.62
    const ry = s * 0.46

    // Ledger lines for notes beyond the staff, drawn every other step as engraved.
    if (note.relative < 0) {
      for (let r = -2; r >= note.relative; r -= 2) {
        fillRect(bmp, note.x - s * 0.95, yForRelative(staff, r), s * 1.9, Math.max(1, Math.round(s * 0.11)))
      }
    } else if (note.relative > 8) {
      for (let r = 10; r <= note.relative; r += 2) {
        fillRect(bmp, note.x - s * 0.95, yForRelative(staff, r), s * 1.9, Math.max(1, Math.round(s * 0.11)))
      }
    }

    if (note.accidental) {
      drawAccidental(bmp, note.accidental, note.x - s * 1.35, cy, s)
    }

    if (note.filled === false) {
      strokeEllipse(bmp, note.x, cy, rx, ry, Math.max(1.5, s * 0.19))
    } else {
      fillEllipse(bmp, note.x, cy, rx, ry)
    }

    if (note.stem !== false) {
      const stemWidth = Math.max(1, Math.round(s * 0.13))
      const up = note.relative < 4
      const length = s * 3.2
      if (up) {
        fillRect(bmp, note.x + rx - stemWidth, cy - length, stemWidth, length)
      } else {
        fillRect(bmp, note.x - rx, cy, stemWidth, length)
      }
    }
  }

  if (score.gradient) {
    // Bright on the left, dim on the right — a global threshold cannot serve both.
    for (let y = 0; y < bmp.height; y++) {
      for (let x = 0; x < bmp.width; x++) {
        const i = y * bmp.width + x
        const shade = 1 - 0.45 * (x / bmp.width)
        bmp.data[i] = Math.max(0, Math.min(255, Math.round(bmp.data[i] * shade)))
      }
    }
  }

  if (score.noise) {
    // Deterministic LCG — a fixed fixture must not flake between runs.
    let seed = 12345
    for (let i = 0; i < bmp.data.length; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff
      const jitter = ((seed / 0x7fffffff) * 2 - 1) * score.noise
      bmp.data[i] = Math.max(0, Math.min(255, Math.round(bmp.data[i] + jitter)))
    }
  }

  if (score.rotateDeg) bmp = rotate(bmp, score.rotateDeg)

  return bmp
}

/** Convenience: a single staff with evenly spaced notes at the given positions. */
export function simplePhrase(
  relatives: number[],
  options: { spaceHeight?: number; rotateDeg?: number; gradient?: boolean; noise?: number } = {},
): { bitmap: Bitmap; staff: SyntheticStaff; xs: number[] } {
  const spaceHeight = options.spaceHeight ?? 16
  const gap = Math.round(spaceHeight * 3)
  // The first note has to clear the clef, which is drawn relative to the staff
  // size — so this offset scales with it too. A fixed offset works at one
  // spacing and silently overlaps the clef at larger ones.
  const startX = 20 + Math.round(spaceHeight * 4.5)
  const width = startX + relatives.length * gap + Math.round(spaceHeight * 3)
  const staff: SyntheticStaff = {
    top: Math.round(spaceHeight * 4),
    spaceHeight,
    x0: 20,
    x1: width - 20,
  }
  const xs = relatives.map((_, i) => startX + i * gap)
  return {
    bitmap: renderScore({
      width,
      height: Math.round(spaceHeight * 14),
      staves: [staff],
      notes: relatives.map((relative, i) => ({ x: xs[i], staffIndex: 0, relative })),
      rotateDeg: options.rotateDeg,
      gradient: options.gradient,
      noise: options.noise,
    }),
    staff,
    xs,
  }
}
