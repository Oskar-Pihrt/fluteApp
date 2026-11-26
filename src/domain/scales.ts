import { Note, Scale } from 'tonal'

/**
 * Scales for improvising: which notes of the instrument's range belong to a
 * scale, spelled the way that key is written (D♭ major has G♭, not F♯).
 */

export interface ScaleType {
  id: string
  label: string
  /** The name tonal knows it by. */
  tonal: string
}

export const SCALE_TYPES: readonly ScaleType[] = [
  { id: 'major', label: 'Major', tonal: 'major' },
  { id: 'minor', label: 'Minor', tonal: 'minor' },
  { id: 'pentatonic', label: 'Pentatonic', tonal: 'major pentatonic' },
  { id: 'minorPentatonic', label: 'Minor pent.', tonal: 'minor pentatonic' },
  { id: 'blues', label: 'Blues', tonal: 'blues' },
  { id: 'dorian', label: 'Dorian', tonal: 'dorian' },
  { id: 'mixolydian', label: 'Mixolydian', tonal: 'mixolydian' },
  { id: 'harmonicMinor', label: 'Harm. minor', tonal: 'harmonic minor' },
  { id: 'chromatic', label: 'Chromatic', tonal: 'chromatic' },
]

/** Tonics offered, spelled as keys are usually written. */
export const SCALE_TONICS: readonly string[] = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

export interface ScaleNote {
  /** Spelled for the key, with octave: "Gb4". */
  note: string
  midi: number
  isTonic: boolean
}

/**
 * Every note of the scale within `range` (MIDI numbers), low to high. Empty
 * when tonal doesn't know the scale.
 */
export function scaleNotes(tonic: string, type: ScaleType, range: readonly number[]): ScaleNote[] {
  const scale = Scale.get(`${tonic} ${type.tonal}`)
  if (scale.empty) return []
  const spelling = new Map<number, string>()
  for (const name of scale.notes) {
    // tonal spells a blues ♭5 of E♭ as B𝄫; nobody reads that, so simplify to A.
    const pc = Math.abs(Note.get(name).alt) > 1 ? Note.simplify(name) : name
    const chroma = Note.chroma(pc)
    if (chroma != null) spelling.set(chroma, pc)
  }
  const tonicChroma = Note.chroma(tonic)
  return range.flatMap((midi) => {
    const pc = spelling.get(midi % 12)
    if (!pc) return []
    // The octave number follows the letter: Cb4 is the same key as B3.
    const octave = Math.floor((midi - Note.get(pc).alt) / 12) - 1
    return [{ note: `${pc}${octave}`, midi, isTonic: midi % 12 === tonicChroma }]
  })
}
