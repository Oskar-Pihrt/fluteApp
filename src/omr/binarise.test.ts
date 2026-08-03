import { describe, expect, it } from 'vitest'
import { binarise } from './binarise'
import { isInk } from './bitmap'
import { INK, PAPER } from './types'
import { simplePhrase } from './testing/render'

/** Fraction of pixels that are ink. */
function inkFraction(data: Uint8Array): number {
  let n = 0
  for (const v of data) if (v === INK) n++
  return n / data.length
}

describe('binarise', () => {
  it('produces a strictly two-valued bitmap', () => {
    const { bitmap } = simplePhrase([0, 2, 4])
    const result = binarise(bitmap)
    for (const v of result.bitmap.data) {
      expect(v === INK || v === PAPER).toBe(true)
    }
  })

  it('finds ink where the renderer drew a staff line, and paper in the margin', () => {
    const { bitmap, staff } = simplePhrase([0, 2, 4])
    const { bitmap: bw } = binarise(bitmap)
    // Mid-staff, between noteheads: the top line should be ink.
    expect(isInk(bw, staff.x1 - 10, staff.top)).toBe(true)
    // Well above the staff there is nothing at all.
    expect(isInk(bw, staff.x1 - 10, 2)).toBe(false)
  })

  it('leaves a sane ink fraction — a page is mostly paper', () => {
    const { bitmap } = simplePhrase([0, 2, 4, 6, 8])
    const { bitmap: bw, inkFraction: reported } = binarise(bitmap)
    const measured = inkFraction(bw.data)
    expect(measured).toBeCloseTo(reported, 6)
    expect(measured).toBeGreaterThan(0.005)
    expect(measured).toBeLessThan(0.25)
  })

  it('survives a brightness gradient that would defeat a global threshold', () => {
    const { bitmap, staff } = simplePhrase([0, 2, 4, 6], { gradient: true })
    const { bitmap: bw } = binarise(bitmap)
    // The dim right-hand end of the top line must still come through as ink.
    expect(isInk(bw, staff.x1 - 12, staff.top)).toBe(true)
    // And the dimmed paper right of centre must not be swallowed as ink.
    expect(isInk(bw, staff.x1 - 12, 3)).toBe(false)
  })

  it('keeps filled noteheads solid rather than hollowing them out', () => {
    // Regression guard. Sauvola's local rule, applied inside a large solid
    // symbol, sees an all-ink neighbourhood and classifies the blob's own
    // interior as background — every filled notehead comes out as a ring, and
    // erosion-based detection then finds nothing. The flat-region fallback is
    // what prevents it, and nothing else in the suite would notice if it broke.
    const { bitmap, xs, staff } = simplePhrase([4])
    const { bitmap: bw } = binarise(bitmap)

    const centreY = staff.top + 2 * staff.spaceHeight
    let inkRun = 0
    for (let dy = -4; dy <= 4; dy++) {
      if (isInk(bw, xs[0], centreY + dy)) inkRun++
    }
    // A solid notehead is ink right through its middle, not just at its rim.
    expect(inkRun).toBe(9)
  })

  it('reports a very low ink fraction for a blank page', () => {
    const blank = { data: new Uint8Array(200 * 200).fill(240), width: 200, height: 200 }
    const { inkFraction: fraction } = binarise(blank)
    expect(fraction).toBeLessThan(0.01)
  })
})
