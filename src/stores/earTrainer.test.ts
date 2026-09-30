import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { parseEarTrainer, useEarTrainerStore } from './earTrainer'
import type { Question } from '@/domain/earTraining'

const question: Question = { mode: 'note', midis: [60], target: 60, answer: 0 }

describe('parseEarTrainer', () => {
  it('returns defaults for nothing or garbage', () => {
    expect(parseEarTrainer(null).progress.note).toEqual({ unlocked: 1, level: 1, stats: {}, recent: [] })
    expect(parseEarTrainer('{nope').mode).toBe('note')
  })

  it('keeps valid saved progress', () => {
    const saved = JSON.stringify({
      mode: 'interval',
      progress: { interval: { unlocked: 3, level: 2, stats: { 7: { attempts: 4, correct: 3 } }, recent: [true, false] } },
    })
    const parsed = parseEarTrainer(saved)
    expect(parsed.mode).toBe('interval')
    expect(parsed.progress.interval).toEqual({
      unlocked: 3,
      level: 2,
      stats: { 7: { attempts: 4, correct: 3 } },
      recent: [true, false],
    })
    expect(parsed.progress.note.unlocked).toBe(1)
  })

  it('repairs out-of-range levels and impossible stats', () => {
    const saved = JSON.stringify({
      mode: 'bogus',
      progress: { note: { unlocked: 99, level: 50, stats: { 0: { attempts: 2, correct: 9 } } } },
    })
    const parsed = parseEarTrainer(saved)
    expect(parsed.mode).toBe('note')
    expect(parsed.progress.note.unlocked).toBe(4)
    expect(parsed.progress.note.level).toBe(4)
    expect(parsed.progress.note.stats[0]).toEqual({ attempts: 2, correct: 2 })
  })
})

describe('useEarTrainerStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('tracks per-item stats, score and streak', () => {
    const store = useEarTrainerStore()
    store.record(question, true)
    store.record(question, true)
    store.record(question, false)
    expect(store.progress.note.stats[0]).toEqual({ attempts: 3, correct: 2 })
    expect([store.sessionCorrect, store.sessionAttempts]).toEqual([2, 3])
    expect([store.streak, store.bestStreak]).toEqual([0, 2])
  })

  it('unlocks the next level after 16 of the last 20 and announces it once', () => {
    const store = useEarTrainerStore()
    const unlocks: (number | null)[] = []
    for (let i = 0; i < 20; i++) unlocks.push(store.record(question, i >= 4))
    expect(unlocks.filter((u) => u != null)).toEqual([2])
    expect(store.progress.note).toMatchObject({ unlocked: 2, level: 2, recent: [] })
  })

  it('does not unlock while practising a lower level', () => {
    const store = useEarTrainerStore()
    store.progress.note.unlocked = 2
    store.progress.note.level = 2
    store.setLevel(1)
    for (let i = 0; i < 20; i++) expect(store.record(question, true)).toBeNull()
    expect(store.progress.note.unlocked).toBe(2)
  })

  it('refuses to select a locked level', () => {
    const store = useEarTrainerStore()
    store.setLevel(3)
    expect(store.progress.note.level).toBe(1)
  })

  it('resets one mode only', () => {
    const store = useEarTrainerStore()
    store.record(question, true)
    store.record({ ...question, mode: 'interval', answer: 7 }, true)
    store.resetStats('note')
    expect(store.progress.note.stats).toEqual({})
    expect(store.progress.interval.stats[7]).toBeDefined()
  })
})
