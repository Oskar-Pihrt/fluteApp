import { Note } from 'tonal'
import { type KeyId, keySetId, sortKeys } from './keys'

/**
 * Fingerings are authored as compact chart codes rather than key arrays, so an
 * entry can be eyeballed against a printed chart without mental decoding:
 *
 *     "T 123 G# | 123 Eb"
 *      │  │   │    │   └── right pinky / trill / foot keys
 *      │  │   │    └────── right hand: index, middle, ring
 *      │  │   └─────────── left pinky G# key
 *      │  └─────────────── left hand: index, middle, ring
 *      └────────────────── left thumb: T (B natural lever), Bb (Briccialdi), - (off)
 *
 * Within a hand group each position is one character:
 *   its own digit — finger down, tone hole covered
 *   '-'           — finger off
 *   '0'           — key ring depressed but tone hole left open (open-hole flutes)
 *
 * Notation follows The Woodwind Fingering Guide (wfg.woodwind.org), which is
 * also where the seeded data comes from.
 */

export type FingeringKind = 'primary' | 'alternate' | 'trill' | 'harmonic'

/** What gets authored in the data file. */
export interface FingeringSpec {
  /** Scientific pitch, sharps preferred: "C4", "F#5", "A#6". */
  note: string
  code: string
  kind: FingeringKind
  comment?: string
  /**
   * Set when the source transcription was ambiguous and a flutist should
   * confirm the fingering. Surfaced as a badge in the note library.
   */
  verify?: string
}

/** What the rest of the app consumes. */
export interface Fingering extends FingeringSpec {
  id: string
  midi: number
  /** Keys held down, in canonical order. */
  keys: KeyId[]
  /** Keys whose ring is depressed but tone hole left open ('0' positions). */
  vented: KeyId[]
  /** 'B' when the fingering is only playable on a B-footjoint flute. */
  footJoint: 'any' | 'B'
  /** True when the fingering needs an open-hole (French) flute. */
  requiresOpenHole: boolean
}

const THUMB_TOKENS: Record<string, KeyId | null> = {
  T: 'THUMB_B',
  B: 'THUMB_B', // WFG writes both T and B for the B-natural thumb lever
  Bb: 'THUMB_BB',
  '-': null,
}

const AUX_TOKENS: Record<string, KeyId> = {
  'G#': 'L_GSHARP',
  Eb: 'R_EFLAT',
  'C#': 'FOOT_CSHARP',
  C: 'FOOT_C',
  B: 'FOOT_B',
  D: 'TRILL_D',
  'D#': 'TRILL_DSHARP',
  gz: 'GIZMO',
}

const LEFT_STACK: readonly KeyId[] = ['L1', 'L2', 'L3']
const RIGHT_STACK: readonly KeyId[] = ['R1', 'R2', 'R3']

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

export function parseFingeringCode(code: string): ParsedCode {
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

  // Left thumb. `B` is only a thumb alias in this leading position; in the
  // right-hand token list it means the low-B foot key.
  const [thumbToken, leftGroup, ...leftAux] = leftTokens
  if (!(thumbToken in THUMB_TOKENS)) {
    throw new Error(`Unknown thumb token "${thumbToken}" in "${code}"`)
  }
  const thumbKey = THUMB_TOKENS[thumbToken]
  if (thumbKey) keys.push(thumbKey)

  const left = parseStackGroup(leftGroup, LEFT_STACK, code)
  keys.push(...left.pressed)
  vented.push(...left.vented)

  const [rightGroup, ...rightAux] = rightTokens
  const right = parseStackGroup(rightGroup, RIGHT_STACK, code)
  keys.push(...right.pressed)
  vented.push(...right.vented)

  for (const token of [...leftAux, ...rightAux]) {
    const key = AUX_TOKENS[token]
    if (!key) throw new Error(`Unknown key token "${token}" in "${code}"`)
    keys.push(key)
  }

  return { keys: sortKeys(keys), vented: sortKeys(vented) }
}

/** Turn an authored spec into the resolved form the app uses. */
export function resolveFingering(spec: FingeringSpec, index: number): Fingering {
  const { keys, vented } = parseFingeringCode(spec.code)
  const midi = Note.midi(spec.note)
  if (midi == null) {
    throw new Error(`Fingering ${index} has an unparseable note: "${spec.note}"`)
  }
  return {
    ...spec,
    id: `${spec.note}:${spec.kind}:${keySetId(keys)}`,
    midi,
    keys,
    vented,
    footJoint: keys.includes('FOOT_B') || keys.includes('GIZMO') ? 'B' : 'any',
    requiresOpenHole: vented.length > 0,
  }
}
