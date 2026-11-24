import { feedingStatus } from './schedule'
import { addDays, parseISO } from './dates'
import type { Snake, SnakeEvent, Task } from './types'

export interface Reminder {
  id: number
  kind: 'feed' | 'feedOverdue' | 'task'
  at: Date
  snakeName?: string
  title?: string
  route: string
}

// Notification ids are derived from the record, so rescheduling replaces rather than duplicates.
export const FEED_ID_BASE = 1_000_000
export const TASK_ID_BASE = 2_000_000
export const isOurs = (id: number) => id >= FEED_ID_BASE && id < TASK_ID_BASE + 1_000_000
const MAX = 50

function atTime(iso: string, time: string): Date {
  const [h, m] = time.split(':').map(Number)
  const d = parseISO(iso)
  d.setHours(h || 0, m || 0, 0, 0)
  return d
}

/**
 * What to notify about, from the current data:
 *  - a snake's next meal, on its due day at the chosen time;
 *  - if that moment has passed without a meal, one nudge the next day at that time
 *    (planned again each time the app is opened, so an unfed snake isn't forgotten);
 *  - each open task on its day.
 */
export function planReminders(snakes: Snake[], events: SnakeEvent[], tasks: Task[], time: string, now = new Date()): Reminder[] {
  const out: Reminder[] = []
  const todayISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  for (const s of snakes) {
    if (s.id == null) continue
    const st = feedingStatus(events.filter((e) => e.snakeId === s.id), s.feedEveryDays, todayISO)
    if (!st.dueDate) continue
    let at = atTime(st.dueDate, time)
    let kind: Reminder['kind'] = 'feed'
    if (at <= now) {
      kind = 'feedOverdue'
      at = atTime(todayISO, time)
      if (at <= now) at = atTime(addDays(todayISO, 1), time)
    }
    out.push({ id: FEED_ID_BASE + s.id, kind, at, snakeName: s.name, route: `/snake/${s.id}` })
  }

  for (const tk of tasks) {
    if (tk.id == null || tk.done) continue
    const at = atTime(tk.date, time)
    if (at <= now) continue
    const snakeName = snakes.find((s) => s.id === tk.snakeId)?.name
    out.push({ id: TASK_ID_BASE + tk.id, kind: 'task', at, title: tk.title, snakeName, route: '/calendar' })
  }

  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX)
}
