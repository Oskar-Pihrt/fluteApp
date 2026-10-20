import type { CodeGrammar, FingeringSpec } from '@/domain/fingering'

/**
 * Fingering database for the tin whistle, written as for the D whistle —
 * the notation every whistle is read in. Whistles in other keys finger the
 * same and transpose (the catalog). The second octave is the first, blown
 * harder.
 *
 * Source: The Woodwind Fingering Guide, basic fingering chart for tin whistle
 * and fife, D4–D6, https://www.wfg.woodwind.org/tinwhistle/ — fife-only
 * fingerings and the unreliable third octave left out.
 *
 *   fingers    123 | 123, '-' open, 'h' half covered
 */
export const WHISTLE_GRAMMAR: CodeGrammar = {
  leftStack: ['H1', 'H2', 'H3'],
  rightStack: ['H4', 'H5', 'H6'],
  leftAux: {},
  rightAux: {},
}

export const WHISTLE_SPECS: FingeringSpec[] = [
  { note: 'D4', code: '123 | 123', kind: 'primary' },
  { note: 'D#4', code: '123 | 12h', kind: 'primary' },
  { note: 'E4', code: '123 | 12-', kind: 'primary' },
  { note: 'F4', code: '123 | 1h-', kind: 'primary' },
  { note: 'F#4', code: '123 | 1--', kind: 'primary' },
  { note: 'G4', code: '123 | ---', kind: 'primary' },
  { note: 'G#4', code: '12h | ---', kind: 'primary' },
  { note: 'A4', code: '12- | ---', kind: 'primary' },
  { note: 'A#4', code: '1h- | ---', kind: 'primary' },
  { note: 'B4', code: '1-- | ---', kind: 'primary' },
  { note: 'C5', code: 'h-- | ---', kind: 'primary' },
  { note: 'C5', code: '-23 | ---', kind: 'alternate', comment: "For conical- (rather than cylindrical-) bore tin whistle or fife in D." },
  { note: 'C#5', code: '--- | ---', kind: 'primary' },
  { note: 'C#5', code: '--- | --3', kind: 'alternate', comment: "Better balance (tin whistle)." },
  { note: 'D5', code: '-23 | 123', kind: 'primary' },
  { note: 'D#5', code: '123 | 12h', kind: 'primary' },
  { note: 'E5', code: '123 | 12-', kind: 'primary' },
  { note: 'F5', code: '123 | 1h-', kind: 'primary' },
  { note: 'F#5', code: '123 | 1--', kind: 'primary' },
  { note: 'G5', code: '123 | ---', kind: 'primary' },
  { note: 'G#5', code: '12h | ---', kind: 'primary' },
  { note: 'A5', code: '12- | ---', kind: 'primary' },
  { note: 'A#5', code: '1h- | ---', kind: 'primary' },
  { note: 'B5', code: '1-- | ---', kind: 'primary' },
  { note: 'C6', code: 'h-- | ---', kind: 'primary' },
  { note: 'C#6', code: '--- | ---', kind: 'primary' },
  { note: 'C#6', code: '--- | --3', kind: 'alternate', comment: "Better balance." },
  { note: 'D6', code: '-23 | 123', kind: 'primary' },
]
