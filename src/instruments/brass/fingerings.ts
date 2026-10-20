import { Note } from 'tonal'
import type { FingeringSpec, ParsedCode } from '@/domain/fingering'
import { sortKeys } from '@/domain/keys'

/**
 * Brass fingerings are generated rather than transcribed: a brass instrument
 * plays the notes of its harmonic series, and each valve (or slide position)
 * lowers the whole series by a fixed amount. Valve 2 lowers by a semitone,
 * valve 1 by a tone, valve 3 by three semitones, and they add; slide position
 * n lowers by n − 1 semitones, the F trigger by a fourth more.
 *
 * For each note, every combination that reaches it from a usable partial is a
 * fingering. The primary is the one with the least lowering — from the
 * nearest partial above — which is exactly how the standard charts are made
 * (written A4 on trumpet: C5 lowered three semitones, 1 2). Valve 3 alone is
 * offered as the alternate to 1 2, and the out-of-tune 7th, 11th, 13th and
 * 14th partials are left out.
 *
 * Everything is written pitch, in treble clef — B♭ trombone and euphonium as
 * brass bands write them.
 */

const midi = (note: string) => Note.midi(note)!

/** Valve combinations, by how far they lower, in order of preference among equals. */
const THREE_VALVES: readonly (readonly [string, number])[] = [
  ['0', 0],
  ['2', 1],
  ['1', 2],
  ['12', 3],
  ['3', 3],
  ['23', 4],
  ['13', 5],
  ['123', 6],
]

/** With a fourth valve (a fourth down) the low register fills in. */
const FOUR_VALVES: readonly (readonly [string, number])[] = [
  ...THREE_VALVES,
  ['4', 5],
  ['24', 6],
  ['14', 7],
  ['124', 8],
  ['234', 9],
  ['134', 10],
  ['1234', 11],
]

/** The written open notes of a B♭ trumpet's series (2nd–8th partials, without the 7th). */
export const TRUMPET_SERIES = ['C4', 'G4', 'C5', 'E5', 'G5', 'C6'].map(midi)

/** Horn in F, written: 3rd–16th partials without 7, 11, 13, 14 and 15. */
export const HORN_F_SERIES = ['G3', 'C4', 'E4', 'G4', 'C5', 'D5', 'E5', 'G5', 'C6'].map(midi)

/** The double horn's B♭ side, in the same F-horn notation: a fourth higher. */
export const HORN_BB_SERIES = ['F3', 'C4', 'F4', 'A4', 'C5', 'F5', 'G5', 'A5', 'C6'].map(midi)

interface Way {
  code: string
  lowering: number
  /** Order among equal lowerings, and between sides of a double horn. */
  rank: number
  comment?: string
}

interface Side {
  series: readonly number[]
  combos: readonly (readonly [string, number])[]
  /** Prefixed to every code from this side, e.g. "T " for the thumb valve. */
  prefix?: string
  /** Ranked after the other side for the primary. */
  secondary?: boolean
  comment?: string
}

/**
 * Every way to play every note from `low` to `high`, primary first. Throws if
 * a note can't be reached, so a gap in a range is a test failure, not a hole
 * in the library.
 */
export function generate(
  sides: readonly Side[],
  low: string,
  high: string,
  /** Primaries taken from a published chart instead of the rule, by note. */
  chart: Readonly<Record<string, string>> = {},
): FingeringSpec[] {
  const specs: FingeringSpec[] = []
  for (let note = midi(low); note <= midi(high); note++) {
    const ways: Way[] = []
    for (const side of sides) {
      for (const partial of side.series) {
        side.combos.forEach(([combo, lowering], index) => {
          if (partial - lowering !== note) return
          ways.push({
            code: `${side.prefix ?? ''}${combo}`,
            lowering,
            rank: (side.secondary ? 1000 : 0) + index,
            comment: side.comment,
          })
        })
      }
    }
    if (!ways.length) throw new Error(`No brass fingering reaches ${Note.fromMidiSharps(note)}`)
    ways.sort((a, b) => Number(a.rank >= 1000) - Number(b.rank >= 1000) || a.lowering - b.lowering || a.rank - b.rank)
    const charted = chart[Note.fromMidiSharps(note)]
    if (charted) {
      const index = ways.findIndex((way) => way.code === charted)
      if (index === -1) throw new Error(`Charted ${charted} doesn't reach ${Note.fromMidiSharps(note)}`)
      ways.unshift(...ways.splice(index, 1))
    }
    const seen = new Set<string>()
    for (const way of ways) {
      if (seen.has(way.code)) continue
      seen.add(way.code)
      specs.push({
        note: Note.fromMidiSharps(note),
        code: way.code,
        kind: seen.size === 1 ? 'primary' : 'alternate',
        ...(way.comment ? { comment: way.comment } : {}),
      })
    }
  }
  return specs
}

