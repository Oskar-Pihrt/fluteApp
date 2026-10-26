import { describe, expect, it } from 'vitest'
import {
  addDays,
  currentStreak,
  dayNumber,
  dayOf,
  LONG_TONE_COUNT,
  longTones,
  noteDrill,
  scaleForDay,
  scaleSteps,
  SCALE_KEYS,
  seededRandom,
  weekOf,
} from './practice'

/** Flute, C4–C7 chromatic. */
const FLUTE = Array.from({ length: 37 }, (_, i) => 60 + i)
/** A soprano recorder-ish range: C5–D7. */
const SHORT = Array.from({ length: 27 }, (_, i) => 72 + i)

describe('days', () => {
  it('formats local dates and steps across month and year ends', () => {
    expect(dayOf(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(dayNumber('2026-10-26') - dayNumber('2026-10-25')).toBe(1)
  })
})

describe('currentStreak', () => {
  const done = new Set(['2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25'])

  it('counts back from today when today is done', () => {
    expect(currentStreak(new Set([...done, '2026-10-26']), '2026-10-26')).toBe(5)
  })

  it('keeps yesterday’s streak while today is still to do', () => {
    expect(currentStreak(done, '2026-10-26')).toBe(4)
  })

  it('drops to zero after a missed day', () => {
    expect(currentStreak(done, '2026-10-27')).toBe(0)
  })

  it('runs across a month boundary', () => {
    expect(currentStreak(new Set(['2026-09-30', '2026-10-01']), '2026-10-01')).toBe(2)
  })
})

describe('weekOf', () => {
  it('lays out Monday to Sunday with each day’s state', () => {
    // 2026-10-24 is a Saturday.
    const week = weekOf(new Set(['2026-10-19', '2026-10-21']), '2026-10-24')
    expect(week.map((d) => d.day)).toEqual([
      '2026-10-19',
      '2026-10-20',
      '2026-10-21',
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
    ])
    expect(week.map((d) => d.state)).toEqual(['done', 'missed', 'done', 'missed', 'missed', 'today', 'future'])
  })
})

describe('longTones', () => {
  it('gives five neighbouring notes from the middle, alternating direction by day', () => {
    const even = longTones(FLUTE, '2026-10-26')
    const odd = longTones(FLUTE, '2026-10-27')
    for (const steps of [even, odd]) {
      expect(steps).toHaveLength(LONG_TONE_COUNT)
      for (let i = 1; i < steps.length; i++) expect(Math.abs(steps[i].midi - steps[i - 1].midi)).toBe(1)
    }
    const direction = (s: typeof even) => Math.sign(s[1].midi - s[0].midi)
    expect(direction(even)).toBe(-direction(odd))
  })

  it('stays in range on a tiny instrument', () => {
    const tiny = [72, 73, 74]
    for (const day of ['2026-10-26', '2026-10-27']) {
      for (const s of longTones(tiny, day)) expect(tiny).toContain(s.midi)
    }
  })
})

describe('noteDrill', () => {
  it('draws from the lower four fifths of the range without immediate repeats', () => {
    const steps = noteDrill(FLUTE, {}, seededRandom(1))
    expect(steps).toHaveLength(20)
    const top = FLUTE[Math.ceil(FLUTE.length * 0.8) - 1]
    for (let i = 0; i < steps.length; i++) {
      expect(steps[i].midi).toBeLessThanOrEqual(top)
      if (i) expect(steps[i].midi).not.toBe(steps[i - 1].midi)
    }
  })

  it('favours notes that were missed', () => {
    const stats = { '62': { attempts: 10, misses: 10 } }
    const counts = new Map<number, number>()
    const rng = seededRandom(3)
    for (let round = 0; round < 50; round++) {
      for (const s of noteDrill(FLUTE, stats, rng)) counts.set(s.midi, (counts.get(s.midi) ?? 0) + 1)
    }
    const average = [...counts.values()].reduce((a, b) => a + b, 0) / counts.size
    expect(counts.get(62)!).toBeGreaterThan(average * 1.5)
  })

  it('is the same for the same seed', () => {
    expect(noteDrill(FLUTE, {}, seededRandom(9))).toEqual(noteDrill(FLUTE, {}, seededRandom(9)))
  })
})

describe('scales', () => {
  it('spells one octave up and down with one letter per degree', () => {
    const steps = scaleSteps({ tonic: 'Bb', mode: 'major' }, FLUTE)!
    expect(steps.map((s) => s.note)).toEqual([
      'Bb4', 'C5', 'D5', 'Eb5', 'F5', 'G5', 'A5', 'Bb5',
      'A5', 'G5', 'F5', 'Eb5', 'D5', 'C5', 'Bb4',
    ])
  })

  it('uses sharps in sharp keys and the natural minor', () => {
    expect(scaleSteps({ tonic: 'E', mode: 'minor' }, FLUTE)!.slice(0, 8).map((s) => s.note)).toEqual([
      'E4', 'F#4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5',
    ])
  })

  it('only offers keys the range can hold', () => {
    for (const key of SCALE_KEYS) {
      const steps = scaleSteps(key, SHORT)
      if (steps) for (const s of steps) expect(SHORT).toContain(s.midi)
    }
    expect(scaleSteps({ tonic: 'C', mode: 'major' }, [60, 62, 64])).toBeNull()
  })

  it('rotates the key day by day', () => {
    const a = scaleForDay(FLUTE, '2026-10-26')
    const b = scaleForDay(FLUTE, '2026-10-27')
    expect(a).not.toEqual(b)
    expect(scaleForDay(FLUTE, '2026-10-26')).toEqual(a)
  })
})
