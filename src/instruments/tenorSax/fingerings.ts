import type { CodeGrammar, FingeringSpec } from '@/domain/fingering'

/**
 * Fingering database for the B♭ tenor saxophone, in WRITTEN pitch — what the
 * player reads off the part. The instrument sounds a major ninth lower.
 *
 * Written from general knowledge of the standard saxophone fingerings, NOT
 * transcribed from a chart: check it against The Woodwind Fingering Guide
 * (https://www.wfg.woodwind.org/sax/) before relying on it. Entries I am least
 * sure of carry a `verify` note, which the UI shows as “Needs checking”.
 * Range: B♭3 through F♯6 (F♯6 needs a high F♯ key). No altissimo.
 *
 * Tokens are the key labels printed on the chart, so a code reads like the
 * diagram it describes:
 *
 *   thumb      8ve (octave key), - (off)
 *   left aux   Aux (front F), C1 (palm D), C2 (palm D♯), C4 (palm F), Bis,
 *              G#, C#, B, Bb (left pinky table)
 *   right aux  C3 (side E), TC (side C), TA (side B♭), C5 (high F♯),
 *              TF (fork F♯), Eb, C (right pinky)
 *
 * The first two octaves share fingerings; the second adds the octave key, just
 * as the flute's first two octaves share theirs.
 */
export const TENOR_SAX_GRAMMAR: CodeGrammar = {
  thumb: { '8ve': 'OCTAVE', '-': null },
  leftStack: ['L1', 'L2', 'L3'],
  rightStack: ['R1', 'R2', 'R3'],
  leftAux: {
    Aux: 'FRONT_F',
    C1: 'PALM_D',
    C2: 'PALM_DSHARP',
    C4: 'PALM_F',
    Bis: 'BIS',
    'G#': 'L_GSHARP',
    'C#': 'LOW_CSHARP',
    B: 'LOW_B',
    Bb: 'LOW_BB',
  },
  rightAux: {
    C3: 'SIDE_E',
    TC: 'SIDE_C',
    TA: 'SIDE_BB',
    C5: 'HIGH_FSHARP',
    TF: 'ALT_FSHARP',
    Eb: 'R_EFLAT',
    C: 'LOW_C',
  },
}

/** The two B♭ alternatives beside bis, identical in both octaves. */
function bFlats(octaveKey: '8ve' | '-', octave: number): FingeringSpec[] {
  const note = `A#${octave}`
  return [
    {
      note,
      code: `${octaveKey} 1-- Bis | ---`,
      kind: 'primary',
      comment: 'Bis B♭ — roll the left index over both the B key and the small bis key.',
    },
    {
      note,
      code: `${octaveKey} 1-- | 1--`,
      kind: 'alternate',
      comment: '“One and one” — best in flat keys and next to F or G♭.',
    },
    {
      note,
      code: `${octaveKey} 1-- | --- TA`,
      kind: 'alternate',
      comment: 'Side B♭ — for chromatic runs and B–B♭ trills.',
    },
  ]
}

export const TENOR_SAX_SPECS: FingeringSpec[] = [
  // ── Low register ────────────────────────────────────────────────────────────
  { note: 'A#3', code: '- 123 Bb | 123', kind: 'primary', comment: 'Lowest note on the horn.' },
  { note: 'B3', code: '- 123 B | 123', kind: 'primary' },
  { note: 'C4', code: '- 123 | 123 C', kind: 'primary' },
  { note: 'C#4', code: '- 123 C# | 123', kind: 'primary' },
  { note: 'D4', code: '- 123 | 123', kind: 'primary' },
  { note: 'D#4', code: '- 123 | 123 Eb', kind: 'primary' },
  { note: 'E4', code: '- 123 | 12-', kind: 'primary' },
  { note: 'F4', code: '- 123 | 1--', kind: 'primary' },
  { note: 'F#4', code: '- 123 | -2-', kind: 'primary' },
  {
    note: 'F#4',
    code: '- 123 | 1-- TF',
    kind: 'trill',
    comment: 'Fork F♯ key — lets F–F♯ trill with one finger.',
    verify: 'Written from memory — confirm the fork F♯ fingering and which key it uses.',
  },
  { note: 'G4', code: '- 123 | ---', kind: 'primary' },
  { note: 'G#4', code: '- 123 G# | ---', kind: 'primary' },
  { note: 'A4', code: '- 12- | ---', kind: 'primary' },
  ...bFlats('-', 4),
  { note: 'B4', code: '- 1-- | ---', kind: 'primary' },
  { note: 'C5', code: '- -2- | ---', kind: 'primary' },
  {
    note: 'C5',
    code: '- 1-- | --- TC',
    kind: 'alternate',
    comment: 'Side C — for B–C trills and fast chromatic passages.',
  },
  { note: 'C#5', code: '- --- | ---', kind: 'primary', comment: 'All keys open.' },

  // ── Middle register — the low fingerings plus the octave key ────────────────
  { note: 'D5', code: '8ve 123 | 123', kind: 'primary' },
  { note: 'D#5', code: '8ve 123 | 123 Eb', kind: 'primary' },
  { note: 'E5', code: '8ve 123 | 12-', kind: 'primary' },
  { note: 'F5', code: '8ve 123 | 1--', kind: 'primary' },
  { note: 'F#5', code: '8ve 123 | -2-', kind: 'primary' },
  {
    note: 'F#5',
    code: '8ve 123 | 1-- TF',
    kind: 'trill',
    comment: 'Fork F♯ key — lets F–F♯ trill with one finger.',
    verify: 'Written from memory — confirm the fork F♯ fingering and which key it uses.',
  },
  { note: 'G5', code: '8ve 123 | ---', kind: 'primary' },
  { note: 'G#5', code: '8ve 123 G# | ---', kind: 'primary' },
  { note: 'A5', code: '8ve 12- | ---', kind: 'primary' },
  ...bFlats('8ve', 5),
  { note: 'B5', code: '8ve 1-- | ---', kind: 'primary' },
  { note: 'C6', code: '8ve -2- | ---', kind: 'primary' },
  {
    note: 'C6',
    code: '8ve 1-- | --- TC',
    kind: 'alternate',
    comment: 'Side C — for B–C trills and fast chromatic passages.',
  },
  { note: 'C#6', code: '8ve --- | ---', kind: 'primary' },

  // ── Palm keys ───────────────────────────────────────────────────────────────
  { note: 'D6', code: '8ve --- C1 | ---', kind: 'primary' },
  { note: 'D#6', code: '8ve --- C1 C2 | ---', kind: 'primary' },
  {
    note: 'E6',
    code: '8ve --- C1 C2 | --- C3',
    kind: 'primary',
    verify: 'Palm-key combinations written from memory — confirm against a chart.',
  },
  {
    note: 'F6',
    code: '8ve --- C1 C2 C4 | --- C3',
    kind: 'primary',
    verify: 'Palm-key combinations written from memory — confirm against a chart.',
  },
  {
    note: 'F6',
    code: '8ve 1-- Aux | ---',
    kind: 'alternate',
    comment: 'Front F — smoother from the middle register, no palm-key stack.',
    verify: 'Written from memory — confirm the front F fingering against a chart.',
  },
  {
    note: 'F#6',
    code: '8ve --- C1 C2 C4 | --- C3 C5',
    kind: 'primary',
    comment: 'Needs a high F♯ key.',
    verify: 'The exact high F♯ fingering varies by horn — confirm it, and what the C5 key does.',
  },
]