/** Slide positions as valve-like combinations: position n lowers n − 1. */
function positions(trigger: boolean): (readonly [string, number])[] {
  return trigger
    ? [1, 2, 3, 4, 5, 6].map((n) => [`F P${n}`, 5 + n - 1] as const)
    : [1, 2, 3, 4, 5, 6, 7].map((n) => [`P${n}`, n - 1] as const)
}

export const TRUMPET_SPECS = generate([{ series: TRUMPET_SERIES, combos: THREE_VALVES }], 'F#3', 'C6')

export const EUPHONIUM_SPECS = generate([{ series: TRUMPET_SERIES, combos: FOUR_VALVES }], 'C#3', 'C6')

export const HORN_F_SPECS = generate([{ series: HORN_F_SERIES, combos: THREE_VALVES }], 'C#3', 'C6')

/**
 * Where a double horn player uses which side is convention, not physics, so
 * the primaries follow a published chart: Mouthpiece Express's F-B♭ double
 * horn basic fingering chart — the B♭ side (thumb valve) for low C♯ to F and
 * from G♯ in the staff upward, the F side between. The rest of both sides are
 * alternates.
 */
const DOUBLE_HORN_CHART: Readonly<Record<string, string>> = {
  'C#3': 'T 23', D3: 'T 3', 'D#3': 'T 1', E3: 'T 2', F3: 'T 0',
  'F#3': '2', G3: '0', 'G#3': '23', A3: '12', 'A#3': '1', B3: '2',
  C4: '0', 'C#4': '12', D4: '1', 'D#4': '2', E4: '0', F4: '1', 'F#4': '2', G4: '0',
  'G#4': 'T 23', A4: 'T 12', 'A#4': 'T 1', B4: 'T 2', C5: 'T 0',
  'C#5': 'T 123', D5: 'T 12', 'D#5': 'T 1', E5: 'T 2', F5: 'T 0',
  'F#5': 'T 2', G5: 'T 0', 'G#5': 'T 23', A5: 'T 12', 'A#5': 'T 1', B5: 'T 2', C6: 'T 0',
}

export const DOUBLE_HORN_SPECS = generate(
  [
    { series: HORN_F_SERIES, combos: THREE_VALVES, comment: 'F side.' },
    { series: HORN_BB_SERIES, combos: THREE_VALVES, prefix: 'T ', secondary: true, comment: 'B♭ side.' },
  ],
  'C#3',
  'C6',
  DOUBLE_HORN_CHART,
)

export const TROMBONE_SPECS = generate(
  [
    { series: TRUMPET_SERIES, combos: positions(false) },
    { series: TRUMPET_SERIES, combos: positions(true), secondary: true, comment: 'With the F trigger.' },
  ],
  'D3',
  'C6',
)

/** Valve codes: "0", "13", "T 12" (thumb valve), "124". */
export function parseValves(code: string, order: readonly string[]): ParsedCode {
  const tokens = code.trim().split(/\s+/)
  const keys: string[] = []
  for (const token of tokens) {
    if (token === 'T') keys.push('THUMB_BB')
    else if (token === '0') continue
    else if (/^[1-4]+$/.test(token)) keys.push(...[...token].map((d) => `V${d}`))
    else throw new Error(`Bad valve token "${token}" in "${code}"`)
  }
  return { keys: sortKeys(keys, order), partial: [] }
}

/** Slide codes: "P3", "F P2" (trigger and position). */
export function parseSlide(code: string, order: readonly string[]): ParsedCode {
  const keys: string[] = []
  for (const token of code.trim().split(/\s+/)) {
    if (token === 'F') keys.push('TRIGGER')
    else if (/^P[1-7]$/.test(token)) keys.push(token)
    else throw new Error(`Bad slide token "${token}" in "${code}"`)
  }
  return { keys: sortKeys(keys, order), partial: [] }
}
