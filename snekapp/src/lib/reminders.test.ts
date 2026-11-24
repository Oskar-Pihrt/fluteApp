import { describe, expect, it } from 'vitest'
import { FEED_ID_BASE, TASK_ID_BASE, planReminders } from './reminders'
import type { Snake, SnakeEvent, Task } from './types'

const snake = (id: number, every = 7): Snake => ({ id, name: `S${id}`, species: 'corn-snake', morph: '', sex: 'u', birthDate: '', acquiredDate: '', color: '#000', feedEveryDays: every, notes: '', createdAt: 0 })
const fed = (snakeId: number, date: string): SnakeEvent => ({ snakeId, type: 'feed', date })
const now = new Date(2026, 10, 24, 12, 0) // 24 Nov 2026, noon

describe('planReminders', () => {
  it('reminds on the due day at the chosen time', () => {
    const [r] = planReminders([snake(1)], [fed(1, '2026-11-20')], [], '09:30', now)
    expect(r).toMatchObject({ id: FEED_ID_BASE + 1, kind: 'feed', snakeName: 'S1', route: '/snake/1' })
    expect(r.at).toEqual(new Date(2026, 10, 27, 9, 30))
  })

  it('nudges once the next day when the meal is already late', () => {
    const [r] = planReminders([snake(1)], [fed(1, '2026-11-10')], [], '09:00', now)
    expect(r.kind).toBe('feedOverdue')
    expect(r.at).toEqual(new Date(2026, 10, 25, 9, 0))
  })

  it('nudges later today when the reminder time has not come yet', () => {
    const [r] = planReminders([snake(1)], [fed(1, '2026-11-10')], [], '18:00', now)
    expect(r.at).toEqual(new Date(2026, 10, 24, 18, 0))
  })

  it('skips snakes that were never fed', () => {
    expect(planReminders([snake(1)], [], [], '09:00', now)).toEqual([])
  })

  it('reminds of open future tasks only', () => {
    const tasks: Task[] = [
      { id: 1, title: 'UVB', date: '2026-11-26', snakeId: 1 },
      { id: 2, title: 'done', date: '2026-11-26', done: true },
      { id: 3, title: 'past', date: '2026-11-20' },
    ]
    const rs = planReminders([snake(1)], [], tasks, '09:00', now)
    expect(rs).toHaveLength(1)
    expect(rs[0]).toMatchObject({ id: TASK_ID_BASE + 1, kind: 'task', title: 'UVB', snakeName: 'S1' })
  })

  it('orders by time', () => {
    const rs = planReminders([snake(1), snake(2, 14)], [fed(1, '2026-11-20'), fed(2, '2026-11-20')], [{ id: 9, title: 'x', date: '2026-11-25' }], '09:00', now)
    expect(rs.map((r) => r.id)).toEqual([TASK_ID_BASE + 9, FEED_ID_BASE + 1, FEED_ID_BASE + 2])
  })
})
