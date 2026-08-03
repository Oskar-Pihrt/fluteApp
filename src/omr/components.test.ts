import { describe, expect, it } from 'vitest'
import { createBitmap } from './bitmap'
import { labelComponents } from './components'
import { INK, type Bitmap } from './types'

function withShapes(width: number, height: number, draw: (set: (x: number, y: number) => void) => void): Bitmap {
  const bmp = createBitmap(width, height)
  draw((x, y) => {
    if (x >= 0 && y >= 0 && x < width && y < height) bmp.data[y * width + x] = INK
  })
  return bmp
}

describe('labelComponents', () => {
  it('counts separate blobs separately', () => {
    const bmp = withShapes(40, 20, (set) => {
      for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) set(x, y)
      for (let y = 2; y < 6; y++) for (let x = 20; x < 24; x++) set(x, y)
    })
    const { components } = labelComponents(bmp)
    expect(components.length).toBe(2)
    expect(components[0].area).toBe(16)
    expect(components[1].area).toBe(16)
  })

  it('joins blobs that touch only diagonally, since labelling is 8-connected', () => {
    const bmp = withShapes(20, 20, (set) => {
      set(5, 5)
      set(6, 6)
    })
    const { components } = labelComponents(bmp)
    expect(components.length).toBe(1)
    expect(components[0].area).toBe(2)
  })

  it('reports bounding box, area and centroid of a rectangle', () => {
    const bmp = withShapes(30, 30, (set) => {
      for (let y = 5; y <= 14; y++) for (let x = 10; x <= 19; x++) set(x, y)
    })
    const { components } = labelComponents(bmp)
    expect(components.length).toBe(1)
    const c = components[0]
    expect(c.bbox).toEqual({ x: 10, y: 5, width: 10, height: 10 })
    expect(c.area).toBe(100)
    expect(c.centroidX).toBeCloseTo(14.5, 6)
    expect(c.centroidY).toBeCloseTo(9.5, 6)
  })

  it('merges a U shape into one component despite the scan splitting it', () => {
    // Two prongs joined only along the bottom row — the case a single-pass
    // labeller gets wrong and union-find has to reconcile.
    const bmp = withShapes(30, 30, (set) => {
      for (let y = 4; y <= 14; y++) {
        set(6, y)
        set(16, y)
      }
      for (let x = 6; x <= 16; x++) set(x, 14)
    })
    const { components } = labelComponents(bmp)
    expect(components.length).toBe(1)
    expect(components[0].bbox).toEqual({ x: 6, y: 4, width: 11, height: 11 })
  })

  it('finds an enclosed hole when labelling paper, and flags the outer background', () => {
    // A ring: paper labelling should yield the page background (touching the
    // border) plus the hole inside the ring (not touching it). This is exactly
    // how hollow noteheads get found.
    const bmp = withShapes(40, 40, (set) => {
      for (let y = 10; y <= 30; y++) {
        for (let x = 10; x <= 30; x++) {
          const onEdge = y <= 12 || y >= 28 || x <= 12 || x >= 28
          if (onEdge) set(x, y)
        }
      }
    })
    const { components } = labelComponents(bmp, { target: 'paper' })
    const enclosed = components.filter((c) => !c.touchesBorder)
    expect(components.some((c) => c.touchesBorder)).toBe(true)
    expect(enclosed.length).toBe(1)
    expect(enclosed[0].centroidX).toBeCloseTo(20, 0)
    expect(enclosed[0].centroidY).toBeCloseTo(20, 0)
  })

  it('honours minArea', () => {
    const bmp = withShapes(30, 30, (set) => {
      set(3, 3)
      for (let y = 10; y < 20; y++) for (let x = 10; x < 20; x++) set(x, y)
    })
    expect(labelComponents(bmp).components.length).toBe(2)
    expect(labelComponents(bmp, { minArea: 5 }).components.length).toBe(1)
  })

  it('returns nothing for a blank image', () => {
    expect(labelComponents(createBitmap(20, 20)).components).toEqual([])
  })
})
