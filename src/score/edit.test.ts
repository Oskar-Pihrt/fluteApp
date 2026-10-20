import { describe, expect, it } from 'vitest'
import type { Duration, Score, ScoreEvent } from './model'
import {
  cycleDots,
  firstOffMeasure,
  insertAfter,
  keyAlterations,
  locate,
  patchMeasure,
  pitchAt,
  rebarFrom,
  removeEvent,
  setAccidental,
  toggleRest,
  toggleTie,
} from './edit'

const q: Duration = { type: 'quarter', dots: 0 }
const h: Duration = { type: 'half', dots: 0 }
const note = (id: string, duration = q): ScoreEvent => ({ kind: 'note', id, pitch: 'C5', duration })
const ids = (score: Score) => score.measures.map((m) => m.events.map((e) => e.id).join(''))

const twoFour = (...measures: ScoreEvent[][]): Score => ({
  mode: 'rhythm',
  clef: 'treble',
  measures: measures.map((events, i) => ({ id: `m${i}`, events, ...(i === 0 ? { time: { beats: 2, beatType: 4 } } : {}) })),
})

describe('typing in', () => {
  it('inserts after the selected event', () => {
    const score = insertAfter(twoFour([note('a'), note('b')]), 'a', note('x'))
    expect(ids(score)).toEqual(['axb'])
  })

  it('starts a new measure when the last one is full', () => {
    const score = insertAfter(twoFour([note('a'), note('b')]), null, note('c'))
    expect(ids(score)).toEqual(['ab', 'c'])
  })

  it('fills an unfinished last measure first', () => {
    expect(ids(insertAfter(twoFour([note('a')]), null, note('b')))).toEqual(['ab'])
  })
})

describe('removing', () => {
  it('drops a measure it empties, passing its time change on', () => {
    let score = twoFour([note('a')], [note('b')])
    score = removeEvent(score, 'a')
    expect(ids(score)).toEqual(['b'])
    expect(score.measures[0].time).toEqual({ beats: 2, beatType: 4 })
  })

  it('keeps the only measure, empty', () => {
    expect(ids(removeEvent(twoFour([note('a')]), 'a'))).toEqual([''])
  })
})

describe('editing events', () => {
  it('cycles dots and toggles rests and ties', () => {
    let score = twoFour([note('a')])
    score = cycleDots(score, 'a')
    expect(score.measures[0].events[0].duration).toEqual({ type: 'quarter', dots: 1 })
    score = toggleRest(score, 'a')
    expect(score.measures[0].events[0]).toEqual({ kind: 'rest', id: 'a', duration: { type: 'quarter', dots: 1 } })
    score = toggleRest(score, 'a', 'G4')
    expect(score.measures[0].events[0]).toMatchObject({ kind: 'note', pitch: 'G4' })
    score = toggleTie(score, 'a')
    expect(score.measures[0].events[0]).toMatchObject({ tie: true })
    expect(toggleTie(score, 'a').measures[0].events[0]).not.toHaveProperty('tie')
  })

  it('spells accidentals on the same letter', () => {
    const score: Score = { ...twoFour([]), measures: [{ id: 'm', events: [{ kind: 'note', id: 'n', pitch: 'F#5', chosenFingeringId: 'x' }] }] }
    expect(setAccidental(score, 'n', -1).measures[0].events[0]).toEqual({ kind: 'note', id: 'n', pitch: 'Fb5' })
    expect(setAccidental(score, 'n', 0).measures[0].events[0]).toMatchObject({ pitch: 'F5' })
  })

  it('patches and clears measure attributes', () => {
    let score = patchMeasure(twoFour([note('a')]), 0, { barEnd: 'repeatEnd', volta: { numbers: [1] } })
    expect(score.measures[0]).toMatchObject({ barEnd: 'repeatEnd', volta: { numbers: [1] } })
    score = patchMeasure(score, 0, { volta: undefined })
    expect(score.measures[0]).not.toHaveProperty('volta')
  })
})

describe('the staff', () => {
  it('reads lines and spaces as the key spells them', () => {
    expect(pitchAt(0, 0)).toBe('E4')
    expect(pitchAt(8, 0)).toBe('F5')
    expect(pitchAt(8, 2)).toBe('F#5')
    expect(pitchAt(-2, 0)).toBe('C4')
    expect(pitchAt(4, -1)).toBe('B4'.replace('B', 'Bb'))
    expect([...keyAlterations(-2).keys()]).toEqual(['B', 'E'])
  })
})

describe('fixing measures', () => {
  it('regroups from the first measure that doesn’t add up, keeping a pickup', () => {
    const score = twoFour([note('p')], [note('a'), note('b'), note('c')], [note('d', h)])
    expect(firstOffMeasure(score)).toBe(1)
    const fixed = rebarFrom(score, 1)
    expect(ids(fixed)).toEqual(['p', 'ab', 'c', 'd'])
    expect(locate(fixed, 'd')).toEqual({ measure: 3, index: 0 })
  })
})
