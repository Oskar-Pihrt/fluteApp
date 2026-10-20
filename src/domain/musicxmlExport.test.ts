import { describe, expect, it } from 'vitest'
import type { Score } from '@/score/model'
import { parseMusicXml } from './musicxml'
import { scoreToMusicXml } from './musicxmlExport'

/** A score without ids and sources, which no round trip preserves. */
function shape(score: Score) {
  return JSON.parse(
    JSON.stringify(score, (key, value) => (key === 'id' || key === 'source' ? undefined : value)),
  )
}

const original: Score = {
  mode: 'rhythm',
  clef: 'treble',
  tempo: 84,
  measures: [
    {
      id: 'a',
      time: { beats: 3, beatType: 4 },
      keyFifths: -2,
      barStart: 'repeatStart',
      jumps: ['segno'],
      events: [
        { kind: 'note', id: '1', pitch: 'Bb4', duration: { type: 'half', dots: 1 } },
      ],
    },
    {
      id: 'b',
      volta: { numbers: [1] },
      barEnd: 'repeatEnd',
      events: [
        { kind: 'rest', id: '2', duration: { type: 'quarter', dots: 0 } },
        { kind: 'note', id: '3', pitch: 'F#5', duration: { type: 'eighth', dots: 0 } },
        { kind: 'note', id: '4', pitch: 'G5', duration: { type: 'eighth', dots: 0 }, tie: true },
        { kind: 'note', id: '5', pitch: 'G5', duration: { type: 'quarter', dots: 0 } },
      ],
    },
    {
      id: 'c',
      volta: { numbers: [2] },
      time: { beats: 6, beatType: 8 },
      keyFifths: 1,
      jumps: ['dsAlFine'],
      barEnd: 'final',
      events: [{ kind: 'note', id: '6', pitch: 'D5', duration: { type: 'quarter', dots: 1 } }],
    },
  ],
}

describe('scoreToMusicXml', () => {
  it('round-trips through the importer', () => {
    const xml = scoreToMusicXml(original, { title: 'A & B', composer: 'Me', partName: 'Flute', transposeSemitones: 0 })
    const { title, composer, parts } = parseMusicXml(xml)
    expect(title).toBe('A & B')
    expect(composer).toBe('Me')
    expect(shape(parts[0].score)).toEqual(shape(original))
  })

  it('writes the part’s transposition', () => {
    const xml = scoreToMusicXml(original, { title: '', composer: '', partName: 'Tenor Saxophone', transposeSemitones: -14 })
    expect(parseMusicXml(xml).parts[0].transposeSemitones).toBe(-14)
    expect(xml).toContain('<diatonic>-1</diatonic><chromatic>-2</chromatic><octave-change>-1</octave-change>')
  })

  it('writes a pitches-mode score as quarters', () => {
    const pitches: Score = { mode: 'pitches', clef: 'treble', measures: [{ id: 'm', events: [{ kind: 'note', id: 'n', pitch: 'C5' }] }] }
    const back = parseMusicXml(scoreToMusicXml(pitches, { title: '', composer: '', partName: 'Flute', transposeSemitones: 0 })).parts[0].score
    expect(back.measures[0].events[0]).toMatchObject({ pitch: 'C5', duration: { type: 'quarter', dots: 0 } })
  })
})
