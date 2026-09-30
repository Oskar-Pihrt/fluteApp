import type { InstrumentKey, KeyGroup } from '@/domain/keys'

/** The physical keys of a standard Boehm-system transverse flute. */

export const FLUTE_KEY_IDS = [
  // Left thumb
  'THUMB_B',
  'THUMB_BB',
  // Left hand fingers
  'L1',
  'L2',
  'L3',
  // Left pinky
  'L_GSHARP',
  // Right hand fingers
  'R1',
  'R2',
  'R3',
  // Right pinky
  'R_EFLAT',
  // Trill keys (right index / middle side levers)
  'TRILL_D',
  'TRILL_DSHARP',
  // Foot joint
  'FOOT_CSHARP',
  'FOOT_C',
  'FOOT_B',
  'GIZMO',
] as const

export const FLUTE_KEYS: readonly InstrumentKey[] = [
  {
    id: 'THUMB_B',
    label: 'T',
    name: 'Thumb B key',
    hand: 'left',
    group: 'thumb',
    shape: 'lever',
  },
  {
    id: 'THUMB_BB',
    label: 'B♭',
    name: 'Thumb B♭ key (Briccialdi)',
    hand: 'left',
    group: 'thumb',
    shape: 'lever',
  },

  { id: 'L1', label: '1', name: 'Left index', hand: 'left', group: 'leftStack', shape: 'hole' },
  { id: 'L2', label: '2', name: 'Left middle', hand: 'left', group: 'leftStack', shape: 'hole' },
  { id: 'L3', label: '3', name: 'Left ring', hand: 'left', group: 'leftStack', shape: 'hole' },

  {
    id: 'L_GSHARP',
    label: 'G♯',
    name: 'Left pinky G♯ key',
    hand: 'left',
    group: 'leftPinky',
    shape: 'lever',
  },

  { id: 'R1', label: '4', name: 'Right index', hand: 'right', group: 'rightStack', shape: 'hole' },
  { id: 'R2', label: '5', name: 'Right middle', hand: 'right', group: 'rightStack', shape: 'hole' },
  { id: 'R3', label: '6', name: 'Right ring', hand: 'right', group: 'rightStack', shape: 'hole' },

  {
    id: 'TRILL_D',
    label: 'tr1',
    name: 'First trill key (D trill)',
    hand: 'right',
    group: 'trill',
    shape: 'lever',
  },
  {
    id: 'TRILL_DSHARP',
    label: 'tr2',
    name: 'Second trill key (D♯ trill)',
    hand: 'right',
    group: 'trill',
    shape: 'lever',
  },

  {
    id: 'R_EFLAT',
    label: 'E♭',
    name: 'Right pinky E♭ / D♯ key',
    hand: 'right',
    group: 'rightPinky',
    shape: 'lever',
  },
  {
    id: 'FOOT_CSHARP',
    label: 'C♯',
    name: 'Foot joint C♯ key',
    hand: 'right',
    group: 'rightPinky',
    shape: 'lever',
  },
  {
    id: 'FOOT_C',
    label: 'C',
    name: 'Foot joint C key',
    hand: 'right',
    group: 'rightPinky',
    shape: 'lever',
  },
  {
    id: 'FOOT_B',
    label: 'B',
    name: 'Foot joint low B key',
    hand: 'right',
    group: 'rightPinky',
    shape: 'lever',
    requires: 'bFoot',
  },
  {
    id: 'GIZMO',
    label: 'gz',
    name: 'Gizmo key (B footjoint high C)',
    hand: 'right',
    group: 'rightPinky',
    shape: 'lever',
    requires: 'bFoot',
  },
]

/**
 * Groups where one finger serves several keys, so only one can be held at a
 * time. The interactive chart enforces this, and a test asserts the seeded data
 * never violates it.
 */
export const FLUTE_EXCLUSIVE_GROUPS: readonly KeyGroup[] = ['thumb', 'rightPinky']
