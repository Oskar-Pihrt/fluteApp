import { liveQuery } from 'dexie'
import { ref, shallowRef } from 'vue'
import { db } from './db'
import { addDays } from './dates'
import type { Snake, SnakeEvent, Task } from './types'

// Live views of the database, kept for the lifetime of the app.
export const snakes = shallowRef<Snake[]>([])
export const events = shallowRef<SnakeEvent[]>([])
export const tasks = shallowRef<Task[]>([])
export const ready = ref(false)

let loaded = 0
const markLoaded = () => {
  if (++loaded === 3) ready.value = true
}

liveQuery(() => db.snakes.toArray()).subscribe((v) => { snakes.value = v; markLoaded() })
liveQuery(() => db.events.orderBy('date').toArray()).subscribe((v) => { events.value = v; markLoaded() })
liveQuery(() => db.tasks.orderBy('date').toArray()).subscribe((v) => { tasks.value = v; markLoaded() })

export const snakeById = (id: number | undefined) => snakes.value.find((s) => s.id === id)
export const eventsOf = (snakeId: number) => events.value.filter((e) => e.snakeId === snakeId)

export async function deleteSnake(id: number) {
  await db.transaction('rw', db.snakes, db.events, db.tasks, db.measurements, async () => {
    await db.events.where('snakeId').equals(id).delete()
    await db.measurements.where('snakeId').equals(id).delete()
    await db.tasks.filter((t) => t.snakeId === id).delete()
    await db.snakes.delete(id)
  })
}

export async function deleteEvent(e: SnakeEvent) {
  await db.transaction('rw', db.events, db.measurements, async () => {
    if (e.measurementId) await db.measurements.delete(e.measurementId)
    await db.events.delete(e.id!)
  })
}

/** Ticking off a repeating task moves it forward instead of finishing it. */
export async function toggleTask(t: Task, today: string) {
  if (t.repeatDays && !t.done) {
    await db.tasks.update(t.id!, { date: addDays(t.date < today ? today : t.date, t.repeatDays) })
  } else {
    await db.tasks.update(t.id!, { done: !t.done })
  }
}
