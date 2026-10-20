import type { CodeGrammar, FingeringSpec } from '@/domain/fingering'

/**
 * Fingering database for the conservatoire-system oboe, in written pitch. The
 * oboe d'amore and English horn finger the same; the catalog sets how they
 * transpose.
 *
 * Source: The Woodwind Fingering Guide, basic fingering charts for oboe,
 * B♭3–F6, https://www.wfg.woodwind.org/oboe/ — and F♯6–A6 from its third
 * octave alternate chart. `OBOE_SPECS` below was converted from the charts'
 * key images, so each entry is the chart's fingering exactly; the first
 * fingering the chart gives for a note is the primary.
 *
 * Codes follow the WFG text notation:
 *
 *   thumb      I, III (octave keys), I+III, - (nothing)
 *   fingers    'h' on the first finger is the half-hole
 *   left aux   II (side octave key), tB, tD, tC# (trill keys),
 *              G#, Eb, B, Bb, F (left pinky)
 *   right aux  sA, sG# (side keys), tD (trill), F (forked F key),
 *              c (banana key), C, C#, Eb (right pinky)
 */
export const OBOE_GRAMMAR: CodeGrammar = {
  thumb: { I: 'OCT1', III: 'OCT3', 'I+III': ['OCT1', 'OCT3'], '-': null },
  leftStack: ['L1', 'L2', 'L3'],
  rightStack: ['R1', 'R2', 'R3'],
  leftAux: {
    II: 'OCT2',
    tB: 'TR_B',
    tD: 'TR_D_L',
    'tC#': 'TR_CSHARP',
    'G#': 'L_GSHARP',
    Eb: 'L_EB',
    B: 'L_B',
    Bb: 'L_BB',
    F: 'L_F',
  },
  rightAux: {
    sA: 'SIDE_A',
    'sG#': 'SIDE_GSHARP',
    tD: 'TR_D_R',
    F: 'R_F',
    c: 'BANANA',
    C: 'R_C',
    'C#': 'R_CSHARP',
    Eb: 'R_EB',
  },
}

