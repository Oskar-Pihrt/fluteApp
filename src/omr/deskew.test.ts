import { describe, expect, it } from 'vitest'
import { binarise } from './binarise'
import { rotate, rowInkProfile } from './bitmap'
import { estimateSkew } from './deskew'
import { simplePhrase } from './testing/render'

/**
 * Peakedness of the row-ink profile: high when staff lines are horizontal.
 * Used to assert that correcting by the estimate genuinely straightens the page,
 * which is the property that matters — independent of sign conventions.
 */
function sharpness(data: Uint8Array, width: number, height: number): number {
  const profile = rowInkProfile({ data, width, height })
  let score = 0
  for (const v of profile) score += v * v
  return score
}

describe('estimateSkew', () => {
  it('reports no skew for a straight page', () => {
    const { bitmap } = simplePhrase([0, 2, 4, 6])
    const { bitmap: bw } = binarise(bitmap)
    expect(Math.abs(estimateSkew(bw))).toBeLessThan(0.3)
  })

  it.each([-4, -2, 1.5, 3, 5])('recovers a %s° skew', (applied) => {
    const { bitmap } = simplePhrase([0, 2, 4, 6, 8], { rotateDeg: applied })
    const { bitmap: bw } = binarise(bitmap)
    const estimate = estimateSkew(bw)
    expect(estimate).toBeCloseTo(applied, 0)
  })

  it('rotating by the negative of the estimate straightens the page', () => {
    const { bitmap } = simplePhrase([0, 2, 4, 6, 8], { rotateDeg: 4 })
    const { bitmap: bw } = binarise(bitmap)
    const estimate = estimateSkew(bw)

    const before = sharpness(bw.data, bw.width, bw.height)
    const corrected = rotate(bw, -estimate)
    const after = sharpness(corrected.data, corrected.width, corrected.height)

    // Straight staff lines concentrate ink into far fewer rows.
    expect(after).toBeGreaterThan(before * 1.5)
  })

  it('returns zero rather than guessing on a near-empty image', () => {
    const blank = { data: new Uint8Array(300 * 300).fill(255), width: 300, height: 300 }
    expect(estimateSkew(blank)).toBe(0)
  })
})
