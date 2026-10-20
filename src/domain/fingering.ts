import { Note } from 'tonal'
import type { InstrumentId } from '@/instruments/types'
import { type InstrumentKey, type KeyId, type Requirement, sortKeys } from './keys'

/**
 * Fingerings are authored as compact chart codes rather than key arrays, so an
 * entry can be eyeballed against a printed chart without mental decoding.
 * Woodwinds share one shape:
 *
 *     "T 123 G# | 123 Eb"
 *      │  │   │    │   └── right-hand extra keys
 *      │  │   │    └────── right hand: index, middle, ring (some have more)
 *      │  │   └─────────── left-hand extra keys
 *      │  └─────────────── left hand: index, middle, ring
 *      └────────────────── left thumb (absent when the instrument has none)
 *
 * Within a hand group each position is one character:
 *   its own digit — finger down, tone hole covered
 *   '-'           — finger off
 *   '0'           — key ring depressed but tone hole left open (open-hole flutes)
 *   'h'           — tone hole half covered (recorders, whistles)
 *
 * '0' and 'h' both mark the key as *partial*; what that means on the
 * instrument is its `partialLabel`. Which tokens exist for the thumb and the
 * extra keys is the instrument's `CodeGrammar`. Notation follows The Woodwind
 * Fingering Guide (wfg.woodwind.org), which is also where the seeded data
 * comes from. Instruments whose codes look nothing like this (brass) bring
 * their own parser.
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
  /** Keys only partly closed ('0' or 'h' positions) — see `partialLabel`. */
  partial: KeyId[]
  /** Optional hardware the fingering needs, e.g. a B footjoint. */
  requires: Requirement[]
}

/** The tokens an instrument's woodwind chart codes are written with. */
export interface CodeGrammar {
  /**
   * Leading token of the left hand; `null` means the thumb is off, a list
   * that it presses several keys at once (the clarinet's `RT`: register key
   * and thumb hole). Omitted for instruments with no thumb key or hole, whose
   * codes start with the finger group.
   */
  thumb?: Readonly<Record<string, KeyId | readonly KeyId[] | null>>
  /** Thumb tokens that half cover a key — the recorder's pinched `t`. */
  thumbPartial?: Readonly<Record<string, KeyId>>
  /** Holes or keys under each hand's fingers, top to bottom. */
  leftStack: readonly KeyId[]
  rightStack: readonly KeyId[]
  /**
   * The digit of the right hand's first position: 1 by default ("123"),
   * 4 where charts number the holes on through the right hand ("4567").
   */
  rightFirstDigit?: number
  /** Extra-key tokens allowed after each hand's finger group. */
  leftAux: Readonly<Record<string, KeyId>>
  rightAux: Readonly<Record<string, KeyId>>
}

export interface ParsedCode {
  keys: KeyId[]
  partial: KeyId[]
}

/** Turns one chart code into the keys it holds. Throws on anything malformed. */
export type CodeParser = (code: string) => ParsedCode

interface ParsedGroup {
  pressed: KeyId[]
  partial: KeyId[]
}

function parseStackGroup(group: string, stack: readonly KeyId[], code: string, firstDigit = 1): ParsedGroup {
  if (group.length !== stack.length || !/^[-0-9h]+$/.test(group)) {
    throw new Error(
      `Bad finger group "${group}" in fingering code "${code}" — expected ${stack.length} positions`,
    )
  }
  const pressed: KeyId[] = []
  const partial: KeyId[] = []
  for (let i = 0; i < stack.length; i++) {
    const ch = group[i]
    if (ch === '-') continue
    if (ch === '0' || ch === 'h') {
      partial.push(stack[i])
      continue
    }
    if (ch !== String(i + firstDigit)) {
      throw new Error(
        `Finger digit "${ch}" is in position ${i + 1} of group "${group}" in "${code}" — ` +
          `each position must hold its own digit, '-', '0' or 'h'`,
      )
    }
    pressed.push(stack[i])
  }
  return { pressed, partial }
}

