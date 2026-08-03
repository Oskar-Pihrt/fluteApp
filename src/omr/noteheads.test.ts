import { describe, expect, it } from 'vitest'
import { binarise } from './binarise'
import { detectClefs } from './glyphs'
import { detectNoteheads } from './noteheads'
import { detectStaffLines, estimateScale, groupIntoStaves, removeStaffLines } from './staves'
import { renderScore, simplePhrase, type SyntheticNote } from './testing/render'
import type { Bitmap } from './types'

function pipeline(bitmap: Bitmap) {
  const { bitmap: bw } = binarise(bitmap)
  const scale = estimateScale(bw)!
  const staves = groupIntoStaves(detectStaffLines(bw, scale), scale, bw)
  const cleaned = removeStaffLines(bw, staves, scale)
  // The clef has to be located first, or its own bowls read as noteheads.
  const clefs = detectClefs(cleaned, staves, scale)
  const contentStartX = staves.map(
    (staff) => clefs.find((clef) => clef.staffIndex === staff.index)?.endX ?? staff.x0,
  )
  const { noteheads } = detectNoteheads(cleaned, staves, scale, { contentStartX })
  return { noteheads, staves, scale }
}

describe('detectNoteheads', () => {
  it('finds one notehead per drawn note and reads back its staff position', () => {
    const relatives = [0, 2, 4, 6, 8]
    const { bitmap } = simplePhrase(relatives)
    const { noteheads } = pipeline(bitmap)

    expect(noteheads.length).toBe(relatives.length)
    expect(noteheads.map((n) => n.relative)).toEqual(relatives)
  })

  it('reads odd positions — notes in spaces, not just on lines', () => {
    const relatives = [1, 3, 5, 7]
    const { bitmap } = simplePhrase(relatives)
    const { noteheads } = pipeline(bitmap)
    expect(noteheads.map((n) => n.relative)).toEqual(relatives)
  })

  it('locates centroids close to where the notes were drawn', () => {
    const { bitmap, xs } = simplePhrase([2, 5, 7])
    const { noteheads, scale } = pipeline(bitmap)
    expect(noteheads.length).toBe(3)
    noteheads.forEach((notehead, i) => {
      expect(Math.abs(notehead.x - xs[i])).toBeLessThan(scale.spaceHeight * 0.35)
    })
  })

  it('finds hollow noteheads as well as filled ones', () => {
    const spaceHeight = 18
    const notes: SyntheticNote[] = [
      { x: 90, staffIndex: 0, relative: 2, filled: true },
      { x: 150, staffIndex: 0, relative: 4, filled: false },
      { x: 210, staffIndex: 0, relative: 6, filled: false },
    ]
    const bitmap = renderScore({
      width: 280,
      height: 240,
      staves: [{ top: 70, spaceHeight, x0: 20, x1: 260 }],
      notes,
    })
    const { noteheads } = pipeline(bitmap)

    expect(noteheads.map((n) => n.relative)).toEqual([2, 4, 6])
    expect(noteheads.filter((n) => n.filled).length).toBe(1)
    expect(noteheads.filter((n) => !n.filled).length).toBe(2)
  })

  it('is not fooled by stems, which are thinner than the erosion element', () => {
    // Every note here has a stem; a stem must never register as a notehead.
    const { bitmap } = simplePhrase([0, 1, 2, 3, 4, 5, 6, 7, 8])
    const { noteheads } = pipeline(bitmap)
    expect(noteheads.length).toBe(9)
  })

  it('reads notes on ledger lines above and below the staff', () => {
    const relatives = [-4, -2, 10, 12]
    const { bitmap } = simplePhrase(relatives, { spaceHeight: 18 })
    const { noteheads } = pipeline(bitmap)
    expect(noteheads.map((n) => n.relative)).toEqual(relatives)
  })

  it('scores a well-centred notehead confidently', () => {
    const { bitmap } = simplePhrase([2, 4])
    const { noteheads } = pipeline(bitmap)
    for (const notehead of noteheads) {
      expect(notehead.confidence).toBeGreaterThan(0.5)
    }
  })

  it('assigns notes to the staff they sit on', () => {
    const spaceHeight = 16
    const bitmap = renderScore({
      width: 400,
      height: 340,
      staves: [
        { top: 60, spaceHeight, x0: 20, x1: 380 },
        { top: 220, spaceHeight, x0: 20, x1: 380 },
      ],
      notes: [
        { x: 150, staffIndex: 0, relative: 2 },
        { x: 250, staffIndex: 0, relative: 6 },
        { x: 150, staffIndex: 1, relative: 0 },
      ],
    })
    const { noteheads } = pipeline(bitmap)

    expect(noteheads.length).toBe(3)
    expect(noteheads.filter((n) => n.staffIndex === 0).length).toBe(2)
    expect(noteheads.filter((n) => n.staffIndex === 1).length).toBe(1)
  })

  it('finds nothing on an empty staff', () => {
    const bitmap = renderScore({
      width: 300,
      height: 200,
      staves: [{ top: 70, spaceHeight: 16, x0: 20, x1: 280 }],
      notes: [],
    })
    const { noteheads } = pipeline(bitmap)
    expect(noteheads).toEqual([])
  })
})
