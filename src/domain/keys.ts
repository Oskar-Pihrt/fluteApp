/**
 * The physical keys of a standard Boehm-system transverse flute.
 *
 * A fingering is modelled as nothing more than *the set of keys held down*.
 * That single decision drives everything else in the app: the interactive
 * chart emits a set, the lookup matches sets, the library renders sets.
 *
 * This module describes the instrument, not the diagram — where each key is
 * drawn is `KeyChart.vue`'s business.
 */

export const KEY_IDS = [
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

export type KeyId = (typeof KEY_IDS)[number]

/** Which finger operates the key. */
export type KeyGroup =
  | 'thumb'
  | 'leftStack'
  | 'leftPinky'
  | 'rightStack'
  | 'trill'
  | 'rightPinky'

/** Visual shape, so the chart can distinguish tone holes from lever keys. */
export type KeyShape = 'hole' | 'lever'

export interface FluteKey {
  id: KeyId
  /** Short label drawn on the key, e.g. "B♭", "G♯", "T". */
  label: string
  /** Long name used in tooltips and accessibility labels. */
  name: string
  hand: 'left' | 'right'
  group: KeyGroup
  shape: KeyShape
  /** Set when the key only exists on a B-footjoint instrument. */
  requiresBFoot?: true
}

export const FLUTE_KEYS: readonly FluteKey[] = [
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
    requiresBFoot: true,
  },
  {
    id: 'GIZMO',
    label: 'gz',
    name: 'Gizmo key (B footjoint high C)',
    hand: 'right',
    group: 'rightPinky',
    shape: 'lever',
    requiresBFoot: true,
  },
]

/**
 * Groups where one finger serves several keys, so only one can be held at a
 * time. The interactive chart enforces this, and a test asserts the seeded data
 * never violates it.
 */
export const EXCLUSIVE_KEY_GROUPS: readonly KeyGroup[] = ['thumb', 'rightPinky']

const KEY_BY_ID = new Map<KeyId, FluteKey>(FLUTE_KEYS.map((k) => [k.id, k]))

export function getKey(id: KeyId): FluteKey {
  const key = KEY_BY_ID.get(id)
  if (!key) throw new Error(`Unknown flute key: ${id}`)
  return key
}

export function keysInGroup(group: KeyGroup): KeyId[] {
  return FLUTE_KEYS.filter((k) => k.group === group).map((k) => k.id)
}

/** Canonical ordering, so two equal fingerings always serialise identically. */
const KEY_ORDER = new Map<KeyId, number>(KEY_IDS.map((id, i) => [id, i]))

export function sortKeys(keys: readonly KeyId[]): KeyId[] {
  return [...new Set(keys)].sort((a, b) => KEY_ORDER.get(a)! - KEY_ORDER.get(b)!)
}

/** Stable string form of a key set — used as a lookup map index. */
export function keySetId(keys: readonly KeyId[]): string {
  return sortKeys(keys).join('+') || 'OPEN'
}

export function sameKeys(a: readonly KeyId[], b: readonly KeyId[]): boolean {
  return keySetId(a) === keySetId(b)
}

/** Number of keys that differ between two fingerings (symmetric difference). */
export function keyDistance(a: readonly KeyId[], b: readonly KeyId[]): number {
  const setA = new Set(a)
  const setB = new Set(b)
  let diff = 0
  for (const k of setA) if (!setB.has(k)) diff++
  for (const k of setB) if (!setA.has(k)) diff++
  return diff
}
