import type { InstrumentKey, KeyGroup } from '@/domain/keys'

/**
 * The keys of a full conservatoire-system oboe, as described by The Woodwind
 * Fingering Guide (wfg.woodwind.org/oboe/ob_fing.html): three octave keys, a
 * half-hole plate on the first finger, trill keys between the rings, side
 * keys and two little-finger tables.
 */

export const OBOE_KEY_IDS = [
  // Octave keys: I and III under the thumb, II beside the left index
  'OCT1',
  'OCT3',
  'OCT2',
  // Left hand rings and the trill keys between them
  'L1',
  'TR_B',
  'TR_D_L',
  'L2',
  'TR_CSHARP',
  'L3',
  // Left pinky
  'L_GSHARP',
  'L_EB',
  'L_B',
  'L_BB',
  'L_F',
  // Right side keys
  'SIDE_A',
  'SIDE_GSHARP',
  // Right hand rings, the D trill and F keys, and the banana key
  'R1',
  'TR_D_R',
  'R2',
  'R_F',
  'R3',
  'BANANA',
  // Right pinky
  'R_C',
  'R_CSHARP',
  'R_EB',
] as const

export type OboeKeyId = (typeof OBOE_KEY_IDS)[number]

export const OBOE_KEYS: readonly InstrumentKey[] = [
  { id: 'OCT1', label: 'I', name: 'First octave key (thumb)', hand: 'left', group: 'thumb', shape: 'lever' },
  {
    id: 'OCT3',
    label: 'III',
    name: 'Third octave key (thumb)',
    hand: 'left',
    group: 'thumb',
    shape: 'lever',
    requires: 'thirdOctaveKey',
  },
  { id: 'OCT2', label: 'II', name: 'Second octave key (side)', hand: 'left', group: 'leftSide', shape: 'lever' },

  { id: 'L1', label: '1', name: 'Left index (half-hole plate)', hand: 'left', group: 'leftStack', shape: 'hole' },
  { id: 'TR_B', label: 'B', name: 'B trill key', hand: 'left', group: 'trill', shape: 'lever' },
  { id: 'TR_D_L', label: 'D', name: 'Left D trill key', hand: 'left', group: 'trill', shape: 'lever' },
  { id: 'L2', label: '2', name: 'Left middle', hand: 'left', group: 'leftStack', shape: 'hole' },
  { id: 'TR_CSHARP', label: 'C♯', name: 'C♯ trill key', hand: 'left', group: 'trill', shape: 'lever' },
  { id: 'L3', label: '3', name: 'Left ring', hand: 'left', group: 'leftStack', shape: 'hole' },

  { id: 'L_GSHARP', label: 'G♯', name: 'Left pinky G♯ key', hand: 'left', group: 'leftPinky', shape: 'lever' },
  { id: 'L_EB', label: 'E♭', name: 'Left pinky E♭ key', hand: 'left', group: 'leftPinky', shape: 'lever' },
  { id: 'L_B', label: 'B', name: 'Low B key', hand: 'left', group: 'leftPinky', shape: 'lever' },
  { id: 'L_BB', label: 'B♭', name: 'Low B♭ key', hand: 'left', group: 'leftPinky', shape: 'lever', requires: 'lowBb' },
  { id: 'L_F', label: 'F', name: 'Left F key', hand: 'left', group: 'leftPinky', shape: 'lever', requires: 'leftF' },

  { id: 'SIDE_A', label: 'A', name: 'Side A key', hand: 'right', group: 'rightSide', shape: 'lever' },
  { id: 'SIDE_GSHARP', label: 'G♯', name: 'Side G♯ key', hand: 'right', group: 'rightSide', shape: 'lever' },

  { id: 'R1', label: '4', name: 'Right index', hand: 'right', group: 'rightStack', shape: 'hole' },
  { id: 'TR_D_R', label: 'D', name: 'Right D trill key', hand: 'right', group: 'trill', shape: 'lever' },
  { id: 'R2', label: '5', name: 'Right middle', hand: 'right', group: 'rightStack', shape: 'hole' },
  { id: 'R_F', label: 'F', name: 'Forked F key', hand: 'right', group: 'rightStack', shape: 'lever' },
  { id: 'R3', label: '6', name: 'Right ring', hand: 'right', group: 'rightStack', shape: 'hole' },
  { id: 'BANANA', label: 'c', name: 'Banana key (alternate C)', hand: 'right', group: 'rightStack', shape: 'lever' },

  { id: 'R_C', label: 'C', name: 'Right pinky low C key', hand: 'right', group: 'rightPinky', shape: 'lever' },
  { id: 'R_CSHARP', label: 'C♯', name: 'Right pinky low C♯ key', hand: 'right', group: 'rightPinky', shape: 'lever' },
  { id: 'R_EB', label: 'E♭', name: 'Right pinky E♭ key', hand: 'right', group: 'rightPinky', shape: 'lever' },
]

/**
 * The right little finger holds one key at a time. The left one doesn't: the
 * charts roll it across G♯ and E♭ together for some high notes.
 */
export const OBOE_EXCLUSIVE_GROUPS: readonly KeyGroup[] = ['rightPinky']
