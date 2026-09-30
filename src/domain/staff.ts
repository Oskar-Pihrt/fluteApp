import { Note } from 'tonal'

/**
 * Where a note sits on a standard treble-clef staff — the clef flute music is
 * always written in, regardless of register.
 *
 * Position is expressed in diatonic steps from the bottom line (E4): each
 * step is half a line-spacing, since a line and the space directly above it
 * are each one step. Spelling doesn't move a note on the staff — F♯5 and F5
 * sit at the same height, only the accidental drawn beside the notehead
 * differs — which is why this is computed from `step`/`oct` rather than from
 * the note's `chroma`.
 */
export interface StaffPosition {
  /** Diatonic steps above the bottom line (E4). Negative sits below the staff. */
  relative: number
  /** True when the note falls on a line rather than in a space. */
  onLine: boolean
  /** Ledger lines needed below the staff (0 if the note is on or within it). */
  ledgerBelow: number
  /** Ledger lines needed above the staff. */
  ledgerAbove: number
  /** '#' | 'b' | '' — drawn beside the notehead; does not affect its height. */
  accidental: '#' | 'b' | ''
}

export type Clef = 'treble' | 'bass'

/** E4, the bottom line, as a diatonic step count (octave*7 + step; C=0..B=6). */
const BOTTOM_LINE = 4 * 7 + 2

/** The bass clef's bottom line is G2. */
const BOTTOM_LINE_BY_CLEF: Record<Clef, number> = { treble: BOTTOM_LINE, bass: 2 * 7 + 4 }

/** F5, the top line — four line-spacings (eight steps) above the bottom line. */
const TOP_LINE_RELATIVE = 8

/** Letter names by diatonic step, matching tonal's `step` (0 = C … 6 = B). */
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const

/**
 * The inverse of `staffPosition`: the plain letter and octave at a staff step,
 * before any key signature or accidental is applied.
 *
 * The recogniser measures a notehead's height on the staff and needs a pitch
 * back. Both directions share `BOTTOM_LINE`, so they cannot drift apart, and a
 * round-trip test over the flute's whole range guards the offset.
 */
export function diatonicAtStaffPosition(relative: number): { letter: string; octave: number } {
  const diatonic = Math.round(relative) + BOTTOM_LINE
  // Floor division so positions below C0 (never reached in practice) still
  // produce a consistent letter rather than a negative modulo.
  const octave = Math.floor(diatonic / 7)
  const step = ((diatonic % 7) + 7) % 7
  return { letter: LETTERS[step], octave }
}

/**
 * `relative` counts steps above the clef's bottom line: E4 in treble, G2 in
 * bass. The flute pages only ever use treble; the ear trainer's range reaches
 * C3, which is too far below the treble staff to read, so it uses bass there.
 */
export function staffPosition(note: string, clef: Clef = 'treble'): StaffPosition | null {
  const parsed = Note.get(note)
  if (parsed.empty || parsed.oct == null) return null

  const diatonic = parsed.oct * 7 + parsed.step
  const relative = diatonic - BOTTOM_LINE_BY_CLEF[clef]

  return {
    relative,
    onLine: relative % 2 === 0,
    ledgerBelow: relative < 0 ? Math.floor(-relative / 2) : 0,
    ledgerAbove:
      relative > TOP_LINE_RELATIVE ? Math.floor((relative - TOP_LINE_RELATIVE) / 2) : 0,
    accidental: parsed.alt > 0 ? '#' : parsed.alt < 0 ? 'b' : '',
  }
}
