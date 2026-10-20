import { describe, expect, it } from 'vitest'
import type { Measure, Score } from './model'
import { playbackOrder } from './playback-order'

const score = (...measures: Partial<Measure>[]): Score => ({
  mode: 'rhythm',
  clef: 'treble',
  measures: measures.map((m, i) => ({ id: `m${i}`, events: [], ...m })),
})

describe('playbackOrder', () => {
  it('plays straight through without signs', () => {
    expect(playbackOrder(score({}, {}, {}))).toEqual([0, 1, 2])
  })

  it('repeats a section, from the start sign or the beginning', () => {
    expect(playbackOrder(score({}, { barStart: 'repeatStart' }, { barEnd: 'repeatEnd' }, {}))).toEqual([0, 1, 2, 1, 2, 3])
    expect(playbackOrder(score({}, { barEnd: 'repeatEnd' }, {}))).toEqual([0, 1, 0, 1, 2])
  })

  it('takes first and second endings', () => {
    const order = playbackOrder(
      score({ barStart: 'repeatStart' }, {}, { volta: { numbers: [1] }, barEnd: 'repeatEnd' }, { volta: { numbers: [2] } }, {}),
    )
    expect(order).toEqual([0, 1, 2, 0, 1, 3, 4])
  })

  it('plays a repeat as often as its highest ending', () => {
    const order = playbackOrder(
      score({ barStart: 'repeatStart' }, { volta: { numbers: [1, 2] }, barEnd: 'repeatEnd' }, { volta: { numbers: [3] } }),
    )
    expect(order).toEqual([0, 1, 0, 1, 0, 2])
  })

  it('goes back to the start for D.C. al Fine, without repeats, and stops at Fine', () => {
    const order = playbackOrder(
      score({ barStart: 'repeatStart' }, { barEnd: 'repeatEnd', jumps: ['fine'] }, {}, { jumps: ['dcAlFine'], barEnd: 'final' }),
    )
    expect(order).toEqual([0, 1, 0, 1, 2, 3, 0, 1])
  })

  it('follows D.S. al Coda to the segno, then To Coda to the coda', () => {
    const order = playbackOrder(
      score({}, { jumps: ['segno'] }, { jumps: ['toCoda'] }, { jumps: ['dsAlCoda'] }, { jumps: ['coda'] }, {}),
    )
    expect(order).toEqual([0, 1, 2, 3, 1, 2, 4, 5])
  })

  it('plays only the last ending after a D.C.', () => {
    const order = playbackOrder(
      score(
        { barStart: 'repeatStart' },
        { volta: { numbers: [1] }, barEnd: 'repeatEnd' },
        { volta: { numbers: [2] }, jumps: ['dc'] },
      ),
    )
    expect(order).toEqual([0, 1, 0, 2, 0, 2])
  })
})
