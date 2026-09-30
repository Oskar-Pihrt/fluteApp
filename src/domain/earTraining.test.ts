import { describe, expect, it } from 'vitest'
import {
  answerMidis,
  generateQuestion,
  INTERVAL_LEVELS,
  isCorrect,
  itemsAt,
  MODES,
  NOTE_LEVELS,
  pickItem,
  RANGE,
  shouldUnlockNextLevel,
  UNLOCK_WINDOW,
  type Question,
} from './earTraining'

/** Deterministic PRNG (mulberry32) so failures reproduce. */
function seeded(seed: number): () => number {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const inRange = (midi: number) => midi >= RANGE.low && midi <= RANGE.high

describe('levels', () => {
  it('are cumulative, each adding something new', () => {
    for (const levels of [NOTE_LEVELS, INTERVAL_LEVELS]) {
      for (let i = 1; i < levels.length; i++) {
        expect(levels[i].length).toBeGreaterThan(levels[i - 1].length)
        for (const item of levels[i - 1]) expect(levels[i]).toContain(item)
      }
    }
  })

  it('end with everything', () => {
    expect(NOTE_LEVELS.at(-1)).toHaveLength(12)
    expect(INTERVAL_LEVELS.at(-1)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('clamps out-of-range levels', () => {
    expect(itemsAt('note', 0)).toEqual(NOTE_LEVELS[0])
    expect(itemsAt('interval', 99)).toEqual(INTERVAL_LEVELS.at(-1))
  })
})

describe('generateQuestion', () => {
  const rng = seeded(42)

  for (const mode of MODES) {
    it(`keeps every ${mode} question inside C3–C6 and within the level`, () => {
      const levelCount = mode === 'interval' ? INTERVAL_LEVELS.length : NOTE_LEVELS.length
      for (let level = 1; level <= levelCount; level++) {
        for (let i = 0; i < 300; i++) {
          const q = generateQuestion(mode, level, {}, rng)
          expect(q.midis.every(inRange)).toBe(true)
          expect(itemsAt(mode, level)).toContain(q.answer)
          expect(q.midis.at(-1)).toBe(q.target)
        }
      }
    })
  }

  it('answers a note question with the pitch class of what was played', () => {
    for (let i = 0; i < 100; i++) {
      const q = generateQuestion('note', 4, {}, rng)
      expect(q.midis).toHaveLength(1)
      expect(q.target % 12).toBe(q.answer)
    }
  })

  it('answers an interval question with the distance between the two notes', () => {
    for (let i = 0; i < 200; i++) {
      const q = generateQuestion('interval', 5, {}, rng)
      const [a, b] = q.midis
      expect(Math.abs(b - a)).toBe(q.answer)
      expect(q.direction).toBe(b > a ? 'up' : 'down')
    }
  })

  it('only ascends before the descending level', () => {
    for (let i = 0; i < 200; i++) expect(generateQuestion('interval', 2, {}, rng).direction).toBe('up')
  })

  it('gives reference mode a different named note within an octave', () => {
    for (let i = 0; i < 300; i++) {
      const q = generateQuestion('reference', 4, {}, rng)
      expect(q.root).toBe(q.midis[0])
      expect(q.root).not.toBe(q.target)
      expect(Math.abs(q.root! - q.target)).toBeLessThanOrEqual(12)
    }
  })
})

describe('pickItem', () => {
  it('asks items the player misses more often', () => {
    const rng = seeded(7)
    const stats = { 0: { attempts: 20, correct: 20 }, 4: { attempts: 20, correct: 0 } }
    const counts: Record<number, number> = { 0: 0, 4: 0 }
    for (let i = 0; i < 2000; i++) counts[pickItem([0, 4], stats, rng)]++
    // Weights 1 vs 4.
    expect(counts[4]).toBeGreaterThan(counts[0] * 3)
  })
})

describe('isCorrect / answerMidis', () => {
  const noteQ: Question = { mode: 'note', midis: [64], target: 64, answer: 4 }

  it('grades by the answer', () => {
    expect(isCorrect(noteQ, 4)).toBe(true)
    expect(isCorrect(noteQ, 5)).toBe(false)
  })

  it('plays a wrong note answer in the same octave as the target', () => {
    expect(answerMidis(noteQ, 7)).toEqual([67])
  })

  it('keeps the comparison note inside the samples', () => {
    const top: Question = { mode: 'note', midis: [84], target: 84, answer: 0 }
    expect(answerMidis(top, 11)).toEqual([83])
  })

  it('replays the reference before the comparison note', () => {
    const q: Question = { mode: 'reference', midis: [60, 64], target: 64, answer: 4, root: 60 }
    expect(answerMidis(q, 5)).toEqual([60, 65])
  })

  it('plays a wrong interval from the same root, same direction', () => {
    const q: Question = { mode: 'interval', midis: [60, 55], target: 55, answer: 5, direction: 'down', root: 60 }
    expect(answerMidis(q, 7)).toEqual([60, 53])
  })

  it('shifts a wrong interval by an octave if it would leave the samples', () => {
    const q: Question = { mode: 'interval', midis: [80, 84], target: 84, answer: 4, direction: 'up', root: 80 }
    expect(answerMidis(q, 12)).toEqual([68, 80])
  })
})

describe('shouldUnlockNextLevel', () => {
  const results = (right: number, total = UNLOCK_WINDOW) =>
    Array.from({ length: total }, (_, i) => i < right)

  it('needs a full window of answers', () => {
    expect(shouldUnlockNextLevel('note', 1, results(15, 15))).toBe(false)
  })

  it('unlocks at 16 of the last 20', () => {
    expect(shouldUnlockNextLevel('note', 1, results(15))).toBe(false)
    expect(shouldUnlockNextLevel('note', 1, results(16))).toBe(true)
  })

  it('only looks at the most recent answers', () => {
    expect(shouldUnlockNextLevel('note', 1, [...results(20), ...results(0)])).toBe(false)
  })

  it('never unlocks past the last level', () => {
    expect(shouldUnlockNextLevel('note', NOTE_LEVELS.length, results(20))).toBe(false)
    expect(shouldUnlockNextLevel('interval', INTERVAL_LEVELS.length, results(20))).toBe(false)
  })
})
