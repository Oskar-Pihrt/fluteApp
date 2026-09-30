import type { CodeGrammar, FingeringSpec } from '@/domain/fingering'
import type { KeyId } from '@/domain/keys'

/**
 * Fingering database for the standard Boehm-system transverse flute.
 *
 * Source: The Woodwind Fingering Guide, basic fingering charts for flute,
 * https://www.wfg.woodwind.org/flute/ (octaves 1–3). Codes are transcribed in
 * that guide's own notation — see `src/domain/fingering.ts` for the shape and
 * `FLUTE_GRAMMAR` below for the tokens.
 *
 * Range: B3 (B footjoint) through C7.
 *
 * Two things worth knowing when reading this table:
 *
 *  - The right pinky E♭ key is held down for nearly every note. The exceptions
 *    are the very bottom of the range (B3–D4, where a longer tube is needed and
 *    the pinky is either off or on a foot key) and a few third-octave notes.
 *  - The first two octaves share fingerings from E upward, which is why one key
 *    set legitimately maps to two notes. That is not a data error — it is the
 *    whole reason feature 1 reports several octaves for one fingering.
 */
/**
 * Thumb: `T` (B natural lever), `Bb` (Briccialdi), `-` (off). WFG writes both
 * `T` and `B` for the B-natural thumb lever.
 *
 * The extra-key tokens are shared by both hands, as in the WFG charts: the left
 * pinky G♯, the right pinky E♭, the trill keys and the footjoint keys.
 */
const AUX_TOKENS: Record<string, KeyId> = {
  'G#': 'L_GSHARP',
  Eb: 'R_EFLAT',
  'C#': 'FOOT_CSHARP',
  C: 'FOOT_C',
  B: 'FOOT_B',
  D: 'TRILL_D',
  'D#': 'TRILL_DSHARP',
  gz: 'GIZMO',
}

export const FLUTE_GRAMMAR: CodeGrammar = {
  thumb: { T: 'THUMB_B', B: 'THUMB_B', Bb: 'THUMB_BB', '-': null },
  leftStack: ['L1', 'L2', 'L3'],
  rightStack: ['R1', 'R2', 'R3'],
  leftAux: AUX_TOKENS,
  rightAux: AUX_TOKENS,
}

