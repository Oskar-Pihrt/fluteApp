import { diatonicAtStaffPosition } from '@/domain/staff'
import type { AccidentalGlyph, Barline } from './glyphs'
import type { KeySignature, Notehead, PrintedAccidental, RecognisedNote, StaffScale } from './types'

/**
 * Turning staff positions into pitches.
 *
 * A notehead's height gives only a letter and an octave — F5, not F♯5. Three
 * things then decide the accidental, in increasing precedence:
 *
 *  1. the key signature, which applies to a letter in every octave;
 *  2. any accidental printed earlier in the same measure, which by convention
 *     applies to that letter *in that octave* until the barline;
 *  3. an accidental printed on this notehead itself.
 *
 * Pitch is derived here rather than baked into the notehead so that correcting a
 * misread key signature re-derives the whole piece instantly, with no re-scan.
 */

/** Letters altered by each key, in the conventional order. */
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F']

export function lettersAlteredBy(key: KeySignature): Map<string, '#' | 'b'> {
  const order = key.kind === '#' ? SHARP_ORDER : FLAT_ORDER
  const altered = new Map<string, '#' | 'b'>()
  for (let i = 0; i < Math.min(key.count, 7); i++) altered.set(order[i], key.kind)
  return altered
}

export interface DeriveOptions {
  noteheads: Notehead[]
  accidentals: AccidentalGlyph[]
  barlines: Barline[]
  key: KeySignature
  scale: StaffScale
  /** Per-staff x where music begins, so key-signature glyphs aren't reused as note accidentals. */
  contentStartX: number[]
}

/**
 * Measure numbers, counted per staff and then made continuous across the page.
 *
 * Only two properties matter for accidental scoping: the number must increase at
 * every barline, and it must never repeat once we've moved on — so processing in
 * reading order lets a single "has the measure changed?" check reset the
 * accidentals in force.
 */
function buildMeasureNumbering(barlines: Barline[], staffCount: number) {
  const perStaff: number[][] = Array.from({ length: Math.max(1, staffCount) }, () => [])
  for (const barline of barlines) {
    if (perStaff[barline.staffIndex]) perStaff[barline.staffIndex].push(barline.x)
  }
  for (const xs of perStaff) xs.sort((a, b) => a - b)

  // Each staff starts where the previous one's measures left off.
  const offsets: number[] = []
  let running = 0
  for (let index = 0; index < perStaff.length; index++) {
    offsets[index] = running
    running += perStaff[index].length + 1
  }

  return (x: number, staffIndex: number): number => {
    const xs = perStaff[staffIndex] ?? []
    let measure = offsets[staffIndex] ?? 0
    for (const barlineX of xs) {
      if (barlineX < x) measure++
    }
    return measure
  }
}

/**
 * Attach an accidental to a notehead if one is printed immediately to its left.
 *
 * Accidentals sit just before the note they alter, vertically centred on it.
 * Anything further than about 1.6 spaces away belongs to a different note.
 */
function accidentalFor(
  notehead: Notehead,
  accidentals: AccidentalGlyph[],
  spaceHeight: number,
  contentStartX: number,
): AccidentalGlyph | null {
  let best: AccidentalGlyph | null = null
  let bestDistance = Infinity

  for (const glyph of accidentals) {
    if (glyph.staffIndex !== notehead.staffIndex) continue
    // Key-signature glyphs live before the music starts; they are not note
    // accidentals and must not be consumed as such.
    if (glyph.x < contentStartX) continue
    if (glyph.x >= notehead.x) continue

    const dx = notehead.x - glyph.x
    if (dx > spaceHeight * 1.9) continue
    if (Math.abs(glyph.y - notehead.y) > spaceHeight * 0.9) continue
    if (dx < bestDistance) {
      bestDistance = dx
      best = glyph
    }
  }
  return best
}

function spell(letter: string, octave: number, accidental: PrintedAccidental): string {
  const suffix = accidental === '#' ? '#' : accidental === 'b' ? 'b' : ''
  return `${letter}${suffix}${octave}`
}

/**
 * Derive the pitch sequence. Noteheads must already be in reading order —
 * grouped by staff, ordered by x.
 */
export function derivePitches(options: DeriveOptions): RecognisedNote[] {
  const { noteheads, accidentals, barlines, key, scale, contentStartX } = options
  const keyAlterations = lettersAlteredBy(key)

  const staffCount = Math.max(1, ...noteheads.map((n) => n.staffIndex + 1))
  const measureAt = buildMeasureNumbering(barlines, staffCount)

  // Accidentals currently in force, keyed by letter+octave. Cleared at each
  // barline, which is exactly the convention.
  const active = new Map<string, '#' | 'b' | 'n'>()
  let previousMeasure = -1

  const results: RecognisedNote[] = []

  for (const notehead of noteheads) {
    const { letter, octave } = diatonicAtStaffPosition(notehead.relative)
    const measureIndex = measureAt(notehead.x, notehead.staffIndex)

    // A new measure clears everything the previous one had in force.
    if (measureIndex !== previousMeasure) {
      active.clear()
      previousMeasure = measureIndex
    }

    const glyph = accidentalFor(
      notehead,
      accidentals,
      scale.spaceHeight,
      contentStartX[notehead.staffIndex] ?? -Infinity,
    )

    const scopeKey = `${letter}${octave}`
    let accidental: PrintedAccidental = ''

    if (glyph && glyph.kind) {
      accidental = glyph.kind
      // Stays in force for the rest of the measure, including a natural, which
      // has to keep cancelling the key signature until the barline.
      active.set(scopeKey, glyph.kind)
    } else {
      const inForce = active.get(scopeKey)
      if (inForce) {
        accidental = inForce === 'n' ? 'n' : inForce
      } else {
        accidental = keyAlterations.get(letter) ?? ''
      }
    }

    // A natural cancels rather than alters, so it spells as the plain letter.
    const effective: PrintedAccidental = accidental === 'n' ? '' : accidental

    results.push({
      note: spell(letter, octave, effective),
      relative: notehead.relative,
      staffIndex: notehead.staffIndex,
      measureIndex,
      accidental: glyph ? glyph.kind : '',
      accidentalUncertain: glyph?.uncertain ?? false,
      // Filled in by the caller, which knows the mapping back to the original image.
      bbox: notehead.bbox,
      confidence: notehead.confidence,
    })
  }

  return results
}
