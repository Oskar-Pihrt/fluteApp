import { describe, expect, it } from 'vitest'
import type { Detection } from './detector'
import { assembleRhythm, type RhythmNoteInput } from './rhythm'
import type { Staff } from './types'

const S = 10
const staff: Staff = { index: 0, lines: [100, 110, 120, 130, 140], spaceHeight: S, bottomLineY: 140, x0: 0, x1: 1000 }
const box = { x: 0, y: 0, width: 1, height: 1 }

const note = (x: number, pitch: string, dur: string, extra: Partial<RhythmNoteInput> = {}): RhythmNoteInput => ({
  pitch,
  x,
  staffIndex: 0,
  bbox: box,
  confidence: 0.9,
  durations: [
    { name: dur, p: 0.8 },
    { name: dur === 'quarter' ? 'half' : 'quarter', p: 0.15 },
  ],
  dots: 0,
  ...extra,
})
const det = (cls: string, x: number, y = 120, extra: Partial<Detection> = {}): Detection => ({ cls, x, y, score: 0.9, ...extra })

const run = (notes: RhythmNoteInput[], detections: Detection[], barXs: number[]) =>
  assembleRhythm({
    notes,
    detections,
    staves: [staff],
    barlines: barXs.map((x) => ({ x, staffIndex: 0 })),
    S,
    contentStartX: [40],
  })

describe('assembleRhythm', () => {
  it('builds measures with durations, rests and the time signature', () => {
    const { measures } = run(
      [note(100, 'G4', 'quarter'), note(150, 'A4', 'quarter', { dots: 1 }), note(350, 'B4', 'half', { dots: 1 })],
      [det('ts_3_4', 60), det('rest_8th', 200)],
      [300],
    )
    expect(measures).toHaveLength(2)
    expect(measures[0].time).toEqual({ beats: 3, beatType: 4 })
    expect(measures[0].events.map((e) => [e.kind, e.pitch, e.duration.type, e.duration.dots])).toEqual([
      ['note', 'G4', 'quarter', 0],
      ['note', 'A4', 'quarter', 1],
      ['rest', undefined, 'eighth', 0],
    ])
    expect(measures.map((m) => m.fill)).toEqual(['ok', 'ok'])
  })

  it('takes the runner-up duration when that makes a measure add up', () => {
    const { measures } = run(
      [note(20, 'C5', 'quarter'), note(100, 'C5', 'quarter'), note(150, 'D5', 'quarter'), note(200, 'E5', 'quarter'), note(350, 'F5', 'quarter'), note(400, 'G5', 'quarter'), note(500, 'A5', 'quarter'), note(650, 'B5', 'half'), note(700, 'C6', 'half')],
      [det('ts_4_4', 10)],
      [300, 600],
    )
    // Middle measure: three quarters in 4/4 — one of them must be a half.
    expect(measures[1].fill).toBe('fixed')
    expect(measures[1].events.map((e) => e.duration.type).sort()).toEqual(['half', 'quarter', 'quarter'])
  })

  it('reports a measure no plausible reading fixes', () => {
    const { measures } = run(
      [note(20, 'C5', 'quarter'), note(350, 'C5', '16th'), note(650, 'C5', 'quarter')],
      [det('ts_4_4', 10)],
      [300, 600],
    )
    expect(measures[1].fill).toBe('off')
  })

  it('marks ties, repeats, endings and jumps', () => {
    const { measures } = run(
      [note(100, 'G4', 'whole', { durations: [{ name: 'whole', p: 0.9 }] }), note(350, 'G4', 'whole', { tied: true, durations: [{ name: 'whole', p: 0.9 }] }), note(650, 'A4', 'whole', { durations: [{ name: 'whole', p: 0.9 }] })],
      [det('repeat_start', 50), det('repeat_end', 600), det('volta', 310, 80), det('volta', 610, 80), det('dc_al_fine', 700, 165), det('segno', 120, 85)],
      [300, 600],
    )
    expect(measures[0].events[0].tie).toBe(true)
    expect(measures[0]).toMatchObject({ barStart: 'repeatStart', jumps: ['segno'] })
    expect(measures[1]).toMatchObject({ barEnd: 'repeatEnd', volta: { numbers: [1] } })
    expect(measures[2]).toMatchObject({ volta: { numbers: [2] }, jumps: ['dcAlFine'] })
  })

  it('stretches a lone rest over the measure', () => {
    const { measures } = run([note(100, 'C5', 'half', { dots: 1 })], [det('ts_3_4', 60), det('rest_whole', 400, 115)], [300])
    expect(measures[1].events[0].duration).toEqual({ type: 'half', dots: 1 })
  })
})

describe('time signature inference', () => {
  it('corrects a misread signature from the measures under it', () => {
    const q = (x: number) => note(x, 'C5', 'quarter')
    const { measures } = run(
      [q(60), q(80), q(120), q(140), q(220), q(240), q(320), q(340), q(420), q(440)],
      [det('ts_4_4', 50)],
      [100, 200, 300, 400],
    )
    expect(measures[0].time).toEqual({ beats: 2, beatType: 4 })
    expect(measures.every((m) => m.fill === 'ok')).toBe(true)
  })
})