export const FLUTE_SPECS: FingeringSpec[] = [
  // ── First octave ────────────────────────────────────────────────────────────
  { note: 'B3', code: 'T 123 | 123 B', kind: 'primary', comment: 'Requires a B footjoint.' },
  { note: 'C4', code: 'T 123 | 123 C', kind: 'primary' },
  { note: 'C#4', code: 'T 123 | 123 C#', kind: 'primary' },
  {
    note: 'D4',
    code: 'T 123 | 123',
    kind: 'primary',
    comment: 'One of the few notes with the right pinky off the E♭ key.',
  },
  { note: 'D#4', code: 'T 123 | 123 Eb', kind: 'primary' },
  { note: 'E4', code: 'T 123 | 12- Eb', kind: 'primary' },
  { note: 'F4', code: 'T 123 | 1-- Eb', kind: 'primary' },
  { note: 'F#4', code: 'T 123 | --3 Eb', kind: 'primary' },
  {
    note: 'F#4',
    code: 'T 123 | -2- Eb',
    kind: 'trill',
    comment: 'Right middle finger instead of ring — for trills and fast passages.',
  },
  { note: 'G4', code: 'T 123 | --- Eb', kind: 'primary' },
  { note: 'G#4', code: 'T 123 G# | --- Eb', kind: 'primary' },
  { note: 'A4', code: 'T 12- | --- Eb', kind: 'primary' },
  { note: 'A#4', code: 'T 1-- | 1-- Eb', kind: 'primary', comment: 'The "one and four" B♭.' },
  {
    note: 'A#4',
    code: 'Bb 1-- | --- Eb',
    kind: 'alternate',
    comment: 'Thumb B♭ (Briccialdi) — better in flat keys.',
  },
  { note: 'B4', code: 'T 1-- | --- Eb', kind: 'primary' },
  { note: 'C5', code: '- 1-- | --- Eb', kind: 'primary', comment: 'Thumb comes off.' },
  { note: 'C#5', code: '- --- | --- Eb', kind: 'primary', comment: 'All open but the E♭ key.' },

  // ── Second octave ───────────────────────────────────────────────────────────
  {
    note: 'D5',
    code: 'T -23 | 123',
    kind: 'primary',
    comment: 'Left index lifts as a vent; pinky off the E♭ key.',
  },
  { note: 'D#5', code: 'T -23 | 123 Eb', kind: 'primary', comment: 'Left index lifts as a vent.' },
  { note: 'E5', code: 'T 123 | 12- Eb', kind: 'primary', comment: 'Same fingering as E4.' },
  { note: 'F5', code: 'T 123 | 1-- Eb', kind: 'primary', comment: 'Same fingering as F4.' },
  { note: 'F#5', code: 'T 123 | --3 Eb', kind: 'primary', comment: 'Same fingering as F♯4.' },
  {
    note: 'F#5',
    code: 'T 123 | -2- Eb',
    kind: 'trill',
    comment: 'Right middle finger instead of ring — for trills and fast passages.',
  },
  { note: 'G5', code: 'T 123 | --- Eb', kind: 'primary', comment: 'Same fingering as G4.' },
  { note: 'G#5', code: 'T 123 G# | --- Eb', kind: 'primary', comment: 'Same fingering as G♯4.' },
  { note: 'A5', code: 'T 12- | --- Eb', kind: 'primary', comment: 'Same fingering as A4.' },
  { note: 'A#5', code: 'T 1-- | 1-- Eb', kind: 'primary', comment: 'Same fingering as B♭4.' },
  {
    note: 'A#5',
    code: 'Bb 1-- | --- Eb',
    kind: 'alternate',
    comment: 'Thumb B♭ (Briccialdi) — better in flat keys.',
  },
  { note: 'B5', code: 'T 1-- | --- Eb', kind: 'primary', comment: 'Same fingering as B4.' },
  { note: 'C6', code: '- 1-- | --- Eb', kind: 'primary', comment: 'Same fingering as C5.' },
  { note: 'C#6', code: '- --- | --- Eb', kind: 'primary', comment: 'Same fingering as C♯5.' },

  // ── Third octave ────────────────────────────────────────────────────────────
  // From here the fingerings stop following the scale and become harmonic-based,
  // so each one has to be learned individually.
  {
    note: 'D6',
    code: 'T -23 | --- Eb',
    kind: 'primary',
    comment: 'Third harmonic of G4.',
  },
  {
    note: 'D#6',
    code: 'T 123 G# | 123 Eb',
    kind: 'primary',
    comment: 'Fourth harmonic — everything down, including the G♯ key.',
  },
  { note: 'E6', code: 'T 12- | 12- Eb', kind: 'primary' },
  { note: 'F6', code: 'T 1-3 | 1-- Eb', kind: 'primary' },
  { note: 'F#6', code: 'T 1-3 | --3 Eb', kind: 'primary' },
  { note: 'G6', code: '- 123 | --- Eb', kind: 'primary', comment: 'Thumb off.' },
  { note: 'G#6', code: '- -23 G# | --- Eb', kind: 'primary', comment: 'Thumb and left index off.' },
  { note: 'A6', code: 'T -2- | 1-- Eb', kind: 'primary' },
  {
    note: 'A#6',
    code: 'T --- | 1-- D',
    kind: 'primary',
    comment: 'Uses the first trill key; no E♭ key.',
  },
  {
    note: 'B6',
    code: 'T 1-3 | --- D#',
    kind: 'primary',
    comment: 'Uses the second trill key; no E♭ key.',
    verify:
      'Transcription of the right-hand group was ambiguous in the source — confirm whether the right ring finger is down.',
  },
  {
    note: 'C7',
    code: '- 123 G# | 1--',
    kind: 'primary',
    comment: 'C footjoint. Thumb off, no E♭ key.',
  },
  {
    note: 'C7',
    code: '- 123 G# | 1-- gz',
    kind: 'alternate',
    comment: 'B footjoint: add the gizmo key for a cleaner, more responsive high C.',
  },
]
