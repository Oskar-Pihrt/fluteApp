import Dexie, { type EntityTable } from 'dexie'
import type { Measurement, Snake, SnakeEvent, Task } from './types'

export const db = new Dexie('snekapp') as Dexie & {
  snakes: EntityTable<Snake, 'id'>
  events: EntityTable<SnakeEvent, 'id'>
  tasks: EntityTable<Task, 'id'>
  measurements: EntityTable<Measurement, 'id'>
}

db.version(1).stores({
  snakes: '++id',
  events: '++id, snakeId, date, type',
  tasks: '++id, date',
  measurements: '++id, snakeId',
})
