import { describe, expect, it } from 'vitest'
import type { Duration, Score, ScoreEvent } from './model'
import { buildTimeline } from './timeline'

const d = (type: Duration['type'], dots = 0): Duration => ({ type, dots })
const n = (id: string, pitch: string, duration: Duration, tie = false): ScoreEvent => ({
  kind: 'note',
  id,
  pitch,
  duration,
  ...(tie ? { tie } : {}),
})

const score = (time: [number, number], ...measures: ScoreEvent[][]): Score => ({
  mode: 'rhythm',
  clef: 'treble',
  measures: measures.map((events, i) => ({
    id: `m${i}`,
    events,
    ...(i === 0 ? { time: { beats: time[0], beatType: time[1] } } : {}),
  })),
})

describe('buildTimeline', () => {
  it('lays notes out at the tempo, with a click per beat', () => {
    const t = buildTimeline(score([2, 4], [n('a', 'C5', d('quarter')), n('b', 'D5', d('eighth', 1)), n('c', 'E5', d('16th'))]), 120)
    expect(t.events.map((e) => [e.id, e.start, e.duration])).toEqual([
      ['a', 0, 0.5],
      ['b', 0.5, 0.375],
      ['c', 0.875, 0.125],
    ])
    expect(t.beats).toEqual([
      { time: 0, accent: true },
      { time: 0.5, accent: false },
    ])
    expect(t.length).toBe(1)
  })

  it('holds a tied note instead of playing it again', () => {
    const t = buildTimeline(score([2, 4], [n('a', 'G4', d('half'), true)], [n('b', 'G4', d('quarter')), n('c', 'A4', d('quarter'))]), 60)
    expect(t.events.map((e) => [e.id, e.attack, e.duration])).toEqual([
      ['a', true, 3],
      ['b', false, 1],
      ['c', true, 1],
    ])
  })

  it('clicks dotted quarters in 6/8 and puts a pickup’s beats at the end of the bar', () => {
    const six = buildTimeline(score([6, 8], [n('a', 'C5', d('half', 1))]), 60)
    expect(six.beats.map((b) => b.time)).toEqual([0, 1.5])
    const pickup = buildTimeline(score([3, 4], [n('a', 'C5', d('quarter'))], [n('b', 'D5', d('half', 1))]), 60)
    expect(pickup.beats.map((b) => [b.time, b.accent])).toEqual([
      [0, false],
      [1, true],
      [2, false],
      [3, false],
    ])
  })

  it('starts from a chosen note', () => {
    const t = buildTimeline(score([2, 4], [n('a', 'C5', d('quarter')), n('b', 'D5', d('quarter'))]), 60, 'b')
    expect(t.events.map((e) => [e.id, e.start])).toEqual([['b', 0]])
    expect(t.beats.map((b) => b.time)).toEqual([0])
  })

  it('plays pitches-mode notes a beat each', () => {
    const pitches: Score = { mode: 'pitches', clef: 'treble', measures: [{ id: 'm', events: [{ kind: 'note', id: 'a', pitch: 'C5' }, { kind: 'note', id: 'b', pitch: 'D5' }] }] }
    expect(buildTimeline(pitches, 120).events.map((e) => e.start)).toEqual([0, 0.5])
  })
})
