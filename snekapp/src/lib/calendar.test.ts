import { describe, expect, it } from 'vitest'
import { monthGrid } from './calendar'

describe('monthGrid', () => {
  it('has six Monday-first weeks', () => {
    const g = monthGrid(2026, 10) // November 2026 starts on a Sunday
    expect(g).toHaveLength(6)
    expect(g.every((w) => w.length === 7)).toBe(true)
    expect(g[0][0].iso).toBe('2026-10-26') // Monday before
    expect(g[0][6]).toMatchObject({ iso: '2026-11-01', inMonth: true })
    expect(g.flat().filter((c) => c.inMonth)).toHaveLength(30)
  })

  it('handles a month that starts on Monday', () => {
    const g = monthGrid(2026, 5) // June 2026 starts on a Monday
    expect(g[0][0]).toMatchObject({ iso: '2026-06-01', inMonth: true })
  })
})
