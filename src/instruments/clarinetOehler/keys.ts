import type { InstrumentKey, KeyGroup } from '@/domain/keys'

/**
 * The keys of an Oehler-system (German) clarinet. Names follow The Woodwind
 * Fingering Guide's key scheme (wfg.woodwind.org/clarinet/cl_fing.html). The
 * "alternate" key closed by the right-hand rings isn't pressed directly, so
 * it isn't drawn.
 */

export const CLARINET_OEHLER_KEY_IDS = [
  // Left thumb
  'REGISTER',
  'THUMB',
  // Left index: throat A and side G♯
  'L_A',
  'L_GSHARP',
  // Left hand rings, with the F/C sliver after 1 and the E♭/B♭ sliver after 2
  'L1',
  'L_F',
  'L2',
  'L_EB',
  'L3',
  // Left pinky
  'L_CSHARP',
  'L_E',
  'L_FSHARP',
  'L_BB',
  'L_AB',
  // Right side keys
  'SIDE_1',
  'SIDE_2',
  'SIDE_3',
  'SIDE_4',
  // Right hand rings, with the B♭/F sliver between 2 and 3
  'R1',
  'R2',
  'R_BB',
  'R3',
  // Right pinky
  'R_AB',
  'R_F',
] as const

export type ClarinetOehlerKeyId = (typeof CLARINET_OEHLER_KEY_IDS)[number]

export const CLARINET_OEHLER_KEYS: readonly InstrumentKey[] = [
  { id: 'REGISTER', label: 'R', name: 'Register key', hand: 'left', group: 'thumb', shape: 'lever' },
  { id: 'THUMB', label: 'T', name: 'Thumb hole', hand: 'left', group: 'thumb', shape: 'hole' },

  { id: 'L_A', label: 'A', name: 'Throat A key', hand: 'left', group: 'leftSide', shape: 'lever' },
  { id: 'L_GSHARP', label: 'G♯', name: 'Side G♯ key', hand: 'left', group: 'leftSide', shape: 'lever' },

  { id: 'L1', label: '1', name: 'Left index', hand: 'left', group: 'leftStack', shape: 'hole' },
  { id: 'L_F', label: 'F', name: 'F/C sliver key', hand: 'left', group: 'leftStack', shape: 'lever' },
  { id: 'L2', label: '2', name: 'Left middle', hand: 'left', group: 'leftStack', shape: 'hole' },
  { id: 'L_EB', label: 'E♭', name: 'E♭/B♭ sliver key', hand: 'left', group: 'leftStack', shape: 'lever' },
  { id: 'L3', label: '3', name: 'Left ring', hand: 'left', group: 'leftStack', shape: 'hole' },

  { id: 'L_CSHARP', label: 'C♯', name: 'Left pinky C♯/G♯ key', hand: 'left', group: 'leftPinky', shape: 'lever' },
  { id: 'L_E', label: 'E', name: 'Left pinky low E/B key', hand: 'left', group: 'leftPinky', shape: 'lever' },
  { id: 'L_FSHARP', label: 'F♯', name: 'Left pinky low F♯/C♯ key', hand: 'left', group: 'leftPinky', shape: 'lever' },
  {
    id: 'L_BB',
    label: 'B♭',
    name: 'Left pinky B♭/F key',
    hand: 'left',
    group: 'leftPinky',
    shape: 'lever',
    requires: 'leftBb',
  },
  {
    id: 'L_AB',
    label: 'A♭',
    name: 'Left pinky A♭/E♭ key',
    hand: 'left',
    group: 'leftPinky',
    shape: 'lever',
    requires: 'leftAb',
  },

  { id: 'SIDE_1', label: '1', name: 'First side key', hand: 'right', group: 'rightSide', shape: 'lever' },
  { id: 'SIDE_2', label: '2', name: 'Second side key', hand: 'right', group: 'rightSide', shape: 'lever' },
  { id: 'SIDE_3', label: '3', name: 'Third side key', hand: 'right', group: 'rightSide', shape: 'lever' },
  { id: 'SIDE_4', label: '4', name: 'Fourth side key (E♭/B♭)', hand: 'right', group: 'rightSide', shape: 'lever' },

  { id: 'R1', label: '4', name: 'Right index', hand: 'right', group: 'rightStack', shape: 'hole' },
  { id: 'R2', label: '5', name: 'Right middle', hand: 'right', group: 'rightStack', shape: 'hole' },
  { id: 'R_BB', label: 'B♭', name: 'B♭/F sliver key', hand: 'right', group: 'rightStack', shape: 'lever' },
  { id: 'R3', label: '6', name: 'Right ring', hand: 'right', group: 'rightStack', shape: 'hole' },

  { id: 'R_AB', label: 'A♭', name: 'Right pinky A♭/E♭ key', hand: 'right', group: 'rightPinky', shape: 'lever' },
  { id: 'R_F', label: 'F', name: 'Right pinky low F/C key', hand: 'right', group: 'rightPinky', shape: 'lever' },
]

export const CLARINET_OEHLER_EXCLUSIVE_GROUPS: readonly KeyGroup[] = ['leftPinky', 'rightPinky']
