import { Note } from 'tonal'
import type { InstrumentId } from '@/instruments/types'
import { type InstrumentKey, type KeyId, type Requirement, keySetId, sortKeys } from './keys'

/**
 * Fingerings are authored as compact chart codes rather than key arrays, so an
 * entry can be eyeballed against a printed chart without mental decoding. Every
 * instrument uses the same shape:
 *
 *     "T 123 G# | 123 Eb"
 *      │  │   │    │   └── right-hand extra keys
 *      │  │   │    └────── right hand: index, middle, ring
 *      │  │   └─────────── left-hand extra keys
 *      │  └─────────────── left hand: index, middle, ring
 *      └────────────────── left thumb
 *
 * Within a hand group each position is one character:
 *   its own digit — finger down, tone hole covered
 *   '-'           — finger off
 *   '0'           — key ring depressed but tone hole left open (open-hole flutes)
 *
 * Which tokens exist for the thumb and the extra keys is the instrument's
 * `CodeGrammar`. Notation follows The Woodwind Fingering Guide
 * (wfg.woodwind.org), which is also where the seeded data comes from.
 */

export type FingeringKind = 'primary' | 'alternate' | 'trill' | 'harmonic'

/** What gets authored in the data file. */
export interface FingeringSpec {
  /** Scientific pitch, sharps preferred: "C4", "F#5", "A#6". Written pitch. */
  note: string
  code: string
  kind: FingeringKind
  comment?: string
  /**
   * Set when the source transcription was ambiguous and a player should
   * confirm the fingering. Surfaced as a badge in the note library.
   */
  verify?: string
}

/** What the rest of the app consumes. */
export interface Fingering extends FingeringSpec {
  id: string
  instrument: InstrumentId
  midi: number
  /** Keys held down, in canonical order. */
  keys: KeyId[]
  /** Keys whose ring is depressed but tone hole left open ('0' positions). */
  vented: KeyId[]
  /** Optional hardware the fingering needs, e.g. a B footjoint. */
  requires: Requirement[]
}

/** The tokens an instrument's chart codes are written with. */
export interface CodeGrammar {
  /** Leading token of the left hand; `null` means the thumb is off. */
  thumb: Readonly<Record<string, KeyId | null>>
  leftStack: readonly [KeyId, KeyId, KeyId]
  rightStack: readonly [KeyId, KeyId, KeyId]
  /** Extra-key tokens allowed after each hand's finger group. */
  leftAux: Readonly<Record<string, KeyId>>
  rightAux: Readonly<Record<string, KeyId>>
}

const STACK_GROUP = /^[-0123]{3}$/

interface ParsedGroup {
  pressed: KeyId[]
  vented: KeyId[]
}

function parseStackGroup(group: string, stack: readonly KeyId[], code: string): ParsedGroup {
  if (!STACK_GROUP.test(group)) {
    throw new Error(`Bad finger group "${group}" in fingering code "${code}"`)
  }
  const pressed: KeyId[] = []
  const vented: KeyId[] = []
  for (let i = 0; i < 3; i++) {
    const ch = group[i]
    if (ch === '-') continue
    if (ch === '0') {
      vented.push(stack[i])
      continue
    }
    if (ch !== String(i + 1)) {
      throw new Error(
        `Finger digit "${ch}" is in position ${i + 1} of group "${group}" in "${code}" — ` +
          `each position must hold its own digit, '-' or '0'`,
      )
    }
    pressed.push(stack[i])
  }
  return { pressed, vented }
}

export interface ParsedCode {
  keys: KeyId[]
  vented: KeyId[]
}

export function parseFingeringCode(code: string, grammar: CodeGrammar): ParsedCode {
  const halves = code.split('|')
  if (halves.length !== 2) {
    throw new Error(`Fingering code "${code}" must contain exactly one "|" separator`)
  }

  const leftTokens = halves[0].trim().split(/\s+/).filter(Boolean)
  const rightTokens = halves[1].trim().split(/\s+/).filter(Boolean)

  if (leftTokens.length < 2) {
    throw new Error(`Left hand of "${code}" needs a thumb token and a finger group`)
  }
  if (rightTokens.length < 1) {
    throw new Error(`Right hand of "${code}" needs a finger group`)
  }

  const keys: KeyId[] = []
  const vented: KeyId[] = []

  // Left thumb. A thumb token is only read in this leading position, so the
  // same spelling can mean something else among the extra keys (the flute's
  // `B` is the thumb lever here and the low-B foot key on the right).
  const [thumbToken, leftGroup, ...leftAux] = leftTokens
  if (!(thumbToken in grammar.thumb)) {
    throw new Error(`Unknown thumb token "${thumbToken}" in "${code}"`)
  }
  const thumbKey = grammar.thumb[thumbToken]
  if (thumbKey) keys.push(thumbKey)

  const left = parseStackGroup(leftGroup, grammar.leftStack, code)
  keys.push(...left.pressed)
  vented.push(...left.vented)

  const [rightGroup, ...rightAux] = rightTokens
  const right = parseStackGroup(rightGroup, grammar.rightStack, code)
  keys.push(...right.pressed)
  vented.push(...right.vented)

  const aux: [string, Readonly<Record<string, KeyId>>][] = [
    ...leftAux.map((t) => [t, grammar.leftAux] as [string, Readonly<Record<string, KeyId>>]),
    ...rightAux.map((t) => [t, grammar.rightAux] as [string, Readonly<Record<string, KeyId>>]),
  ]
  for (const [token, table] of aux) {
    const key = table[token]
    if (!key) throw new Error(`Unknown key token "${token}" in "${code}"`)
    keys.push(key)
  }

  return { keys: sortKeys(keys), vented: sortKeys(vented) }
}

/**
 * Chart notation with real accidental glyphs: "T 1-- | 1-- E♭".
 * Only key tokens ending in a note name with an accidental are rewritten
 * ("Eb", "sBb", "hF#") — the dashes, digits and other tokens are left alone.
 */
export function prettyCode(code: string): string {
  return code.replace(/(?<=^|\s)([a-z]*[A-G])([#b])(?=\s|$)/g, (_, name: string, acc: string) =>
    name + (acc === '#' ? '♯' : '♭'),
  )
}

/** What `resolveFingering` needs to know about the instrument. */
export interface FingeringSource {
  id: InstrumentId
  grammar: CodeGrammar
  keys: readonly InstrumentKey[]
  /** Prepended to every fingering id, so ids never collide across instruments. */
  idPrefix: string
}

/** Turn an authored spec into the resolved form the app uses. */
export function resolveFingering(
  spec: FingeringSpec,
  index: number,
  source: FingeringSource,
): Fingering {
  const { keys, vented } = parseFingeringCode(spec.code, source.grammar)
  const midi = Note.midi(spec.note)
  if (midi == null) {
    throw new Error(`Fingering ${index} has an unparseable note: "${spec.note}"`)
  }
  const requires = new Set<Requirement>()
  for (const id of keys) {
    const requirement = source.keys.find((k) => k.id === id)?.requires
    if (requirement) requires.add(requirement)
  }
  if (vented.length) requires.add('openHole')
  return {
    ...spec,
    id: `${source.idPrefix}${spec.note}:${spec.kind}:${keySetId(keys)}`,
    instrument: source.id,
    midi,
    keys,
    vented,
    requires: [...requires],
  }
}
