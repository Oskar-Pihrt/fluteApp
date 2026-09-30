import { FLUTE_KEY_IDS } from '@/instruments/flute/keys'
import { TENOR_SAX_KEY_IDS } from '@/instruments/tenorSax/keys'

/**
 * What a key *is*, independent of which instrument it belongs to.
 *
 * A fingering is modelled as nothing more than *the set of keys held down*.
 * That single decision drives everything else in the app: the interactive
 * chart emits a set, the lookup matches sets, the library renders sets.
 *
 * Each instrument lists its own keys (`src/instruments/<id>/keys.ts`). Where a
 * key plays the same role on both — the six main finger keys, the left pinky
 * G♯ — the id is shared, which is harmless because a fingering is only ever
 * matched against fingerings of its own instrument.
 *
 * This module describes the instrument, not the diagram — where each key is
 * drawn is the instrument's chart layout's business.
 */

export type FluteKeyId = (typeof FLUTE_KEY_IDS)[number]
export type TenorSaxKeyId = (typeof TENOR_SAX_KEY_IDS)[number]
export type KeyId = FluteKeyId | TenorSaxKeyId

/** Which finger operates the key. */
export type KeyGroup =
  | 'thumb'
  | 'palm'
  | 'leftStack'
  | 'leftPinky'
  | 'leftPinkyTable'
  | 'rightStack'
  | 'rightSide'
  | 'trill'
  | 'rightPinky'

/** Visual shape, so the chart can distinguish tone holes from lever keys. */
export type KeyShape = 'hole' | 'lever'

/**
 * Optional hardware a fingering can depend on. The player's instrument setup
 * is the set of these they have; a fingering is playable when its
 * requirements are all covered.
 */
export type Requirement = 'bFoot' | 'openHole' | 'highFSharp'

export interface InstrumentKey {
  id: KeyId
  /** Short label, e.g. "B♭", "G♯", "T". */
  label: string
  /** Long name used in tooltips and accessibility labels. */
  name: string
  hand: 'left' | 'right'
  group: KeyGroup
  shape: KeyShape
  /** Set when the key only exists on some instruments of this kind. */
  requires?: Requirement
}

export function keysInGroup(keys: readonly InstrumentKey[], group: KeyGroup): KeyId[] {
  return keys.filter((k) => k.group === group).map((k) => k.id)
}

/** Canonical ordering, so two equal fingerings always serialise identically. */
const KEY_ORDER = new Map<KeyId, number>(
  [...new Set<KeyId>([...FLUTE_KEY_IDS, ...TENOR_SAX_KEY_IDS])].map((id, i) => [id, i]),
)

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