/**
 * Parse a woodwind chart code. `order` is the instrument's canonical key
 * order, which the result is sorted into.
 */
export function parseFingeringCode(code: string, grammar: CodeGrammar, order: readonly KeyId[]): ParsedCode {
  const halves = code.split('|')
  if (halves.length !== 2) {
    throw new Error(`Fingering code "${code}" must contain exactly one "|" separator`)
  }

  const leftTokens = halves[0].trim().split(/\s+/).filter(Boolean)
  const rightTokens = halves[1].trim().split(/\s+/).filter(Boolean)

  const needed = grammar.thumb ? 2 : 1
  if (leftTokens.length < needed) {
    throw new Error(
      `Left hand of "${code}" needs ${grammar.thumb ? 'a thumb token and ' : ''}a finger group`,
    )
  }
  if (rightTokens.length < 1) {
    throw new Error(`Right hand of "${code}" needs a finger group`)
  }

  const keys: KeyId[] = []
  const partial: KeyId[] = []

  // Left thumb. A thumb token is only read in this leading position, so the
  // same spelling can mean something else among the extra keys (the flute's
  // `B` is the thumb lever here and the low-B foot key on the right).
  if (grammar.thumb) {
    const thumbToken = leftTokens.shift()!
    const halfThumb = grammar.thumbPartial?.[thumbToken]
    if (halfThumb) {
      partial.push(halfThumb)
    } else {
      if (!(thumbToken in grammar.thumb)) {
        throw new Error(`Unknown thumb token "${thumbToken}" in "${code}"`)
      }
      const thumbKeys = grammar.thumb[thumbToken]
      if (thumbKeys) keys.push(...(typeof thumbKeys === 'string' ? [thumbKeys] : thumbKeys))
    }
  }

  const [leftGroup, ...leftAux] = leftTokens
  const left = parseStackGroup(leftGroup, grammar.leftStack, code)
  keys.push(...left.pressed)
  partial.push(...left.partial)

  const [rightGroup, ...rightAux] = rightTokens
  const right = parseStackGroup(rightGroup, grammar.rightStack, code, grammar.rightFirstDigit)
  keys.push(...right.pressed)
  partial.push(...right.partial)

  const aux: [string, Readonly<Record<string, KeyId>>][] = [
    ...leftAux.map((t) => [t, grammar.leftAux] as [string, Readonly<Record<string, KeyId>>]),
    ...rightAux.map((t) => [t, grammar.rightAux] as [string, Readonly<Record<string, KeyId>>]),
  ]
  for (const [token, table] of aux) {
    const key = table[token]
    if (!key) throw new Error(`Unknown key token "${token}" in "${code}"`)
    keys.push(key)
  }

  return { keys: sortKeys(keys, order), partial: sortKeys(partial, order) }
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
  parse: CodeParser
  keys: readonly InstrumentKey[]
  /** Prepended to every fingering id, so ids never collide across instruments. */
  idPrefix: string
  /** Hardware a partly closed key needs, e.g. open-hole flute keys. */
  partialRequires?: Requirement
}

/** Turn an authored spec into the resolved form the app uses. */
export function resolveFingering(
  spec: FingeringSpec,
  index: number,
  source: FingeringSource,
): Fingering {
  const { keys, partial } = source.parse(spec.code)
  const midi = Note.midi(spec.note)
  if (midi == null) {
    throw new Error(`Fingering ${index} has an unparseable note: "${spec.note}"`)
  }
  const requires = new Set<Requirement>()
  for (const id of keys) {
    const requirement = source.keys.find((k) => k.id === id)?.requires
    if (requirement) requires.add(requirement)
  }
  if (partial.length && source.partialRequires) requires.add(source.partialRequires)
  return {
    ...spec,
    // `keys` is already in the instrument's canonical order. Saved sheets
    // store these ids, so that order must never change for an existing
    // instrument.
    id: `${source.idPrefix}${spec.note}:${spec.kind}:${keys.join('+') || 'OPEN'}`,
    instrument: source.id,
    midi,
    keys,
    partial,
    requires: [...requires],
  }
}
