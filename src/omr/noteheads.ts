import { labelComponents } from './components'
import { ellipseElement, erode } from './morphology'
import { relativeAt, staffForY, yAtRelative } from './staves'
import type { Bitmap, Notehead, Staff, StaffScale } from './types'

/**
 * Notehead detection, in two complementary passes.
 *
 * **Filled noteheads** are found by erosion. A notehead is a solid ellipse about
 * one staff space across; stems and beams are thin in one direction. Eroding with
 * an ellipse slightly smaller than a notehead leaves the noteheads and deletes
 * everything thin, which separates a notehead from the stem it is fused to
 * without needing to analyse the shape at all.
 *
 * **Hollow noteheads** (half and whole notes) cannot survive that erosion — they
 * have no solid interior. They are found from the other side instead: label the
 * *paper*, and look for a small enclosed hole of about the right size. The hole
 * is the giveaway, and its centroid is the notehead's centre.
 *
 * Durations are irrelevant here — the app stores pitch order only — so the two
 * passes exist purely so that neither kind of notehead is missed.
 */

export interface NoteheadOptions {
  /**
   * Erosion element size as a fraction of the staff space. Slightly under a
   * notehead's own radii, so a notehead survives with margin while a stem
   * (~0.13 S wide) cannot.
   */
  erodeFractionX?: number
  erodeFractionY?: number
  /** How far off an exact half-space a notehead may sit before it is discarded. */
  maxResidual?: number
  /**
   * Per-staff x beyond which real notes begin — past the clef and key signature.
   * Without it the clef's own bowls read as noteheads, since they are solid
   * ellipses of about the right size sitting on staff positions.
   */
  contentStartX?: number[]
}

const DEFAULTS: Required<Omit<NoteheadOptions, 'contentStartX'>> = {
  erodeFractionX: 0.34,
  erodeFractionY: 0.22,
  maxResidual: 0.42,
}

export interface NoteheadDetection {
  noteheads: Notehead[]
  /** The eroded bitmap, kept for the debug overlay. */
  eroded: Bitmap
}

export function detectNoteheads(
  staffRemoved: Bitmap,
  staves: Staff[],
  scale: StaffScale,
  options: NoteheadOptions = {},
): NoteheadDetection {
  const opts = { ...DEFAULTS, ...options }
  const contentStartX = options.contentStartX
  const S = scale.spaceHeight

  /** True when a candidate sits in the clef / key-signature region of its staff. */
  const beforeContent = (x: number, staffIndex: number) =>
    contentStartX != null && x < (contentStartX[staffIndex] ?? -Infinity)

  const element = ellipseElement(S * opts.erodeFractionX, S * opts.erodeFractionY)
  const eroded = erode(staffRemoved, element)

  const found: Notehead[] = []

  // ── Filled ───────────────────────────────────────────────────────────────
  // After erosion a notehead is a small blob; anything long and thin that
  // slipped through (a thick beam, a slur) is rejected on aspect ratio.
  const minSeedArea = Math.max(2, Math.round(S * S * 0.03))
  for (const component of labelComponents(eroded, { minArea: minSeedArea }).components) {
    if (component.bbox.height > S * 1.4) continue
    if (component.bbox.width > S * 2.2) continue
    const notehead = place(component.centroidX, component.centroidY, staves, opts.maxResidual, true, {
      x: component.centroidX - S * 0.62,
      y: component.centroidY - S * 0.46,
      width: S * 1.24,
      height: S * 0.92,
    })
    if (notehead && !beforeContent(notehead.x, notehead.staffIndex)) found.push(notehead)
  }

  // ── Hollow ───────────────────────────────────────────────────────────────
  // Enclosed paper of roughly the area a notehead's interior would have. The
  // page background is excluded because it touches the border.
  const minHole = S * S * 0.06
  const maxHole = S * S * 0.55
  for (const hole of labelComponents(staffRemoved, { target: 'paper', minArea: 3 }).components) {
    if (hole.touchesBorder) continue
    if (hole.area < minHole || hole.area > maxHole) continue
    // An accidental's or a clef's enclosed loop is much taller than wide; a
    // notehead's interior is wider than tall.
    if (hole.bbox.height > hole.bbox.width * 1.6) continue
    if (hole.bbox.width > S * 1.3) continue

    const notehead = place(hole.centroidX, hole.centroidY, staves, opts.maxResidual, false, {
      x: hole.centroidX - S * 0.62,
      y: hole.centroidY - S * 0.46,
      width: S * 1.24,
      height: S * 0.92,
    })
    if (notehead && !beforeContent(notehead.x, notehead.staffIndex)) found.push(notehead)
  }

  return { noteheads: dedupe(found, S), eroded }
}

/**
 * Attach a candidate centroid to a staff and a staff position.
 *
 * The residual — how far the centroid sits from an exact half-space — is the
 * confidence signal. A real notehead is centred on a line or a space; a stray
 * blob is not, and gets rejected or scored down.
 */
function place(
  x: number,
  y: number,
  staves: Staff[],
  maxResidual: number,
  filled: boolean,
  bbox: Notehead['bbox'],
): Notehead | null {
  const staff = staffForY(staves, y)
  if (!staff) return null

  const relative = Math.round(relativeAt(staff, y))
  const residual = Math.abs(y - yAtRelative(staff, relative)) / (staff.spaceHeight / 2)
  if (residual > maxResidual) return null

  return {
    x,
    y,
    bbox,
    filled,
    staffIndex: staff.index,
    relative,
    confidence: Math.max(0, 1 - residual / maxResidual),
  }
}

/**
 * Drop duplicates. A hollow notehead's rim can partly survive erosion, so the
 * same head can arrive from both passes; and a very thick beam occasionally
 * yields two adjacent seeds. Anything within half a staff space of an existing
 * detection at the same staff position is the same note.
 */
function dedupe(noteheads: Notehead[], S: number): Notehead[] {
  const sorted = [...noteheads].sort((a, b) => a.x - b.x || a.y - b.y)
  const kept: Notehead[] = []

  for (const candidate of sorted) {
    const duplicate = kept.find(
      (existing) =>
        existing.staffIndex === candidate.staffIndex &&
        existing.relative === candidate.relative &&
        Math.abs(existing.x - candidate.x) < S * 0.7,
    )
    if (!duplicate) {
      kept.push(candidate)
      continue
    }
    // Keep whichever sits closer to an exact staff position.
    if (candidate.confidence > duplicate.confidence) {
      kept[kept.indexOf(duplicate)] = candidate
    }
  }

  return kept.sort((a, b) => a.staffIndex - b.staffIndex || a.x - b.x)
}

/**
 * Noteheads sharing an x position on the same staff — a chord.
 *
 * Flute parts are monophonic so this is rare, but a divisi passage or a
 * double-stop in an ensemble part will produce one. Returns groups so the caller
 * can keep the top note and warn, rather than emitting a scrambled sequence.
 */
export function findChordGroups(noteheads: Notehead[], S: number): Notehead[][] {
  const groups: Notehead[][] = []
  let current: Notehead[] = []

  for (const notehead of noteheads) {
    const last = current[current.length - 1]
    if (last && last.staffIndex === notehead.staffIndex && Math.abs(last.x - notehead.x) < S * 0.6) {
      current.push(notehead)
    } else {
      if (current.length > 1) groups.push(current)
      current = [notehead]
    }
  }
  if (current.length > 1) groups.push(current)
  return groups
}
