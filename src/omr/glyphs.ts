import { labelComponents, type Component, type LabelResult } from './components'
import { relativeAt } from './staves'
import type { Bitmap, KeySignature, PrintedAccidental, Staff, StaffScale } from './types'

/**
 * Everything on the staff that isn't a notehead: the clef, barlines, and
 * accidentals — including the key signature.
 *
 * These matter for two reasons. The clef and key signature occupy the start of
 * every staff and would otherwise be mistaken for notes, so their extent has to
 * be known before notehead detection can be trusted. And accidentals decide
 * pitch: without them, every note in a sharp key is read a semitone flat.
 */

/** Conventional staff positions of key-signature accidentals, in `relative` steps. */
const SHARP_POSITIONS = [8, 5, 9, 6, 3, 7, 4]
const FLAT_POSITIONS = [4, 7, 3, 6, 2, 5, 1]

export interface ClefRegion {
  staffIndex: number
  /** x beyond which the clef no longer occupies the staff. */
  endX: number
}

/**
 * The clef, as the tall thing at the start of a staff.
 *
 * Identified by size and position rather than by shape: any glyph over three
 * staff spaces tall sitting in the first few spaces of the staff is the clef.
 * We never need to know *which* clef it is — flute music is treble throughout —
 * only where it stops, so that notehead detection can begin after it.
 */
export function detectClefs(
  staffRemoved: Bitmap,
  staves: Staff[],
  scale: StaffScale,
): ClefRegion[] {
  const S = scale.spaceHeight
  const labelled = labelComponents(staffRemoved, { minArea: Math.round(S * S * 0.05) })

  return staves.map((staff) => {
    let endX = staff.x0
    for (const component of labelled.components) {
      // Taller than a stemmed note, which reaches only about 3.5 spaces. Being
      // strict here matters in both directions: too loose and the first note of
      // the staff gets swallowed as "clef"; too strict and the clef's bowls come
      // back as spurious notes. Erring loose loses real music, so we err strict —
      // a spurious note is one tap to delete, a missing one is invisible.
      if (component.bbox.height < S * 3.8) continue
      // A clef is a broad 2D glyph, not a stem.
      if (component.bbox.width < S * 0.7) continue
      // Engraving always leaves a gap before the first note, so the clef is the
      // only thing this close to the staff's start.
      if (component.bbox.x > staff.x0 + S * 2.2) continue
      // And it has to vertically belong to this staff.
      const centreY = component.bbox.y + component.bbox.height / 2
      if (Math.abs(centreY - (staff.lines[0] + staff.lines[4]) / 2) > S * 3) continue
      endX = Math.max(endX, component.bbox.x + component.bbox.width)
    }
    return { staffIndex: staff.index, endX }
  })
}

export interface Barline {
  x: number
  staffIndex: number
}

/**
 * Barlines: full-height vertical strokes spanning a staff.
 *
 * These exist only to scope accidentals to a measure, so getting double bars or
 * repeat signs exactly right doesn't matter — an extra barline resets the
 * accidentals a fraction early, which is harmless. They carry a staff index
 * because measures are numbered per staff.
 */
export function detectBarlines(
  staffRemoved: Bitmap,
  staves: Staff[],
  scale: StaffScale,
): Barline[] {
  const S = scale.spaceHeight
  const labelled = labelComponents(staffRemoved, { minArea: Math.round(S * 2) })
  const barlines: Barline[] = []

  for (const component of labelled.components) {
    // Tall enough to span the staff, and no wider than a stroke. A stem is
    // shorter than the staff is tall, which is what separates the two.
    if (component.bbox.height < S * 3.6) continue
    if (component.bbox.width > S * 0.45) continue

    const centreY = component.bbox.y + component.bbox.height / 2
    const staff = staves.find(
      (candidate) => Math.abs(centreY - (candidate.lines[0] + candidate.lines[4]) / 2) < S * 1.5,
    )
    if (staff) {
      barlines.push({ x: component.bbox.x + component.bbox.width / 2, staffIndex: staff.index })
    }
  }
  return barlines.sort((a, b) => a.staffIndex - b.staffIndex || a.x - b.x)
}

export interface AccidentalGlyph {
  x: number
  y: number
  kind: PrintedAccidental
  uncertain: boolean
  staffIndex: number
  /** Staff position the glyph is centred on — how a key signature is read. */
  relative: number
  right: number
}

/**
 * Accidental glyphs, found by size and then classified by where their ink sits.
 *
 * All three are tall and narrow, so telling them apart needs a little more:
 *
 * - A **flat** has its bowl low down, so its ink — and its enclosed hole — sit
 *   below centre, with only a thin stem above.
 * - A **sharp** has two full-height verticals, so its top-right corner is inked.
 * - A **natural** has its right-hand vertical dropped, leaving the top-right
 *   corner empty.
 *
 * When those signals disagree the glyph is returned `uncertain` rather than
 * guessed at, so the review UI can ask instead of quietly transposing a note.
 */
