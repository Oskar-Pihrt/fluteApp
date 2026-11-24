import { db } from './db'
import { addDays, todayISO } from './dates'
import type { SnakeEvent } from './types'

/** A few snakes with months of history, so the app can be explored straight away. */
export async function loadDemoData(): Promise<void> {
  const today = todayISO()
  const ago = (n: number) => addDays(today, -n)

  const mango = await db.snakes.add({ name: 'Mango', species: 'corn-snake', morph: 'Amel', sex: 'f', birthDate: ago(420), acquiredDate: ago(380), color: '#f0743c', feedEveryDays: 7, notes: 'Escape artist. Loves the cork tunnel.', createdAt: Date.now() }) as number
  const nagini = await db.snakes.add({ name: 'Nagini', species: 'ball-python', morph: 'Pastel', sex: 'f', birthDate: ago(900), acquiredDate: ago(850), color: '#e8c547', feedEveryDays: 14, notes: 'Shy. Hides most of the day.', createdAt: Date.now() + 1 }) as number
  const kaa = await db.snakes.add({ name: 'Kaa', species: 'boa-constrictor', morph: 'Normal', sex: 'm', birthDate: ago(1500), acquiredDate: ago(1400), color: '#5be37d', feedEveryDays: 21, notes: '', createdAt: Date.now() + 2 }) as number

  const rows: Omit<SnakeEvent, 'id'>[] = []
  const grow = (id: number, every: number, count: number, w0: number, wStep: number, l0: number, lStep: number, prey: string, size: string, lastOffset: number) => {
    for (let i = 0; i < count; i++) {
      const d = ago(lastOffset + (count - 1 - i) * every)
      rows.push({ snakeId: id, type: 'feed', date: d, prey, preySize: size, frozen: true, refused: i === 3 })
      if (i % 2 === 0) rows.push({ snakeId: id, type: 'weight', date: d, value: Math.round(w0 + wStep * i) })
      if (i % 3 === 0) rows.push({ snakeId: id, type: 'length', date: d, value: Math.round((l0 + lStep * i) * 10) / 10 })
    }
  }
  grow(mango, 7, 16, 260, 17, 78, 2.1, 'mouse', 'hopper', 5)
  grow(nagini, 14, 9, 1250, 55, 112, 1.8, 'rat', 'small', 4)
  grow(kaa, 21, 6, 5200, 160, 168, 2.4, 'rat', 'large', 17)

  rows.push({ snakeId: mango, type: 'shed', date: ago(40), text: 'Clean, one piece.' })
  rows.push({ snakeId: mango, type: 'shed', date: ago(95) })
  rows.push({ snakeId: nagini, type: 'shed', date: ago(22) })
  rows.push({ snakeId: nagini, type: 'vet', date: ago(60), text: 'Yearly check-up. All good.' })
  rows.push({ snakeId: kaa, type: 'clean', date: ago(9), text: 'Full substrate change.' })
  rows.push({ snakeId: kaa, type: 'shed', date: ago(30), text: 'Stuck eye cap on the left, soaked.' })
  await db.events.bulkAdd(rows as SnakeEvent[])

  await db.tasks.bulkAdd([
    { title: 'Replace the UVB tube', date: addDays(today, 6) },
    { title: 'Deep clean the enclosure', date: addDays(today, 2), snakeId: mango, repeatDays: 30 },
    { title: 'Weigh Nagini', date: today, snakeId: nagini, repeatDays: 14 },
  ])
}
