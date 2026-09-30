import { describe, expect, it } from 'vitest'
import { noteRange } from '@/domain/lookup'
import { FLUTE } from '@/instruments'
import { recognise } from './recognise'
import { renderScore, simplePhrase } from './testing/render'
import { createBitmap } from './bitmap'

const PLAYABLE = noteRange({ instrument: FLUTE, config: ['bFoot'] }).map((entry) => entry.note)

function pitches(bitmap: Parameters<typeof recognise>[0]) {
  return recognise(bitmap, { playableNotes: PLAYABLE }).result.notes.map((note) => note.note)
}

/**
 * End-to-end tests over synthetic pages. These assert the *exact* pitch sequence,
 * which is the only assertion that really matters — everything upstream exists to
 * make this come out right.
 */
describe('recognise', () => {
  it('reads a clean phrase on the treble staff', () => {
    // relative 0,2,4,6,8 are the five lines: E4 G4 B4 D5 F5.
    const { bitmap } = simplePhrase([0, 2, 4, 6, 8])
    expect(pitches(bitmap)).toEqual(['E4', 'G4', 'B4', 'D5', 'F5'])
  })

  it('reads the spaces between the lines', () => {
    // relative 1,3,5,7 are the four spaces: F4 A4 C5 E5.
    const { bitmap } = simplePhrase([1, 3, 5, 7])
    expect(pitches(bitmap)).toEqual(['F4', 'A4', 'C5', 'E5'])
  })

  it('reads an eight-note phrase in order', () => {
    const { bitmap } = simplePhrase([0, 1, 2, 3, 4, 5, 6, 7], { spaceHeight: 18 })
    expect(pitches(bitmap)).toEqual(['E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5'])
  })

  it('reads the same phrase through a 4° skew', () => {
    const straight = simplePhrase([0, 2, 4, 6, 8], { spaceHeight: 18 })
    const skewed = simplePhrase([0, 2, 4, 6, 8], { spaceHeight: 18, rotateDeg: 4 })
    expect(pitches(skewed.bitmap)).toEqual(pitches(straight.bitmap))
    expect(pitches(skewed.bitmap)).toEqual(['E4', 'G4', 'B4', 'D5', 'F5'])
  })

  it('reads the same phrase through a brightness gradient', () => {
    const { bitmap } = simplePhrase([2, 4, 6], { spaceHeight: 18, gradient: true })
    expect(pitches(bitmap)).toEqual(['G4', 'B4', 'D5'])
  })

  it('reads ledger-line notes in the right octaves', () => {
    // -2 is middle C; 10 and 12 are A5 and C6, above the staff.
    const { bitmap } = simplePhrase([-2, 0, 10, 12], { spaceHeight: 18 })
    expect(pitches(bitmap)).toEqual(['C4', 'E4', 'A5', 'C6'])
  })

  it('reads hollow noteheads alongside filled ones', () => {
    const bitmap = renderScore({
      width: 320,
      height: 260,
      staves: [{ top: 80, spaceHeight: 18, x0: 20, x1: 300 }],
      notes: [
        { x: 110, staffIndex: 0, relative: 2, filled: true },
        { x: 175, staffIndex: 0, relative: 4, filled: false },
        { x: 240, staffIndex: 0, relative: 6, filled: false },
      ],
    })
    expect(pitches(bitmap)).toEqual(['G4', 'B4', 'D5'])
  })

  it('applies a two-sharp key signature without printed accidentals', () => {
    // D major: every F and C is sharp. relative 3 = A4, 5 = C5, 8 = F5.
    const spaceHeight = 18
    const bitmap = renderScore({
      width: 380,
      height: 280,
      staves: [{ top: 90, spaceHeight, x0: 20, x1: 360 }],
      keySignature: { kind: '#', count: 2, staffIndex: 0 },
      notes: [
        { x: 190, staffIndex: 0, relative: 3 },
        { x: 250, staffIndex: 0, relative: 5 },
        { x: 310, staffIndex: 0, relative: 8 },
      ],
    })
    const { result } = recognise(bitmap, { playableNotes: PLAYABLE })
    expect(result.keySignature).toEqual({ kind: '#', count: 2 })
    expect(result.notes.map((note) => note.note)).toEqual(['A4', 'C#5', 'F#5'])
  })

  it('reads notes from both staves, top staff first', () => {
    const spaceHeight = 16
    const bitmap = renderScore({
      width: 420,
      height: 360,
      staves: [
        { top: 60, spaceHeight, x0: 20, x1: 400 },
        { top: 230, spaceHeight, x0: 20, x1: 400 },
      ],
      notes: [
        { x: 160, staffIndex: 0, relative: 0 },
        { x: 260, staffIndex: 0, relative: 4 },
        { x: 160, staffIndex: 1, relative: 8 },
        { x: 260, staffIndex: 1, relative: 6 },
      ],
    })
    expect(pitches(bitmap)).toEqual(['E4', 'B4', 'F5', 'D5'])
  })

  it('reports staff geometry and normalised boxes inside the image', () => {
    const { bitmap } = simplePhrase([2, 4], { spaceHeight: 18 })
    const { result } = recognise(bitmap, { playableNotes: PLAYABLE })

    expect(result.staves.length).toBe(1)
    expect(result.scale.spaceHeight).toBeGreaterThan(0)
    for (const note of result.notes) {
      expect(note.bbox.x).toBeGreaterThanOrEqual(0)
      expect(note.bbox.y).toBeGreaterThanOrEqual(0)
      expect(note.bbox.x + note.bbox.width).toBeLessThanOrEqual(1.001)
      expect(note.bbox.y + note.bbox.height).toBeLessThanOrEqual(1.001)
    }
  })

  it('places boxes in reading order left to right', () => {
    const { bitmap } = simplePhrase([0, 2, 4, 6], { spaceHeight: 18 })
    const { result } = recognise(bitmap, { playableNotes: PLAYABLE })
    for (let i = 1; i < result.notes.length; i++) {
      expect(result.notes[i].bbox.x).toBeGreaterThan(result.notes[i - 1].bbox.x)
    }
  })

  it('reads a page whose staves are only a few pixels apart', () => {
    // Regression guard. A screen-resolution screenshot of a full page lands at a
    // staff spacing of six or seven pixels. The staves are perfectly detectable
    // there, but an erosion element of 0.34 × 7px rounds to nothing, so an
    // earlier version found every staff and then returned no notes at all.
    // Upscaling before the morphology is what makes this work.
    const { bitmap } = simplePhrase([0, 2, 4, 6, 8], { spaceHeight: 7 })
    expect(pitches(bitmap)).toEqual(['E4', 'G4', 'B4', 'D5', 'F5'])
  })

  it('still reads a page at a comfortable spacing after the same rescaling logic', () => {
    // The other side of the same branch: large pages get downsampled instead.
    const { bitmap } = simplePhrase([0, 2, 4, 6, 8], { spaceHeight: 40 })
    expect(pitches(bitmap)).toEqual(['E4', 'G4', 'B4', 'D5', 'F5'])
  })

  it('gives up only when the lines genuinely merge, and says what it measured', () => {
    const { bitmap } = simplePhrase([0, 4], { spaceHeight: 3 })
    const { result } = recognise(bitmap)
    expect(result.notes).toEqual([])
    const warning = result.warnings.find((w) => w.code === 'too-small' || w.code === 'no-staves')
    expect(warning).toBeDefined()
  })

  it('warns rather than crashing on a blank page', () => {
    const blank = createBitmap(400, 500, 250)
    const { result } = recognise(blank)
    expect(result.notes).toEqual([])
    expect(result.warnings.map((w) => w.code)).toContain('low-contrast')
  })

  it('warns rather than crashing on a page with no staves', () => {
    // Ink, but nothing resembling a staff.
    const bitmap = createBitmap(400, 400, 244)
    for (let y = 100; y < 300; y++) {
      for (let x = 100; x < 130; x++) bitmap.data[y * 400 + x] = 20
    }
    const { result } = recognise(bitmap)
    expect(result.notes).toEqual([])
    expect(result.warnings.map((w) => w.code)).toContain('no-staves')
  })

  it('warns rather than crashing on a tiny image', () => {
    const { result } = recognise(createBitmap(40, 30, 240))
    expect(result.notes).toEqual([])
    expect(result.warnings.map((w) => w.code)).toContain('too-small')
  })

  it('reports progress through the stages, ending at 1', () => {
    const { bitmap } = simplePhrase([0, 4])
    const seen: number[] = []
    recognise(bitmap, { onProgress: ({ fraction }) => seen.push(fraction) })
    expect(seen.length).toBeGreaterThan(3)
    expect(seen[seen.length - 1]).toBe(1)
    // Monotonically increasing, so a progress bar never jumps backwards.
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1])
  })

  it('captures debug bitmaps only when asked', () => {
    const { bitmap } = simplePhrase([0, 4])
    expect(recognise(bitmap).debug).toBeUndefined()
    const { debug } = recognise(bitmap, { debug: true })
    expect(debug?.binarised).toBeDefined()
    expect(debug?.staffRemoved).toBeDefined()
    expect(debug?.eroded).toBeDefined()
  })
})
