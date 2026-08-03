import { describe, expect, it } from 'vitest'
import { binarise } from './binarise'
import { isInk } from './bitmap'
import {
  detectStaffLines,
  estimateScale,
  groupIntoStaves,
  relativeAt,
  removeStaffLines,
  yAtRelative,
} from './staves'
import { renderScore, simplePhrase, type SyntheticStaff } from './testing/render'

function analyse(bitmap: ReturnType<typeof simplePhrase>['bitmap']) {
  const { bitmap: bw } = binarise(bitmap)
  const scale = estimateScale(bw)
  if (!scale) throw new Error('scale estimation failed')
  const lines = detectStaffLines(bw, scale)
  const staves = groupIntoStaves(lines, scale, bw)
  return { bw, scale, lines, staves }
}

describe('estimateScale', () => {
  it.each([12, 16, 20, 28])('recovers a spacing of %s px', (spaceHeight) => {
    const { bitmap } = simplePhrase([0, 2, 4, 6], { spaceHeight })
    const { bitmap: bw } = binarise(bitmap)
    const scale = estimateScale(bw)
    expect(scale).not.toBeNull()
    // Within a pixel: run-length modes are integers and lines are anti-aliased.
    expect(Math.abs(scale!.spaceHeight - spaceHeight)).toBeLessThanOrEqual(1)
    expect(scale!.lineHeight).toBeGreaterThanOrEqual(1)
    expect(scale!.lineHeight).toBeLessThan(spaceHeight / 2)
  })

  it('returns null for a blank page rather than a meaningless number', () => {
    const blank = { data: new Uint8Array(400 * 400).fill(250), width: 400, height: 400 }
    const { bitmap: bw } = binarise(blank)
    expect(estimateScale(bw)).toBeNull()
  })
})

describe('detectStaffLines and groupIntoStaves', () => {
  it('finds exactly five lines for one staff, at the drawn positions', () => {
    const { bitmap, staff } = simplePhrase([0, 2, 4, 6, 8])
    const { lines, staves } = analyse(bitmap)

    expect(lines.length).toBe(5)
    expect(staves.length).toBe(1)
    for (let i = 0; i < 5; i++) {
      expect(Math.abs(staves[0].lines[i] - (staff.top + i * staff.spaceHeight))).toBeLessThan(1.5)
    }
  })

  it('finds both staves on a two-staff page, ordered top to bottom', () => {
    const spaceHeight = 16
    const top: SyntheticStaff = { top: 60, spaceHeight, x0: 20, x1: 380 }
    const bottom: SyntheticStaff = { top: 220, spaceHeight, x0: 20, x1: 380 }
    const bitmap = renderScore({
      width: 400,
      height: 320,
      staves: [top, bottom],
      notes: [
        { x: 150, staffIndex: 0, relative: 2 },
        { x: 150, staffIndex: 1, relative: 6 },
      ],
    })
    const { staves } = analyse(bitmap)

    expect(staves.length).toBe(2)
    expect(staves[0].lines[0]).toBeLessThan(staves[1].lines[0])
    expect(Math.abs(staves[0].lines[0] - top.top)).toBeLessThan(2)
    expect(Math.abs(staves[1].lines[0] - bottom.top)).toBeLessThan(2)
  })

  it('rejects a group that is not five evenly spaced lines', () => {
    const scale = { lineHeight: 2, spaceHeight: 16 }
    const dummy = { data: new Uint8Array(10 * 10).fill(255), width: 10, height: 10 }
    // Four lines only.
    expect(groupIntoStaves([10, 26, 42, 58], scale, dummy)).toEqual([])
    // Five lines, but one gap is wildly wrong.
    expect(groupIntoStaves([10, 26, 42, 120, 136], scale, dummy)).toEqual([])
  })

  it('measures the staff extent without being stretched by the margins', () => {
    const { bitmap, staff } = simplePhrase([0, 4])
    const { staves } = analyse(bitmap)
    expect(Math.abs(staves[0].x0 - staff.x0)).toBeLessThan(4)
    expect(Math.abs(staves[0].x1 - staff.x1)).toBeLessThan(4)
  })
})

describe('removeStaffLines', () => {
  it('erases the lines but keeps the noteheads sitting on them', () => {
    // A note on the middle line (relative 4) is the hard case: its ink overlaps
    // a line exactly, so a naive row-erase would punch a hole through it.
    const { bitmap, xs } = simplePhrase([4])
    const { bw, scale, staves } = analyse(bitmap)
    const cleaned = removeStaffLines(bw, staves, scale)
    const staff = staves[0]

    // Line ink well away from the note is gone.
    expect(isInk(cleaned, staff.x1 - 8, staff.lines[2])).toBe(false)
    // The notehead's centre survives.
    expect(isInk(cleaned, xs[0], yAtRelative(staff, 4))).toBe(true)
  })

  it('leaves a stem intact where it crosses a staff line', () => {
    // The interesting case: the stem passes straight through lines that are
    // being erased around it. A row-based erase would cut it into segments.
    const { bitmap, xs } = simplePhrase([0])
    const { bw, scale, staves } = analyse(bitmap)
    const cleaned = removeStaffLines(bw, staves, scale)
    const staff = staves[0]

    const stemColumns = (y: number) => {
      let found = 0
      for (let dx = -2; dx <= Math.round(staff.spaceHeight); dx++) {
        if (isInk(cleaned, xs[0] + dx, y)) found++
      }
      return found
    }

    // Sample on two lines the upward stem crosses, and in the space between.
    expect(stemColumns(staff.lines[2])).toBeGreaterThan(0)
    expect(stemColumns(staff.lines[3])).toBeGreaterThan(0)
    expect(stemColumns((staff.lines[2] + staff.lines[3]) / 2)).toBeGreaterThan(0)
  })

  it('is a copy, not a mutation of its input', () => {
    const { bitmap } = simplePhrase([2])
    const { bw, scale, staves } = analyse(bitmap)
    const before = bw.data.slice()
    removeStaffLines(bw, staves, scale)
    expect(bw.data).toEqual(before)
  })
})

describe('relativeAt / yAtRelative', () => {
  it('round-trip exactly', () => {
    const { bitmap } = simplePhrase([0, 4, 8])
    const { staves } = analyse(bitmap)
    for (const relative of [-4, -2, 0, 1, 4, 8, 11]) {
      expect(relativeAt(staves[0], yAtRelative(staves[0], relative))).toBeCloseTo(relative, 6)
    }
  })

  it('puts the bottom line at 0 and the top line at 8', () => {
    const { bitmap } = simplePhrase([0])
    const { staves } = analyse(bitmap)
    expect(relativeAt(staves[0], staves[0].lines[4])).toBeCloseTo(0, 6)
    expect(relativeAt(staves[0], staves[0].lines[0])).toBeCloseTo(8, 1)
  })
})
