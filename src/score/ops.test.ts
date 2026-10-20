import { describe, expect, it } from 'vitest'
import { durationTicks, type Score } from './model'
import {
  fromPitchList,
  fromSequence,
  measureFill,
  notesOf,
  rebar,
  toPitchesMode,
  toRhythmMode,
  toSequence,
  transposeFifths,
  transposeScore,
} from './ops'

const pitches = (score: Score) => score.measures.map((m) => m.events.map((e) => (e.kind === 'note' ? e.pitch : 'r')))

describe('durations', () => {
  it('counts dots as halves of what came before', () => {
    expect(durationTicks({ type: 'quarter', dots: 0 })).toBe(96)
    expect(durationTicks({ type: 'quarter', dots: 1 })).toBe(144)
    expect(durationTicks({ type: 'quarter', dots: 2 })).toBe(168)
    expect(durationTicks({ type: '32nd', dots: 2 })).toBe(21)
  })
})

describe('pitch lists', () => {
  it('turn dividers into measures', () => {
    const score = fromPitchList([
      { note: 'C5' },
      { note: 'D5', barAfter: true },
      { note: 'E5', chosenFingeringId: 'x' },
      { note: 'F5', barAfter: true },
    ])
    expect(score.mode).toBe('pitches')
    expect(pitches(score)).toEqual([['C5', 'D5'], ['E5', 'F5']])
    expect(notesOf(score)[2].chosenFingeringId).toBe('x')
  })

  it('round-trip through the sequence view, keeping measure attributes', () => {
    const score = fromPitchList([{ note: 'C5', barAfter: true }, { note: 'D5' }])
    score.measures[1].barEnd = 'final'
    const items = toSequence(score)
    expect(items.map((i) => i.barAfter)).toEqual([true, false])
    const back = fromSequence(items, score)
    expect(back).toEqual(score)
  })
})

describe('modes', () => {
  it('gives notes without durations a quarter and regroups them by the time signature', () => {
    const score = fromPitchList(['C5', 'D5', 'E5', 'F5', 'G5', 'A5'].map((note) => ({ note, barAfter: note === 'D5' })))
    const rhythm = toRhythmMode(score, { beats: 3, beatType: 4 })
    expect(pitches(rhythm)).toEqual([['C5', 'D5', 'E5'], ['F5', 'G5', 'A5']])
    expect(rhythm.measures[0].time).toEqual({ beats: 3, beatType: 4 })
    expect(measureFill(rhythm)).toEqual(['ok', 'ok'])
  })

  it('keeps durations while hidden, and shows them again unchanged', () => {
    const rhythm = toRhythmMode(fromPitchList([{ note: 'C5' }]))
    const back = toRhythmMode(toPitchesMode(rhythm))
    expect(back).toEqual(rhythm)
  })
})

describe('measure fill', () => {
  it('accepts a pickup but flags short and long measures in between', () => {
    const q = { type: 'quarter' as const, dots: 0 }
    const note = (pitch: string, duration = q) => ({ kind: 'note' as const, id: pitch, pitch, duration })
    const score: Score = {
      mode: 'rhythm',
      clef: 'treble',
      measures: [
        { id: 'a', events: [note('C5')], time: { beats: 2, beatType: 4 } },
        { id: 'b', events: [note('D5')] },
        { id: 'c', events: [note('E5'), note('F5'), note('G5')] },
        { id: 'd', events: [note('A5'), note('B5')] },
      ],
    }
    expect(measureFill(score)).toEqual(['ok', 'under', 'over', 'ok'])
  })

  it('starts a new measure when an event would overflow', () => {
    const half = { type: 'half' as const, dots: 0 }
    const events = ['C5', 'D5', 'E5'].map((pitch) => ({ kind: 'note' as const, id: pitch, pitch, duration: half }))
    expect(rebar(events, { beats: 3, beatType: 4 }).map((m) => m.length)).toEqual([1, 1, 1])
  })
})

describe('transposition', () => {
  it('moves key signatures with the notes', () => {
    expect(transposeFifths(0, 2)).toBe(2) // C major up a tone: D major
    expect(transposeFifths(0, -9)).toBe(-3) // a sixth down: E♭ major
    expect(transposeFifths(5, 2)).toBe(7)
    expect(transposeFifths(6, 2)).toBe(-4) // F♯ + 2 → A♭, not G♯ with 8 sharps
  })

  it('spells notes by interval and drops chosen fingerings', () => {
    const score = fromPitchList([{ note: 'F#5', chosenFingeringId: 'x' }])
    score.measures[0].keyFifths = 1
    const up = transposeScore(score, 2)
    expect(notesOf(up)[0]).toMatchObject({ pitch: 'G#5' })
    expect(notesOf(up)[0].chosenFingeringId).toBeUndefined()
    expect(up.measures[0].keyFifths).toBe(3)
  })
})
