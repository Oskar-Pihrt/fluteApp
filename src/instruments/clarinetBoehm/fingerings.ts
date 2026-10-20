import type { CodeGrammar, FingeringSpec } from '@/domain/fingering'

/**
 * Fingering database for the Boehm-system clarinet, in written pitch. Every
 * size fingers alike; the catalog sets how each transposes and how far down
 * it reaches.
 *
 * Source: The Woodwind Fingering Guide, basic fingering charts for
 * Boehm-system clarinet (chalumeau, clarion, lower altissimo), E3–G6,
 * https://www.wfg.woodwind.org/clarinet/ — and G♯6–C7 from its upper
 * altissimo alternate chart. `GENERATED` below was converted from the
 * charts' key images, so each entry is the chart's fingering exactly; the
 * first fingering the chart gives for a note is the primary.
 *
 * Codes follow the WFG text notation:
 *
 *   thumb      T (thumb hole), RT (register key + thumb hole),
 *              R (register key, thumb hole open), - (nothing)
 *   left aux   A (throat A), sG# (side G♯), Eb (E♭/B♭ sliver),
 *              C#, E, F, F#, G# (left pinky)
 *   right aux  S1–S4 (side keys), B (B/F♯ sliver),
 *              E, F, F#, G# (right pinky), Eb, D, C#, C (low keys)
 *
 * The chalumeau and clarion registers share fingerings a twelfth apart: the
 * clarion adds the register key.
 */
export const CLARINET_BOEHM_GRAMMAR: CodeGrammar = {
  thumb: { T: 'THUMB', RT: ['REGISTER', 'THUMB'], R: 'REGISTER', '-': null },
  leftStack: ['L1', 'L2', 'L3'],
  rightStack: ['R1', 'R2', 'R3'],
  leftAux: {
    A: 'L_A',
    'sG#': 'L_GSHARP',
    Eb: 'L_EB',
    'C#': 'L_CSHARP',
    E: 'L_E',
    F: 'L_F',
    'F#': 'L_FSHARP',
    'G#': 'L_AB',
  },
  rightAux: {
    S1: 'SIDE_1',
    S2: 'SIDE_2',
    S3: 'SIDE_3',
    S4: 'SIDE_4',
    B: 'R_B',
    E: 'R_E',
    F: 'R_F',
    'F#': 'R_FSHARP',
    'G#': 'R_AB',
    Eb: 'LOW_EB',
    D: 'LOW_D',
    'C#': 'LOW_CSHARP',
    C: 'LOW_C',
  },
}

/**
 * The extension below E on the alto and bass clarinet and the basset horn:
 * every finger down, plus the low key. Not part of the WFG basic charts.
 */
const LOW_VERIFY = 'Low-key mechanisms differ between makers — check against your instrument.'

const LOW_NOTES: FingeringSpec[] = [
  { note: 'D#3', code: 'T 123 | 123 Eb', kind: 'primary', comment: 'Alto and bass clarinet, basset horn.', verify: LOW_VERIFY },
  { note: 'D3', code: 'T 123 | 123 D', kind: 'primary', comment: 'Bass clarinet to low C, basset horn.', verify: LOW_VERIFY },
  { note: 'C#3', code: 'T 123 | 123 C#', kind: 'primary', comment: 'Bass clarinet to low C, basset horn.', verify: LOW_VERIFY },
  { note: 'C3', code: 'T 123 | 123 C', kind: 'primary', comment: 'Bass clarinet to low C, basset horn.', verify: LOW_VERIFY },
]

