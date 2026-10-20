import type { CodeGrammar, FingeringSpec } from '@/domain/fingering'

/**
 * Fingering database for the recorder, in C: the soprano and tenor play these
 * notes; the sopranino and alto, which are in F, play every note a fourth
 * higher with the same fingering (the catalog's `fingeringShift`).
 *
 * Source: The Woodwind Fingering Guide, basic fingering chart for recorder,
 * https://www.wfg.woodwind.org/recorder/ — converted from the chart's hole
 * images. The chart gives baroque (English) and German fingerings side by
 * side where they differ (F, F♯, G♯ and their octaves); the rest is shared.
 *
 *   thumb      T (covered), t (pinched — half open), - (open)
 *   fingers    123 | 4567, '-' open, 'h' on 6 or 7: only the small hole of
 *              the double hole covered
 *   right aux  X (bell closed against the knee)
 */
export const RECORDER_GRAMMAR: CodeGrammar = {
  thumb: { T: 'THUMB', '-': null },
  thumbPartial: { t: 'THUMB' },
  leftStack: ['L1', 'L2', 'L3'],
  rightStack: ['R4', 'R5', 'R6', 'R7'],
  rightFirstDigit: 4,
  leftAux: {},
  rightAux: { X: 'BELL' },
}

export const BAROQUE_SPECS: FingeringSpec[] = [
  { note: 'C4', code: 'T 123 | 4567', kind: 'primary' },
  { note: 'C#4', code: 'T 123 | 456h', kind: 'primary' },
  { note: 'D4', code: 'T 123 | 456-', kind: 'primary' },
  { note: 'D#4', code: 'T 123 | 45h-', kind: 'primary' },
  { note: 'E4', code: 'T 123 | 45--', kind: 'primary' },
  { note: 'F4', code: 'T 123 | 4-67', kind: 'primary' },
  { note: 'F#4', code: 'T 123 | -56-', kind: 'primary' },
  { note: 'G4', code: 'T 123 | ----', kind: 'primary' },
  { note: 'G#4', code: 'T 12- | 45h-', kind: 'primary' },
  { note: 'A4', code: 'T 12- | ----', kind: 'primary' },
  { note: 'A#4', code: 'T 1-3 | 4---', kind: 'primary' },
  { note: 'B4', code: 'T 1-- | ----', kind: 'primary' },
  { note: 'B4', code: 'T -23 | ----', kind: 'alternate', comment: "Use in combination with C5/F5." },
  { note: 'C5', code: 'T -2- | ----', kind: 'primary' },
  { note: 'C#5', code: '- 12- | ----', kind: 'primary' },
  { note: 'C#5', code: 'T --- | ----', kind: 'alternate', comment: "Use in combination with C5/F5." },
  { note: 'D5', code: '- -2- | ----', kind: 'primary' },
  { note: 'D#5', code: '- -23 | 456-', kind: 'primary' },
  { note: 'E5', code: 't 123 | 45--', kind: 'primary' },
  { note: 'F5', code: 't 123 | 4-6-', kind: 'primary' },
  { note: 'F#5', code: 't 123 | -5--', kind: 'primary' },
  { note: 'G5', code: 't 123 | ----', kind: 'primary' },
  { note: 'G#5', code: 't 12- | 4---', kind: 'primary' },
  { note: 'A5', code: 't 12- | ----', kind: 'primary' },
  { note: 'A#5', code: 't 12- | 456-', kind: 'primary' },
  { note: 'B5', code: 't 12- | 45--', kind: 'primary' },
  { note: 'C6', code: 't 1-- | 45--', kind: 'primary' },
  { note: 'C#6', code: 't 1-3 | 4-6- X', kind: 'primary' },
  { note: 'D6', code: 't 1-3 | 4-6-', kind: 'primary' },
]

export const GERMAN_SPECS: FingeringSpec[] = [
  { note: 'C4', code: 'T 123 | 4567', kind: 'primary' },
  { note: 'C#4', code: 'T 123 | 456h', kind: 'primary' },
  { note: 'D4', code: 'T 123 | 456-', kind: 'primary' },
  { note: 'D#4', code: 'T 123 | 45h-', kind: 'primary' },
  { note: 'E4', code: 'T 123 | 45--', kind: 'primary' },
  { note: 'F4', code: 'T 123 | 4---', kind: 'primary' },
  { note: 'F#4', code: 'T 123 | -567', kind: 'primary' },
  { note: 'G4', code: 'T 123 | ----', kind: 'primary' },
  { note: 'G#4', code: 'T 12- | 45--', kind: 'primary' },
  { note: 'A4', code: 'T 12- | ----', kind: 'primary' },
  { note: 'A#4', code: 'T 1-3 | 4---', kind: 'primary' },
  { note: 'B4', code: 'T 1-- | ----', kind: 'primary' },
  { note: 'B4', code: 'T -23 | ----', kind: 'alternate', comment: "Use in combination with C5/F5." },
  { note: 'C5', code: 'T -2- | ----', kind: 'primary' },
  { note: 'C#5', code: '- 12- | ----', kind: 'primary' },
  { note: 'C#5', code: 'T --- | ----', kind: 'alternate', comment: "Use in combination with C5/F5." },
  { note: 'D5', code: '- -2- | ----', kind: 'primary' },
  { note: 'D#5', code: '- -23 | 456-', kind: 'primary' },
  { note: 'E5', code: 't 123 | 45--', kind: 'primary' },
  { note: 'F5', code: 't 123 | 4---', kind: 'primary' },
  { note: 'F#5', code: 't 123 | -5-7', kind: 'primary' },
  { note: 'G5', code: 't 123 | ----', kind: 'primary' },
  { note: 'G#5', code: 't 12- | 4---', kind: 'primary' },
  { note: 'A5', code: 't 12- | ----', kind: 'primary' },
  { note: 'A#5', code: 't 12- | 456-', kind: 'primary' },
  { note: 'B5', code: 't 12- | 45--', kind: 'primary' },
  { note: 'C6', code: 't 1-- | 45--', kind: 'primary' },
  { note: 'C#6', code: 't 1-3 | 4-6- X', kind: 'primary' },
  { note: 'D6', code: 't 1-3 | 4-6-', kind: 'primary' },
]
