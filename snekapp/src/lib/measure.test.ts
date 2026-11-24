import { describe, expect, it } from 'vitest'
import { lengthCm, pxPerCm, polylineLength, splineLength } from './measure'

describe('measure', () => {
  it('derives the scale from the ruler', () => {
    expect(pxPerCm({ x: 0, y: 0 }, { x: 300, y: 400 }, 10)).toBe(50)
    expect(pxPerCm({ x: 0, y: 0 }, { x: 5, y: 5 }, 0)).toBe(0)
  })

  it('measures a straight snake exactly, smooth or not', () => {
    const cal: [{ x: number; y: number }, { x: number; y: number }] = [{ x: 0, y: 0 }, { x: 200, y: 0 }] // 20 px/cm at 10 cm
    const line = [{ x: 0, y: 50 }, { x: 250, y: 50 }, { x: 500, y: 50 }]
    expect(lengthCm(line, cal, 10, false)).toBeCloseTo(25, 5)
    expect(lengthCm(line, cal, 10, true)).toBeCloseTo(25, 5)
  })

  it('follows curves: a traced half circle is close to πr', () => {
    const r = 100
    const pts = Array.from({ length: 7 }, (_, i) => {
      const a = (Math.PI * i) / 6
      return { x: r * Math.cos(a), y: r * Math.sin(a) }
    })
    const exact = Math.PI * r
    expect(Math.abs(splineLength(pts) - exact) / exact).toBeLessThan(0.005)
    // the plain polyline always undershoots a curve
    expect(polylineLength(pts)).toBeLessThan(splineLength(pts))
  })

  it('returns 0 until calibrated and traced', () => {
    expect(lengthCm([{ x: 0, y: 0 }], null, 10)).toBe(0)
    expect(lengthCm([{ x: 0, y: 0 }], [{ x: 0, y: 0 }, { x: 1, y: 0 }], 10)).toBe(0)
  })
})