export const OBOE_SPECS: FingeringSpec[] = [
  { note: 'A#3', code: '- 123 Bb | 123 C', kind: 'primary' },
  { note: 'B3', code: '- 123 B | 123 C', kind: 'primary' },
  { note: 'C4', code: '- 123 | 123 C', kind: 'primary' },
  { note: 'C#4', code: '- 123 | 123 C#', kind: 'primary' },
  { note: 'D4', code: '- 123 | 123', kind: 'primary' },
  { note: 'D#4', code: '- 123 | 123 Eb', kind: 'primary' },
  { note: 'D#4', code: '- 123 Eb | 123', kind: 'alternate', comment: "Use in combination with C4 and C#4." },
  { note: 'E4', code: '- 123 | 12-', kind: 'primary' },
  { note: 'F4', code: '- 123 | 12- F', kind: 'primary' },
  { note: 'F4', code: '- 123 F | 12-', kind: 'alternate', comment: "Use in combination with fingerings involving RH 3." },
  { note: 'F4', code: '- 123 | 1-3', kind: 'alternate', comment: "Use in combination with fingerings involving RH 3." },
  { note: 'F4', code: '- 123 | 1-3 Eb', kind: 'alternate', comment: "Use in combination with fingerings involving RH 3." },
  { note: 'F#4', code: '- 123 | 1--', kind: 'primary' },
  { note: 'G4', code: '- 123 | ---', kind: 'primary' },
  { note: 'G#4', code: '- 123 G# | ---', kind: 'primary' },
  { note: 'G#4', code: '- 123 | --- sG#', kind: 'alternate', comment: "Trill fingering, open-hole." },
  { note: 'G#4', code: '- 123 | --- sA', kind: 'alternate', comment: "Trill fingering, closed-hole." },
  { note: 'A4', code: '- 12- | ---', kind: 'primary' },
  { note: 'A#4', code: '- 12- | 1--', kind: 'primary' },
  { note: 'A#4', code: '- 12- tB | 1--', kind: 'alternate', comment: "Trill fingering with B4." },
  { note: 'B4', code: '- 1-- | ---', kind: 'primary' },
  { note: 'B4', code: '- 1-- tB | ---', kind: 'alternate', comment: "Trill fingering with A#4." },
  { note: 'C5', code: '- 1-- | 1--', kind: 'primary' },
  { note: 'C#5', code: '- h23 | 123 C#', kind: 'primary' },
  { note: 'D5', code: '- h23 | 123', kind: 'primary' },
  { note: 'D#5', code: '- h23 | 123 Eb', kind: 'primary' },
  { note: 'E5', code: 'I 123 | 12-', kind: 'primary' },
  { note: 'F5', code: 'I 123 | 12- F', kind: 'primary' },
  { note: 'F5', code: 'I 123 F | 12-', kind: 'alternate', comment: "Use in combination with fingerings involving RH 3." },
  { note: 'F5', code: 'I 123 | 1-3', kind: 'alternate', comment: "Use in combination with fingerings involving RH 3." },
  { note: 'F5', code: 'I 123 | 1-3 Eb', kind: 'alternate', comment: "Use in combination with fingerings involving RH 3." },
  { note: 'F#5', code: 'I 123 | 1--', kind: 'primary' },
  { note: 'G5', code: 'I 123 | ---', kind: 'primary' },
  { note: 'G#5', code: 'I 123 G# | ---', kind: 'primary' },
  { note: 'G#5', code: 'I 123 | --- sG#', kind: 'alternate', comment: "Open-hole, trill fingering." },
  { note: 'G#5', code: 'I 123 | --- sA', kind: 'alternate', comment: "Closed-hole, trill fingering." },
  { note: 'A5', code: '- 12- II | ---', kind: 'primary' },
  { note: 'A#5', code: '- 12- II | 1--', kind: 'primary' },
  { note: 'B5', code: '- 1-- II | ---', kind: 'primary' },
  { note: 'B5', code: '- 1-- II tB | ---', kind: 'alternate', comment: "Trill fingering with Bb5." },
  { note: 'C6', code: '- 1-- II | 1--', kind: 'primary' },
  { note: 'C#6', code: '- -23 | 1-- C', kind: 'primary' },
  { note: 'D6', code: '- h23 | --- C', kind: 'primary' },
  { note: 'D6', code: '- h23 | -2- C', kind: 'alternate', comment: "Basic. Good intonation." },
  { note: 'D#6', code: '- h23 B | -23', kind: 'primary' },
  { note: 'D#6', code: '- h23 | -23 Eb', kind: 'alternate', comment: "Basic. Use in combination with Eb5 or D6." },
  { note: 'E6', code: 'I h23 G# Eb | -23', kind: 'primary' },
  { note: 'E6', code: 'I h23 | -23 sG# Eb', kind: 'alternate' },
  { note: 'E6', code: 'I h23 B | -23 sG# Eb', kind: 'alternate' },
  { note: 'E6', code: 'I h23 G# | -23 Eb', kind: 'alternate' },
  { note: 'E6', code: 'I h2- | ---', kind: 'alternate' },
  { note: 'F6', code: 'I h2- G# Eb | -23', kind: 'primary' },
  { note: 'F6', code: 'I h2- | -23 sG# Eb', kind: 'alternate' },
  { note: 'F6', code: 'I h2- G# | -23 Eb', kind: 'alternate' },
  { note: 'F#6', code: 'I 12- | 12- F', kind: 'primary', verify: "Top of the range: taken as the first of several in WFG’s alternate chart — the best fingering varies with oboe and reed." },
  { note: 'F#6', code: 'I 12- | 12- F C', kind: 'alternate' },
  { note: 'F#6', code: 'I 12- F | 12-', kind: 'alternate' },
  { note: 'G6', code: 'I 1-3 | 1--', kind: 'primary', verify: "Top of the range: taken as the first of several in WFG’s alternate chart — the best fingering varies with oboe and reed." },
  { note: 'G6', code: 'I 1-- tB | 1-- C', kind: 'alternate' },
  { note: 'G6', code: 'I 1-- tB G# | 1-- C', kind: 'alternate' },
  { note: 'G#6', code: 'I 1-3 B | -23', kind: 'primary', verify: "Top of the range: taken as the first of several in WFG’s alternate chart — the best fingering varies with oboe and reed." },
  { note: 'G#6', code: 'I 1-- | 1--', kind: 'alternate' },
  { note: 'G#6', code: 'I 1-- | 1-- C', kind: 'alternate' },
  { note: 'A6', code: 'I h-3 | -2-', kind: 'primary', verify: "Top of the range: taken as the first of several in WFG’s alternate chart — the best fingering varies with oboe and reed." },
  { note: 'A6', code: 'I --3 | -23', kind: 'alternate' },
  { note: 'A6', code: 'I --3 B | -23 Eb', kind: 'alternate' },
]
