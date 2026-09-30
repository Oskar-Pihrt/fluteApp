/**
 * Ear training: question generation, grading and level progression.
 *
 * Deliberately independent of the selected instrument. Everything here is
 * concert pitch as MIDI numbers, since the trainer plays a piano rather than
 * the flute or sax, and knowing what you hear is the same skill whatever you
 * play. Kept free of Vue and audio so it can be tested directly.
 */

export type Mode = 'note' | 'interval' | 'reference'
export type Direction = 'up' | 'down'

export const MODES: readonly Mode[] = ['note', 'interval', 'reference']

/** C3–C6. Must match the samples rendered by scripts/render-piano-samples.mjs. */
export const RANGE = { low: 48, high: 84 } as const

export interface Question {
  mode: Mode
  /** Everything that is played, in order — the reference note first, if any. */
  midis: number[]
  /** The note being asked about (the upper-or-lower target, not the reference). */
  target: number
  /** Pitch class 0–11 for note/reference modes; semitones 1–12 for intervals. */
  answer: number
  direction?: Direction
  /** The named starting note in reference mode, or the first note of an interval. */
  root?: number
}

export interface ItemStats {
  attempts: number
  correct: number
}

/** Per-item results, keyed by `answer` (pitch class or semitone count). */
export type ModeStats = Record<string, ItemStats>

/** Pitch classes, cumulative by level: triad, naturals, the two commonest accidentals, all. */
export const NOTE_LEVELS: readonly (readonly number[])[] = [
  [0, 4, 7],
  [0, 2, 4, 5, 7, 9, 11],
  [0, 2, 4, 5, 6, 7, 9, 10, 11],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
]

/**
 * Interval sizes in semitones, cumulative by level — the most distinct
 * intervals (octave, fifth, major third) first, the tritone last.
 */
export const INTERVAL_LEVELS: readonly (readonly number[])[] = [
  [4, 7, 12],
  [3, 4, 5, 7, 12],
  [2, 3, 4, 5, 7, 8, 9, 12],
  [1, 2, 3, 4, 5, 7, 8, 9, 10, 11, 12],
  [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
]

/** Intervals only descend from this level on; earlier levels ascend. */
export const DESCENDING_FROM_LEVEL = 3

export const INTERVAL_NAMES: Record<number, { short: string; long: string }> = {
  1: { short: 'm2', long: 'Minor 2nd' },
  2: { short: 'M2', long: 'Major 2nd' },
  3: { short: 'm3', long: 'Minor 3rd' },
  4: { short: 'M3', long: 'Major 3rd' },
  5: { short: 'P4', long: 'Perfect 4th' },
  6: { short: 'TT', long: 'Tritone' },
  7: { short: 'P5', long: 'Perfect 5th' },
  8: { short: 'm6', long: 'Minor 6th' },
  9: { short: 'M6', long: 'Major 6th' },
  10: { short: 'm7', long: 'Minor 7th' },
  11: { short: 'M7', long: 'Major 7th' },
  12: { short: 'P8', long: 'Octave' },
}

/** How many answers the unlock check looks at, and how many must be right. */
export const UNLOCK_WINDOW = 20
export const UNLOCK_CORRECT = 16

export function levelsFor(mode: Mode): readonly (readonly number[])[] {
  return mode === 'interval' ? INTERVAL_LEVELS : NOTE_LEVELS
}

/** The answer choices at a 1-based level, clamped to the levels that exist. */
export function itemsAt(mode: Mode, level: number): readonly number[] {
  const levels = levelsFor(mode)
  return levels[Math.min(Math.max(level, 1), levels.length) - 1]
}

/** Share of wrong answers; an item never asked counts as a coin flip. */
function missRate(stats: ItemStats | undefined): number {
  if (!stats || stats.attempts === 0) return 0.5
  return 1 - stats.correct / stats.attempts
}

/** Weighted draw favouring items the player gets wrong. */
export function pickItem(items: readonly number[], stats: ModeStats, rng: () => number = Math.random): number {
  const weights = items.map((item) => 1 + 3 * missRate(stats[item]))
  const total = weights.reduce((a, b) => a + b, 0)
  let r = rng() * total
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]
    if (r < 0) return items[i]
  }
  return items[items.length - 1]
}

/** Uniform integer in [low, high]. */
function randomInt(low: number, high: number, rng: () => number): number {
  return low + Math.floor(rng() * (high - low + 1))
}

/** A random MIDI note in range with the given pitch class. */
function randomWithPitchClass(pc: number, rng: () => number): number {
  const candidates: number[] = []
  for (let midi = RANGE.low; midi <= RANGE.high; midi++) if (midi % 12 === pc) candidates.push(midi)
  return candidates[randomInt(0, candidates.length - 1, rng)]
}

export function generateQuestion(
  mode: Mode,
  level: number,
  stats: ModeStats,
  rng: () => number = Math.random,
): Question {
  const answer = pickItem(itemsAt(mode, level), stats, rng)

  if (mode === 'interval') {
    const direction: Direction = level >= DESCENDING_FROM_LEVEL && rng() < 0.5 ? 'down' : 'up'
    const root =
      direction === 'up'
        ? randomInt(RANGE.low, RANGE.high - answer, rng)
        : randomInt(RANGE.low + answer, RANGE.high, rng)
    const target = direction === 'up' ? root + answer : root - answer
    return { mode, midis: [root, target], target, answer, direction, root }
  }

  const target = randomWithPitchClass(answer, rng)
  if (mode === 'note') return { mode, midis: [target], target, answer }

  // Reference: a named note within an octave, never the target itself.
  const low = Math.max(RANGE.low, target - 12)
  const high = Math.min(RANGE.high, target + 12)
  let root = randomInt(low, high - 1, rng)
  if (root >= target) root++
  return { mode, midis: [root, target], target, answer, root }
}

export function isCorrect(question: Question, answer: number): boolean {
  return question.answer === answer
}

/** Move a note by octaves until it is inside the sample range. */
function intoRange(midi: number): number {
  while (midi > RANGE.high) midi -= 12
  while (midi < RANGE.low) midi += 12
  return midi
}

/**
 * What the player's (wrong) answer would have sounded like, for comparison:
 * the chosen pitch class next to the target, or the chosen interval from the
 * same root in the same direction. Shifted by an octave if it would fall
 * outside the samples.
 */
export function answerMidis(question: Question, answer: number): number[] {
  if (question.mode === 'interval') {
    const sign = question.direction === 'down' ? -1 : 1
    let root = question.root ?? question.midis[0]
    let other = root + sign * answer
    if (other > RANGE.high) {
      root -= 12
      other -= 12
    } else if (other < RANGE.low) {
      root += 12
      other += 12
    }
    return [root, other]
  }
  const midi = intoRange(question.target - question.answer + answer)
  return question.mode === 'reference' && question.root != null ? [question.root, midi] : [midi]
}

/** The next level unlocks once most of the recent answers at the top level were right. */
export function shouldUnlockNextLevel(mode: Mode, unlockedLevel: number, recent: readonly boolean[]): boolean {
  if (unlockedLevel >= levelsFor(mode).length) return false
  const window = recent.slice(-UNLOCK_WINDOW)
  return window.length >= UNLOCK_WINDOW && window.filter(Boolean).length >= UNLOCK_CORRECT
}
