/**
 * What a key *is*, independent of which instrument it belongs to.
 *
 * A fingering is modelled as nothing more than *the set of keys held down*.
 * That single decision drives everything else in the app: the interactive
 * chart emits a set, the lookup matches sets, the library renders sets.
 *
 * Each instrument lists its own keys (`src/instruments/<id>/keys.ts`), so a
 * key id is just a string. Where a key plays the same role on several
 * instruments — the six main finger keys, the left pinky G♯ — the id is
 * shared, which is harmless because a fingering is only ever matched against
 * fingerings of its own instrument.
 *
 * This module describes the instrument, not the diagram — where each key is
 * drawn is the instrument's chart layout's business.
 */

export type KeyId = string

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
  | 'leftSide'
  | 'rightThumb'

/** Visual shape, so the chart can distinguish tone holes from lever keys. */
export type KeyShape = 'hole' | 'lever'

/**
 * Optional hardware a fingering can depend on. The player's instrument setup
 * is the set of these they have; a fingering is playable when its
 * requirements are all covered.
 */
export type Requirement = 'bFoot' | 'openHole' | 'highFSharp' | 'lowA' | 'leftAb' | 'leftBb' | 'lowC' | 'lowBb' | 'leftF' | 'thirdOctaveKey'

export interface InstrumentKey {
  id: KeyId
  /** Short label, e.g. "B♭", "G♯", "T". */
  label: string
  /** Long name used in tooltips and accessibility labels. */
  name: string
  /** `both` for keys no single hand owns, like a valve block. */
  hand: 'left' | 'right' | 'both'
  group: KeyGroup
  shape: KeyShape
  /** Set when the key only exists on some instruments of this kind. */
  requires?: Requirement
}

export function keysInGroup(keys: readonly InstrumentKey[], group: KeyGroup): KeyId[] {
  return keys.filter((k) => k.group === group).map((k) => k.id)
}

/**
 * A key set in the instrument's canonical order (`order` is its key ids, in
 * order), so two equal fingerings always serialise identically.
 */
export function sortKeys(keys: readonly KeyId[], order: readonly KeyId[]): KeyId[] {
  const rank = new Map(order.map((id, i) => [id, i]))
  return [...new Set(keys)].sort((a, b) => (rank.get(a) ?? Infinity) - (rank.get(b) ?? Infinity))
}

/**
 * Stable string form of a key set — used as a lookup map index. Sorted
 * alphabetically, so it needs no instrument; it is never shown or stored.
 */
export function keySetId(keys: readonly KeyId[]): string {
  return [...new Set(keys)].sort().join('+') || 'OPEN'
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
