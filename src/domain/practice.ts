import { Note } from 'tonal'

/**
 * Daily practice: what to play today, and the streak that rewards playing it.
 *
 * Pure functions over a list of playable MIDI notes and calendar days, so the
 * whole plan is testable without an instrument loaded or a clock running. Days
 * are local calendar dates as "YYYY-MM-DD" strings — a streak is about the
 * player's days, not UTC ones.
 */

export type ExerciseId = 'longTones' | 'notes' | 'scale'

/** The daily training, in the order it is played. */
export const TRAINING: readonly ExerciseId[] = ['longTones', 'notes', 'scale']

export const EXERCISE_TITLES: Record<ExerciseId, string> = {
  longTones: 'Long tones',
  notes: 'Notes & fingerings',
  scale: 'Scale',
}

export interface Step {
  /** As shown to the player, spelled for the key: "B♭4" reads as "Bb4". */
  note: string
  midi: number
}

export const LONG_TONE_COUNT = 5
export const LONG_TONE_SECONDS = 8
/** A held note within this many cents counts as in tune. */
export const IN_TUNE_CENTS = 15
export const NOTES_COUNT = 20

// ── Days ────────────────────────────────────────────────────────────────────

export function dayOf(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Noon avoids a daylight-saving change moving the date. */
function parseDay(day: string): Date {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export function addDays(day: string, n: number): string {
  const date = parseDay(day)
  date.setDate(date.getDate() + n)
  return dayOf(date)
}

/** Whole days since 1970-01-01 — the seed that makes a day's plan repeatable. */
export function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
}

/**
 * Days in a row ending today — or yesterday, while today's training is still
 * to do, so the count doesn't drop to zero first thing in the morning.
 */
export function currentStreak(completed: ReadonlySet<string>, today: string): number {
  let day = completed.has(today) ? today : addDays(today, -1)
  let count = 0
  while (completed.has(day)) {
    count++
    day = addDays(day, -1)
  }
  return count
}

export type DayState = 'done' | 'missed' | 'today' | 'future'

/** Monday to Sunday of the week holding `today`. */
export function weekOf(completed: ReadonlySet<string>, today: string): { day: string; state: DayState }[] {
  const weekday = (parseDay(today).getDay() + 6) % 7
  const monday = addDays(today, -weekday)
  return Array.from({ length: 7 }, (_, i) => {
    const day = addDays(monday, i)
    const state: DayState = completed.has(day)
      ? 'done'
      : day === today
        ? 'today'
        : day > today
          ? 'future'
          : 'missed'
    return { day, state }
  })
}

// ── Exercises ───────────────────────────────────────────────────────────────

/**
 * Five long tones a semitone apart, starting from the middle of the range and
 * moving up one day and down the next, so both registers get their turn.
 */
export function longTones(range: readonly number[], day: string): Step[] {
  if (!range.length) return []
  const middle = Math.floor(range.length / 2)
  const up = dayNumber(day) % 2 === 0
  const start = up
    ? Math.min(middle, Math.max(0, range.length - LONG_TONE_COUNT))
    : Math.max(middle, Math.min(range.length - 1, LONG_TONE_COUNT - 1))
  const steps: Step[] = []
  for (let i = 0; i < LONG_TONE_COUNT; i++) {
    const index = up ? start + i : start - i
    if (index < 0 || index >= range.length) break
    steps.push(step(range[index]))
  }
  return steps
}

/** Per-note record of the notes drill: how often asked, how often fumbled. */
export type NoteStats = Record<string, { attempts: number; misses: number }>

/**
 * Notes for the drill, from the comfortable part of the range (the top fifth,
 * the hardest notes, is left out), favouring notes that were fumbled recently
 * and never repeating a note straight away.
 */
export function noteDrill(
  range: readonly number[],
  stats: NoteStats,
  rng: () => number,
  count = NOTES_COUNT,
): Step[] {
  const pool = range.slice(0, Math.max(1, Math.ceil(range.length * 0.8)))
  const steps: Step[] = []
  let previous: number | null = null
  for (let i = 0; i < count && pool.length; i++) {
    const candidates = pool.length > 1 ? pool.filter((midi) => midi !== previous) : pool
    const weights = candidates.map((midi) => {
      const s = stats[String(midi)]
      if (!s || s.attempts === 0) return 2
      return 1 + 4 * (s.misses / s.attempts)
    })
    let pick = rng() * weights.reduce((a, b) => a + b, 0)
    let chosen = candidates[candidates.length - 1]
    for (let j = 0; j < candidates.length; j++) {
      pick -= weights[j]
      if (pick < 0) {
        chosen = candidates[j]
        break
      }
    }
    steps.push(step(chosen))
    previous = chosen
  }
  return steps
}

export interface ScaleKey {
  /** Tonic pitch class as tonal spells it: "Bb", "F#". */
  tonic: string
  mode: 'major' | 'minor'
}

/** Keys in the order they are taken, fewest accidentals first, each major then its relative minor. */
export const SCALE_KEYS: readonly ScaleKey[] = [
  ['C', 'A'],
  ['G', 'E'],
  ['F', 'D'],
  ['D', 'B'],
  ['Bb', 'G'],
  ['A', 'F#'],
  ['Eb', 'C'],
  ['E', 'C#'],
  ['Ab', 'F'],
  ['B', 'G#'],
  ['Db', 'Bb'],
  ['F#', 'Eb'],
].flatMap(([major, minor]) => [
  { tonic: major, mode: 'major' as const },
  { tonic: minor, mode: 'minor' as const },
])

const INTERVALS = {
  major: [0, 2, 4, 5, 7, 9, 11, 12],
  minor: [0, 2, 3, 5, 7, 8, 10, 12],
} as const

const LETTERS = 'CDEFGAB'

export function scaleName(key: ScaleKey): string {
  return `${key.tonic.replace('b', '♭').replace('#', '♯')} ${key.mode}`
}

export function keyId(key: ScaleKey): string {
  return `${key.tonic}-${key.mode}`
}

/**
 * One octave up and back down, in the lowest octave of the range where the
 * whole scale is playable, spelled with one letter per degree. Null when the
 * instrument can't play this key across an octave.
 */
export function scaleSteps(key: ScaleKey, range: readonly number[]): Step[] | null {
  const playable = new Set(range)
  const tonicChroma = Note.chroma(key.tonic)
  if (tonicChroma == null || !range.length) return null
  const letter = LETTERS.indexOf(key.tonic[0])
  for (let base = range[0]; base <= range[range.length - 1]; base++) {
    if (base % 12 !== tonicChroma) continue
    const midis = INTERVALS[key.mode].map((i) => base + i)
    if (!midis.every((m) => playable.has(m))) continue
    const up = midis.map((midi, degree) => ({ note: spell(midi, LETTERS[(letter + degree) % 7]), midi }))
    return [...up, ...up.slice(0, -1).reverse()]
  }
  return null
}

/** The key for a day, cycling through those the instrument can play. */
export function scaleForDay(range: readonly number[], day: string): ScaleKey | null {
  const keys = SCALE_KEYS.filter((key) => scaleSteps(key, range))
  return keys.length ? keys[dayNumber(day) % keys.length] : null
}

/** Deterministic PRNG (mulberry32): the same day draws the same notes. */
export function seededRandom(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function step(midi: number): Step {
  return { note: Note.fromMidiSharps(midi), midi }
}

/** Spell `midi` on the given letter: (C, 61) → "C#4", (D, 61) → "Db4". */
function spell(midi: number, letter: string): string {
  const octaveGuess = Math.floor(midi / 12) - 1
  for (const octave of [octaveGuess, octaveGuess + 1, octaveGuess - 1]) {
    const natural = Note.midi(`${letter}${octave}`)
    if (natural == null) continue
    const offset = midi - natural
    if (Math.abs(offset) <= 2) {
      const accidental = offset > 0 ? '#'.repeat(offset) : 'b'.repeat(-offset)
      return `${letter}${accidental}${octave}`
    }
  }
  return Note.fromMidiSharps(midi)
}