export function detectAccidentals(
  staffRemoved: Bitmap,
  staves: Staff[],
  scale: StaffScale,
): AccidentalGlyph[] {
  const S = scale.spaceHeight
  const labelled = labelComponents(staffRemoved, { minArea: Math.round(S * S * 0.05) })
  const glyphs: AccidentalGlyph[] = []

  for (const component of labelled.components) {
    const { width, height } = component.bbox
    if (height < S * 1.4 || height > S * 3.2) continue
    if (width < S * 0.25 || width > S * 1.1) continue
    // Accidentals are clearly taller than they are wide; noteheads are not.
    if (height < width * 1.6) continue

    const centreY = component.bbox.y + component.bbox.height / 2
    const staff = staves.find(
      (candidate) => Math.abs(centreY - (candidate.lines[0] + candidate.lines[4]) / 2) < S * 4,
    )
    if (!staff) continue

    const classified = classifyAccidental(staffRemoved, labelled, component, S)
    glyphs.push({
      x: component.centroidX,
      y: centreY,
      kind: classified.kind,
      uncertain: classified.uncertain,
      staffIndex: staff.index,
      relative: Math.round(relativeAt(staff, classified.anchorY)),
      right: component.bbox.x + component.bbox.width,
    })
  }

  return glyphs.sort((a, b) => a.staffIndex - b.staffIndex || a.x - b.x)
}

function classifyAccidental(
  bmp: Bitmap,
  labelled: LabelResult,
  component: Component,
  S: number,
): { kind: PrintedAccidental; uncertain: boolean; anchorY: number } {
  const { x, y, width, height } = component.bbox
  const centreY = y + height / 2

  // Ink balance between the halves, and how wide the top half is.
  let upperInk = 0
  let lowerInk = 0
  let topRightInk = 0
  let topHalfMinX = Infinity
  let topHalfMaxX = -Infinity

  const rightThird = x + width * 0.62
  const topQuarter = y + height * 0.28

  for (let yy = y; yy < y + height; yy++) {
    for (let xx = x; xx < x + width; xx++) {
      if (labelled.labels[yy * bmp.width + xx] !== component.label) continue
      if (yy < centreY) {
        upperInk++
        if (xx < topHalfMinX) topHalfMinX = xx
        if (xx > topHalfMaxX) topHalfMaxX = xx
      } else {
        lowerInk++
      }
      if (yy < topQuarter && xx > rightThird) topRightInk++
    }
  }

  const topWidth = topHalfMaxX >= topHalfMinX ? topHalfMaxX - topHalfMinX + 1 : 0
  const lowerHeavy = lowerInk > upperInk * 1.5
  const narrowTop = topWidth < width * 0.55

  // A flat's whole body is the low bowl, with a bare stem above it.
  if (lowerHeavy && narrowTop) {
    return { kind: 'b', uncertain: false, anchorY: y + height * 0.68 }
  }

  // Both of the remaining glyphs are vertically centred on their note.
  const anchorY = centreY
  const hasTopRight = topRightInk > S * 0.15
  if (hasTopRight) return { kind: '#', uncertain: false, anchorY }
  if (lowerHeavy || narrowTop) {
    // Signals disagree — looks part flat, part natural. Say so.
    return { kind: 'n', uncertain: true, anchorY }
  }
  return { kind: 'n', uncertain: false, anchorY }
}

/**
 * The key signature: the accidentals between the clef and the first note.
 *
 * Read from the *positions* of those accidentals rather than their shapes.
 * Engraving convention fixes the order — sharps at F, C, G, D, A, E, B and flats
 * at B, E, A, D, G, C, F — so matching the position sequence identifies the key
 * even when the glyphs themselves classify shakily. That makes this markedly more
 * reliable than reading the same glyphs individually.
 */
export function detectKeySignature(
  accidentals: AccidentalGlyph[],
  clefs: ClefRegion[],
  firstNoteX: number | null,
  staffIndex = 0,
): { key: KeySignature; endX: number } {
  const clefEnd = clefs.find((clef) => clef.staffIndex === staffIndex)?.endX ?? 0
  const limit = firstNoteX ?? Infinity

  const candidates = accidentals
    .filter((glyph) => glyph.staffIndex === staffIndex)
    .filter((glyph) => glyph.x > clefEnd && glyph.x < limit)
    .sort((a, b) => a.x - b.x)

  if (!candidates.length) return { key: { kind: '#', count: 0 }, endX: clefEnd }

  const positions = candidates.map((glyph) => glyph.relative)
  const sharpScore = matchScore(positions, SHARP_POSITIONS)
  const flatScore = matchScore(positions, FLAT_POSITIONS)

  // Neither pattern fits: these are probably not a key signature at all.
  if (Math.max(sharpScore, flatScore) < 0.5) {
    return { key: { kind: '#', count: 0 }, endX: clefEnd }
  }

  const kind: '#' | 'b' = sharpScore >= flatScore ? '#' : 'b'
  const count = Math.min(candidates.length, 7)
  const endX = Math.max(...candidates.map((glyph) => glyph.right))
  return { key: { kind, count }, endX }
}

/** Fraction of the observed positions that land on the expected sequence. */
function matchScore(observed: number[], expected: number[]): number {
  if (!observed.length) return 0
  let hits = 0
  for (let i = 0; i < observed.length && i < expected.length; i++) {
    // Allow an octave displacement: engravers drop a sharp an octave to keep it
    // on the staff, and either position means the same pitch class.
    const delta = Math.abs(observed[i] - expected[i])
    if (delta === 0 || delta === 7) hits++
  }
  return hits / observed.length
}