const GENERATED: FingeringSpec[] = [
  { note: 'E3', code: 'T 123 E | 123', kind: 'primary', comment: "Use in combination with fingerings using right little finger or no little fingers." },
  { note: 'E3', code: 'T 123 | 123 E', kind: 'alternate', comment: "Use in combination with fingerings using left little finger or no little fingers." },
  { note: 'E3', code: 'T 123 E | 123 F', kind: 'alternate', comment: "Use in combination with F3 or C5." },
  { note: 'F3', code: 'T 123 | 123 F', kind: 'primary', comment: "Use in combination with fingerings using left little finger or no little fingers." },
  { note: 'F3', code: 'T 123 F | 123', kind: 'alternate', comment: "Use in combination with fingerings using right little finger or no little fingers." },
  { note: 'F#3', code: 'T 123 F# | 123', kind: 'primary', comment: "Use in combination with fingerings using right little finger or no little fingers." },
  { note: 'F#3', code: 'T 123 | 123 F#', kind: 'alternate', comment: "Use in combination with fingerings using left little finger or no little fingers." },
  { note: 'F#3', code: 'T 123 F# | 123 F', kind: 'alternate', comment: "Use in combination with F3 or C5." },
  { note: 'G3', code: 'T 123 | 123', kind: 'primary' },
  { note: 'G#3', code: 'T 123 | 123 G#', kind: 'primary' },
  { note: 'G#3', code: 'T 123 G# | 123', kind: 'alternate', comment: "For models with LH G# key, use in combination with fingerings using right little finger or no little fingers." },
  { note: 'A3', code: 'T 123 | 12-', kind: 'primary' },
  { note: 'A#3', code: 'T 123 | 1--', kind: 'primary' },
  { note: 'B3', code: 'T 123 | -2-', kind: 'primary' },
  { note: 'C4', code: 'T 123 | ---', kind: 'primary' },
  { note: 'C#4', code: 'T 123 C# | ---', kind: 'primary' },
  { note: 'D4', code: 'T 12- | ---', kind: 'primary' },
  { note: 'D#4', code: 'T 12- | --- S4', kind: 'primary' },
  { note: 'D#4', code: 'T 12- Eb | ---', kind: 'alternate', comment: "Chromatic and trill fingering, use in combination with D4 and A5." },
  { note: 'D#4', code: 'T 1-- | 1--', kind: 'alternate', comment: "Sharp, use in combination with fingerings involving RH 1." },
  { note: 'E4', code: 'T 1-- | ---', kind: 'primary' },
  { note: 'F4', code: 'T --- | ---', kind: 'primary' },
  { note: 'F#4', code: '- 1-- | ---', kind: 'primary' },
  { note: 'F#4', code: 'T --- | --- S3 S4', kind: 'alternate', comment: "Chromatic, use in combination with F4." },
  { note: 'G4', code: '- --- | ---', kind: 'primary' },
  { note: 'G#4', code: '- --- sG# | ---', kind: 'primary' },
  { note: 'A4', code: '- --- A | ---', kind: 'primary' },
  { note: 'A#4', code: 'R --- A | ---', kind: 'primary' },
  { note: 'A#4', code: '- --- A | --- S2', kind: 'alternate', comment: "Trill fingering with A4." },
  { note: 'B4', code: 'RT 123 E | 123', kind: 'primary', comment: "Use in combination with fingerings using right little finger or no little fingers." },
  { note: 'B4', code: 'RT 123 | 123 E', kind: 'alternate', comment: "Use in combination with fingerings using left little finger or no little fingers." },
  { note: 'B4', code: 'RT 123 E | 123 F', kind: 'alternate', comment: "Use in combination with C5." },
  { note: 'C5', code: 'RT 123 | 123 F', kind: 'primary', comment: "Use in combination with fingerings using left little finger or no little fingers." },
  { note: 'C5', code: 'RT 123 F | 123', kind: 'alternate', comment: "Use in combination with fingerings using right little finger or no little fingers." },
  { note: 'C#5', code: 'RT 123 F# | 123', kind: 'primary', comment: "Use in combination with fingerings using right little finger or no little fingers." },
  { note: 'C#5', code: 'RT 123 | 123 F#', kind: 'alternate', comment: "Use in combination with fingerings using left little finger or no little fingers." },
  { note: 'C#5', code: 'RT 123 F# | 123 F', kind: 'alternate', comment: "Use in combination with C5." },
  { note: 'D5', code: 'RT 123 | 123', kind: 'primary' },
  { note: 'D#5', code: 'RT 123 | 123 G#', kind: 'primary' },
  { note: 'D#5', code: 'RT 123 G# | 123', kind: 'alternate', comment: "For models with LH G# key, use in combination with fingerings using right little finger or no little fingers." },
  { note: 'E5', code: 'RT 123 | 12-', kind: 'primary' },
  { note: 'F5', code: 'RT 123 | 1--', kind: 'primary' },
  { note: 'F#5', code: 'RT 123 | -2-', kind: 'primary' },
  { note: 'F#5', code: 'RT 123 | 1-- B', kind: 'alternate', comment: "Chromatic, use in combination with Bb4 or F5." },
  { note: 'G5', code: 'RT 123 | ---', kind: 'primary' },
  { note: 'G#5', code: 'RT 123 C# | ---', kind: 'primary' },
  { note: 'G#5', code: 'RT 12- | 12-', kind: 'alternate', comment: "Use in combination with fingerings involving the right hand fingers." },
  { note: 'A5', code: 'RT 12- | ---', kind: 'primary' },
  { note: 'A#5', code: 'RT 12- | --- S4', kind: 'primary' },
  { note: 'A#5', code: 'RT 12- Eb | ---', kind: 'alternate', comment: "Chromatic and trill fingering, use in combination with D4 and A5." },
  { note: 'A#5', code: 'RT 1-- | 1--', kind: 'alternate', comment: "Use in combination with fingerings involving RH 1." },
  { note: 'A#5', code: 'RT 1-- | -2-', kind: 'alternate', comment: "Sharp, use for facility in combination with fingerings involving RH 2." },
  { note: 'B5', code: 'RT 1-- | ---', kind: 'primary' },
  { note: 'C6', code: 'RT --- | ---', kind: 'primary' },
  { note: 'C#6', code: 'RT -23 | 12-', kind: 'primary' },
  { note: 'D6', code: 'RT -23 | 1-- G#', kind: 'primary' },
  { note: 'D6', code: 'RT --- sG# | --- S4', kind: 'alternate', comment: "Less flat, trill fingering with C5." },
  { note: 'D6', code: 'RT --- sG# | ---', kind: 'alternate', comment: "Trill fingering with C5." },
  { note: 'D#6', code: 'RT -23 | 1-- B G#', kind: 'primary' },
  { note: 'D#6', code: 'RT -23 | --3 G#', kind: 'alternate', comment: "Use in combination with lower clarion notes." },
  { note: 'D#6', code: 'RT -23 | -2- G#', kind: 'alternate', comment: "Flat, use for facility, trill fingering with C#5." },
  { note: 'E6', code: 'RT -23 | --- G#', kind: 'primary' },
  { note: 'F6', code: 'RT -23 C# | --- G#', kind: 'primary' },
  { note: 'F6', code: 'RT 123 C# | 123', kind: 'alternate', comment: "Use for slurring with lower registers and for pp." },
  { note: 'F#6', code: 'RT -2- | --- G#', kind: 'primary' },
  { note: 'F#6', code: 'RT 12- | --- S4 G#', kind: 'alternate', comment: "Accurate pitch. Speaks easily in all dynamics. Good for wide skips." },
  { note: 'F#6', code: 'RT 12- | 123 G#', kind: 'alternate', comment: "Use for slurs with lower registers, more stable, good for pp and ff." },
  { note: 'G6', code: 'RT -2- | 12- G#', kind: 'primary' },
  { note: 'G6', code: 'RT 1-- | 12- G#', kind: 'alternate', comment: "Use for slurs from clarion notes." },
  { note: 'G6', code: 'RT --3 C# | --- F#', kind: 'alternate', comment: "Trill fingering with F5." },
  { note: 'G6', code: 'RT -2- | --- S4 G#', kind: 'alternate', comment: "Trill fingering with F#5." },
  { note: 'G#6', code: 'RT -23 F# | 1-3', kind: 'primary', verify: "Upper altissimo: taken as the first of several in WFG’s alternate chart — the best fingering varies from clarinet to clarinet." },
  { note: 'G#6', code: 'RT -23 | 1-3 F#', kind: 'alternate' },
  { note: 'G#6', code: 'RT --- | --- S4 G#', kind: 'alternate', comment: "Responds well at all dynamics with accurate pitch." },
  { note: 'G#6', code: 'RT --- | 1-- G#', kind: 'alternate', comment: "Easy to finger in all contexts with excellent tuning. Top note of Ab arpeggio with basic Eb6 fingering." },
  { note: 'A6', code: 'RT -23 | --- F', kind: 'primary', verify: "Upper altissimo: taken as the first of several in WFG’s alternate chart — the best fingering varies from clarinet to clarinet." },
  { note: 'A6', code: 'RT -23 F | ---', kind: 'alternate' },
  { note: 'A6', code: 'RT -23 | --- F#', kind: 'alternate' },
  { note: 'A6', code: 'RT -23 F# | ---', kind: 'alternate' },
  { note: 'A#6', code: 'RT -23 sG# C# | --- G#', kind: 'primary', verify: "Upper altissimo: taken as the first of several in WFG’s alternate chart — the best fingering varies from clarinet to clarinet." },
  { note: 'A#6', code: 'RT -23 sG# C# | --- F#', kind: 'alternate' },
  { note: 'A#6', code: 'RT -23 sG# | --- F#', kind: 'alternate' },
  { note: 'A#6', code: 'RT -23 sG# C# | --- S3 S4', kind: 'alternate', comment: "Good intonation, easy response." },
  { note: 'B6', code: 'RT 12- sG# | 12-', kind: 'primary', verify: "Upper altissimo: taken as the first of several in WFG’s alternate chart — the best fingering varies from clarinet to clarinet." },
  { note: 'B6', code: 'RT 12- | 12- F#', kind: 'alternate' },
  { note: 'B6', code: 'RT 12- F | 12- F#', kind: 'alternate' },
  { note: 'B6', code: 'RT 12- sG# | 12- F#', kind: 'alternate' },
  { note: 'C7', code: 'RT 1-- sG# | 1-- F#', kind: 'primary', verify: "Upper altissimo: taken as the first of several in WFG’s alternate chart — the best fingering varies from clarinet to clarinet." },
  { note: 'C7', code: 'RT 1-- sG# F# | 1--', kind: 'alternate' },
  { note: 'C7', code: 'RT 1-- sG# C# | 1--', kind: 'alternate' },
  { note: 'C7', code: 'RT --- sG# | 1-- G#', kind: 'alternate' },
]


export const CLARINET_BOEHM_SPECS: FingeringSpec[] = [...LOW_NOTES, ...GENERATED]
