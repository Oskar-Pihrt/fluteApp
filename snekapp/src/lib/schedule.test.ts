import { describe, expect, it } from 'vitest'
import { feedingStatus } from './schedule'
import type { SnakeEvent } from './types'

const feed = (date: string, refused = false): SnakeEvent => ({ snakeId: 1, type: 'feed', date, refused })

describe('feedingStatus', () => {
  it('has no schedule before the first meal', () => {
    expect(feedingStatus([], 7, '2026-11-24').state).toBe('never')
  })

  it('counts from the last meal eaten', () => {
    const s = feedingStatus([feed('2026-11-10'), feed('2026-11-17')], 7, '2026-11-20')
    expect(s).toMatchObject({ state: 'ok', dueDate: '2026-11-24', daysUntil: 4, lastFed: '2026-11-17' })
  })

  it('is due today and then overdue', () => {
    expect(feedingStatus([feed('2026-11-17')], 7, '2026-11-24').state).toBe('today')
    expect(feedingStatus([feed('2026-11-17')], 7, '2026-11-27')).toMatchObject({ state: 'overdue', daysUntil: -3 })
  })

  it('offers food again a week after a refusal', () => {
    const s = feedingStatus([feed('2026-11-01'), feed('2026-11-15', true)], 14, '2026-11-16')
    expect(s.dueDate).toBe('2026-11-22')
    expect(s.lastFed).toBe('2026-11-01')
  })

  it('retries sooner than a week when the normal interval is short', () => {
    expect(feedingStatus([feed('2026-11-15', true)], 5, '2026-11-16').dueDate).toBe('2026-11-20')
  })

  it('a meal after a refusal resets the schedule', () => {
    const s = feedingStatus([feed('2026-11-15', true), feed('2026-11-18')], 7, '2026-11-19')
    expect(s.dueDate).toBe('2026-11-25')
  })
})
