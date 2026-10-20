import type { CodeGrammar, FingeringSpec } from '@/domain/fingering'

/**
 * Fingering database for the 12-hole alto C ocarina, at sounding pitch,
 * A4–F6.
 *
 * Source: Playsoloist's 12-hole Alto C ocarina finger chart,
 * https://playsoloist.com/ocarina/finger-chart — the common system: close
 * everything for A, open the sub-holes for C, then open the right hand from
 * the little finger up, the left hand from the ring finger up, the left
 * thumb, the right thumb and last the left little finger. Sharps re-close the
 * right ring finger. The chart notes that makers tune the top accidentals
 * differently, so those carry a *Needs checking* note.
 *
 *   thumbs     TT (both), -T (right only), -- (none)
 *   fingers    1234 | 1234, index to little finger of each hand
 *   right aux  A, B (sub-holes)
 */
export const OCARINA_GRAMMAR: CodeGrammar = {
  thumb: { TT: ['LT', 'RT'], 'T-': 'LT', '-T': 'RT', '--': null },
  leftStack: ['L1', 'L2', 'L3', 'L4'],
  rightStack: ['R1', 'R2', 'R3', 'R4'],
  leftAux: {},
  rightAux: { A: 'SUB_A', B: 'SUB_B' },
}

const MAKERS_DIFFER = 'Makers tune this note differently — some close the left index instead of the right ring.'

export const OCARINA_SPECS: FingeringSpec[] = [
  { note: 'A4', code: 'TT 1234 | 1234 A B', kind: 'primary', comment: 'Everything closed, both sub-holes too.' },
  { note: 'A#4', code: 'TT 1234 | 1234 A', kind: 'primary' },
  { note: 'B4', code: 'TT 1234 | 1234 B', kind: 'primary' },
  { note: 'C5', code: 'TT 1234 | 1234', kind: 'primary', comment: 'Home position: sub-holes open.' },
  { note: 'C#5', code: 'TT 1234 | 123- B', kind: 'primary' },
  { note: 'D5', code: 'TT 1234 | 123-', kind: 'primary' },
  { note: 'D#5', code: 'TT 1234 | 12-- B', kind: 'primary' },
  { note: 'E5', code: 'TT 1234 | 12--', kind: 'primary' },
  { note: 'F5', code: 'TT 1234 | 1---', kind: 'primary' },
  { note: 'F#5', code: 'TT 1234 | --3-', kind: 'primary' },
  { note: 'G5', code: 'TT 1234 | ----', kind: 'primary' },
  { note: 'G#5', code: 'TT 12-4 | --3-', kind: 'primary' },
  { note: 'A5', code: 'TT 12-4 | ----', kind: 'primary' },
  { note: 'A#5', code: 'TT 1--4 | --3-', kind: 'primary' },
  { note: 'B5', code: 'TT 1--4 | ----', kind: 'primary' },
  { note: 'C6', code: 'TT ---4 | ----', kind: 'primary' },
  { note: 'C#6', code: '-T ---4 | --3-', kind: 'primary', verify: MAKERS_DIFFER },
  { note: 'D6', code: '-T ---4 | ----', kind: 'primary' },
  { note: 'D#6', code: '-- ---4 | --3-', kind: 'primary', verify: MAKERS_DIFFER },
  { note: 'E6', code: '-- ---4 | ----', kind: 'primary' },
  { note: 'F6', code: '-- ---- | ----', kind: 'primary', comment: 'Everything open.' },
]
