import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { parsePractice, usePracticeStore } from './practice'

describe('parsePractice', () => {
  it('falls back to defaults for nothing or garbage', () => {
    expect(parsePractice(null).completedDays).toEqual([])
    expect(parsePractice('not json').metronomeBpm).toBe(72)
    expect(parsePractice('[]').bestStreak).toBe(0)
  })

  it('keeps valid fields and repairs bad ones', () => {
    const parsed = parsePractice(
      JSON.stringify({
        completedDays: ['2026-10-25', 'yesterday', '2026-10-24', '2026-10-25', 7],
        bestStreak: -3,
        totalSeconds: 600,
        training: { day: '2026-10-26', partsDone: 9 },
        records: { flute: { bestHold: { '69': 12.5, '70': 'long' }, notes: { '62': { attempts: 3, misses: 5 } }, scalesDone: ['G-major', 1] } },
        metronomeBpm: 500,
        hideFingering: 'yes',
      }),
    )
    expect(parsed.completedDays).toEqual(['2026-10-24', '2026-10-25'])
    expect(parsed.bestStreak).toBe(0)
    expect(parsed.totalSeconds).toBe(600)
    expect(parsed.training).toEqual({ day: '2026-10-26', partsDone: 3 })
    expect(parsed.records.flute).toEqual({
      bestHold: { '69': 12.5 },
      notes: { '62': { attempts: 3, misses: 3 } },
      scalesDone: ['G-major'],
    })
    expect(parsed.metronomeBpm).toBe(160)
    expect(parsed.hideFingering).toBe(false)
  })
})

describe('practice store', () => {
  beforeEach(() => setActivePinia(createPinia()))

  it('completes the day only after all three parts, in order', () => {
    const store = usePracticeStore()
    store.today = '2026-10-26'
    store.finishPart('notes')
    expect(store.partsDone).toBe(0)
    store.finishPart('longTones')
    store.finishPart('notes')
    expect(store.doneToday).toBe(false)
    expect(store.nextPart).toBe('scale')
    store.finishPart('scale')
    expect(store.doneToday).toBe(true)
    expect(store.streak).toBe(1)
    expect(store.bestStreak).toBe(1)
    expect(store.nextPart).toBeNull()
  })

  it('starts the training afresh on a new day', () => {
    const store = usePracticeStore()
    store.today = '2026-10-26'
    store.finishPart('longTones')
    store.today = '2026-10-27'
    expect(store.partsDone).toBe(0)
  })

  it('extends the streak day after day', () => {
    const store = usePracticeStore()
    for (const day of ['2026-10-25', '2026-10-26']) {
      store.today = day
      for (const part of ['longTones', 'notes', 'scale'] as const) store.finishPart(part)
    }
    expect(store.streak).toBe(2)
    expect(store.bestStreak).toBe(2)
  })

  it('keeps records per instrument', () => {
    const store = usePracticeStore()
    expect(store.recordHold('flute', 69, 6.2)).toBe(true)
    expect(store.recordHold('flute', 69, 5)).toBe(false)
    store.recordNote('flute', 62, true)
    store.recordNote('flute', 62, false)
    store.recordScale('flute', 'G-major')
    store.recordScale('flute', 'G-major')
    expect(store.recordsFor('flute')).toEqual({
      bestHold: { '69': 6.2 },
      notes: { '62': { attempts: 2, misses: 1 } },
      scalesDone: ['G-major'],
    })
    expect(store.recordsFor('altoSax').scalesDone).toEqual([])
  })
})
