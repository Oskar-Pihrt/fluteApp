import { describe, expect, it } from 'vitest'
import { assemble } from './assemble'
import type { Detection } from './detector'
import type { Staff, StaffScale } from './types'

/**
 * Detections → notes, on hand-placed detections: the musical rules applied on
 * top of what the network sees, independent of the network itself.
 */

const S = 10
const scale: StaffScale = { lineHeight: 1, spaceHeight: S }

function staff(index: number, top: number): Staff {
  const lines = [0, 1, 2, 3, 4].map((i) => top + i * S)
  return { index, lines, spaceHeight: S, bottomLineY: lines[4], x0: 20, x1: 900 }
}

const one = [staff(0, 100)]
const two = [staff(0, 100), staff(1, 300)]

/** y of a staff position (0 = bottom line, E4) on a staff. */
const yOf = (st: Staff, relative: number) => st.bottomLineY - (relative * S) / 2

const d = (cls: string, x: number, y: number, score = 0.9): Detection => ({ cls, x, y, score })
const clef = (st: Staff) => d('clef', st.x0 + 15, yOf(st, 2))
const head = (st: Staff, x: number, relative: number, cls = 'head_filled') => d(cls, x, yOf(st, relative))

describe('assemble', () => {
  it('reads plain noteheads in order', () => {
    const st = one[0]
    const { notes } = assemble([clef(st), head(st, 100, 0), head(st, 140, 1), head(st, 180, 2)], one, scale)
    expect(notes.map((n) => n.note)).toEqual(['E4', 'F4', 'G4'])
  })

  it('ignores anything inside the clef', () => {
    const st = one[0]
    const { notes } = assemble([clef(st), head(st, 40, 3), head(st, 100, 0)], one, scale)
    expect(notes.map((n) => n.note)).toEqual(['E4'])
  })

  it('applies a key signature read from each staff', () => {
    const detections: Detection[] = []
    for (const st of two) {
      detections.push(clef(st), d('sharp', 60, yOf(st, 8)), d('sharp', 70, yOf(st, 5)))
      detections.push(head(st, 120, 1), head(st, 160, 5)) // F4, C5
    }
    const { notes, key } = assemble(detections, two, scale)
    expect(key).toEqual({ kind: '#', count: 2 })
    expect(notes.map((n) => n.note)).toEqual(['F#4', 'C#5', 'F#4', 'C#5'])
  })

  it('does not mistake the first note’s own accidental for the key', () => {
    const st = one[0]
    const { notes, key } = assemble([clef(st), d('flat', 90, yOf(st, 4)), head(st, 100, 4), head(st, 140, 4)], one, scale)
    expect(key.count).toBe(0)
    expect(notes.map((n) => n.note)).toEqual(['Bb4', 'Bb4'])
  })

  it('keeps accidentals in force until the barline', () => {
    const st = one[0]
    const { notes } = assemble(
      [clef(st), d('sharp', 90, yOf(st, 3)), head(st, 100, 3), head(st, 140, 3), d('barline', 170, yOf(st, 4)), head(st, 200, 3)],
      one,
      scale,
    )
    expect(notes.map((n) => n.note)).toEqual(['A#4', 'A#4', 'A4'])
  })

  it('reads double sharps and double flats', () => {
    const st = one[0]
    const { notes } = assemble([clef(st), d('dsharp', 190, yOf(st, 1)), head(st, 200, 1), d('dflat', 290, yOf(st, 4)), head(st, 300, 4)], one, scale)
    expect(notes.map((n) => n.note)).toEqual(['F##4', 'Bbb4'])
  })

  it('raises notes under an 8va line by an octave, across a system break', () => {
    const [a, b] = two
    const { notes } = assemble(
      [
        clef(a),
        clef(b),
        head(a, 100, 8), // F5, before the line
        d('ottava_start', 200, yOf(a, 14)),
        head(a, 210, 8), // F6
        head(b, 100, 8), // still under the line on the next system
        d('ottava_end', 150, yOf(b, 14)),
        head(b, 200, 8), // back to F5
      ],
      two,
      scale,
    )
    expect(notes.map((n) => n.note)).toEqual(['F5', 'F6', 'F6', 'F5'])
    expect(notes.map((n) => n.octaveShift ?? 0)).toEqual([0, 1, 1, 0])
  })

  it('merges a tied continuation into the note it continues', () => {
    const st = one[0]
    const detections = [clef(st), head(st, 100, 2), head(st, 140, 2), d('tied_head', 140, yOf(st, 2)), head(st, 180, 2)]
    expect(assemble(detections, one, scale).notes.map((n) => n.note)).toEqual(['G4', 'G4'])
    const unmerged = assemble(detections, one, scale, { mergeTies: false }).notes
    expect(unmerged).toHaveLength(3)
    expect(unmerged[1].tied).toBe(true)
  })

  it('does not merge a slur between different pitches marked as tied', () => {
    const st = one[0]
    const { notes } = assemble([clef(st), head(st, 100, 2), head(st, 140, 3), d('tied_head', 140, yOf(st, 3))], one, scale)
    expect(notes.map((n) => n.note)).toEqual(['G4', 'A4'])
  })

  it('keeps the top note of a chord and counts it', () => {
    const st = one[0]
    const { notes, chordCount } = assemble([clef(st), head(st, 100, 0), head(st, 101, 4)], one, scale)
    expect(notes.map((n) => n.note)).toEqual(['B4'])
    expect(chordCount).toBe(1)
  })

  it('keeps or drops grace notes on request', () => {
    const st = one[0]
    const detections = [clef(st), head(st, 90, 3, 'head_grace'), head(st, 110, 2)]
    const withGrace = assemble(detections, one, scale).notes
    expect(withGrace.map((n) => n.note)).toEqual(['A4', 'G4'])
    expect(withGrace[0].grace).toBe(true)
    expect(assemble(detections, one, scale, { includeGrace: false }).notes.map((n) => n.note)).toEqual(['G4'])
  })
})
