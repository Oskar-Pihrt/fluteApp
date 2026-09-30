import type { InstrumentKey, KeyGroup } from '@/domain/keys'

/**
 * The keys of a modern tenor saxophone (B♭, with high F♯ key).
 *
 * The six main finger keys and the left pinky G♯ reuse the flute's ids — they
 * play the same role — while everything else is saxophone-only.
 */

export const TENOR_SAX_KEY_IDS = [
  // Left thumb
  'OCTAVE',
  // Left palm keys and front F (left index, above the stack)
  'PALM_D',
  'PALM_DSHARP',
  'PALM_F',
  'FRONT_F',
  // Left hand fingers, with the bis B♭ pearl between index and middle
  'L1',
  'BIS',
  'L2',
  'L3',
  // Left pinky: G♯ and the low-note table
  'L_GSHARP',
  'LOW_CSHARP',
  'LOW_B',
  'LOW_BB',
  // Right hand fingers
  'R1',
  'R2',
  'R3',
  // Right side keys (operated with the side of the right index / ring finger)
  'SIDE_BB',
  'SIDE_C',
  'SIDE_E',
  'HIGH_FSHARP',
  'ALT_FSHARP',
  // Right pinky
  'R_EFLAT',
  'LOW_C',
] as const

export const TENOR_SAX_KEYS: readonly InstrumentKey[] = [
  { id: 'OCTAVE', label: '8ve', name: 'Octave key (8ve)', hand: 'left', group: 'thumb', shape: 'lever' },

  { id: 'PALM_D', label: 'C1', name: 'Palm key D (C1)', hand: 'left', group: 'palm', shape: 'lever' },
  { id: 'PALM_DSHARP', label: 'C2', name: 'Palm key D♯ (C2)', hand: 'left', group: 'palm', shape: 'lever' },
  { id: 'PALM_F', label: 'C4', name: 'Palm key F (C4)', hand: 'left', group: 'palm', shape: 'lever' },
  { id: 'FRONT_F', label: 'Aux', name: 'Front F key (Aux)', hand: 'left', group: 'palm', shape: 'lever' },

  { id: 'L1', label: '1', name: 'Left index (B)', hand: 'left', group: 'leftStack', shape: 'hole' },
  { id: 'BIS', label: 'Bis', name: 'Bis B♭ key', hand: 'left', group: 'leftStack', shape: 'lever' },
  { id: 'L2', label: '2', name: 'Left middle (A)', hand: 'left', group: 'leftStack', shape: 'hole' },
  { id: 'L3', label: '3', name: 'Left ring (G)', hand: 'left', group: 'leftStack', shape: 'hole' },

  { id: 'L_GSHARP', label: 'G♯', name: 'Left pinky G♯ key', hand: 'left', group: 'leftPinky', shape: 'lever' },
  { id: 'LOW_CSHARP', label: 'C♯', name: 'Left pinky low C♯ key', hand: 'left', group: 'leftPinkyTable', shape: 'lever' },
  { id: 'LOW_B', label: 'B', name: 'Left pinky low B key', hand: 'left', group: 'leftPinkyTable', shape: 'lever' },
  { id: 'LOW_BB', label: 'B♭', name: 'Left pinky low B♭ key', hand: 'left', group: 'leftPinkyTable', shape: 'lever' },

  { id: 'R1', label: '4', name: 'Right index (F)', hand: 'right', group: 'rightStack', shape: 'hole' },
  { id: 'R2', label: '5', name: 'Right middle (E)', hand: 'right', group: 'rightStack', shape: 'hole' },
  { id: 'R3', label: '6', name: 'Right ring (D)', hand: 'right', group: 'rightStack', shape: 'hole' },

  { id: 'SIDE_BB', label: 'TA', name: 'Side B♭ key (TA)', hand: 'right', group: 'rightSide', shape: 'lever' },
  { id: 'SIDE_C', label: 'TC', name: 'Side C key (TC)', hand: 'right', group: 'rightSide', shape: 'lever' },
  { id: 'SIDE_E', label: 'C3', name: 'Side high E key (C3)', hand: 'right', group: 'rightSide', shape: 'lever' },
  {
    id: 'HIGH_FSHARP',
    label: 'C5',
    name: 'High F♯ key (C5)',
    hand: 'right',
    group: 'rightSide',
    shape: 'lever',
    requires: 'highFSharp',
  },
  { id: 'ALT_FSHARP', label: 'TF', name: 'Fork F♯ key (TF)', hand: 'right', group: 'trill', shape: 'lever' },

  { id: 'R_EFLAT', label: 'E♭', name: 'Right pinky low E♭ key', hand: 'right', group: 'rightPinky', shape: 'lever' },
  { id: 'LOW_C', label: 'C', name: 'Right pinky low C key', hand: 'right', group: 'rightPinky', shape: 'lever' },
]

/**
 * One little finger per table: the right pinky chooses between E♭ and C, and
 * the left pinky between the three low keys. G♯ stands apart — it sits above
 * the table and is pressed on its own.
 */
export const TENOR_SAX_EXCLUSIVE_GROUPS: readonly KeyGroup[] = ['rightPinky', 'leftPinkyTable']
