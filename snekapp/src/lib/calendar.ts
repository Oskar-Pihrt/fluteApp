import { toISO } from './dates'

export interface Cell {
  iso: string
  day: number
  inMonth: boolean
}

/** Six Monday-first weeks covering the month. `month` is 0-based. */
export function monthGrid(year: number, month: number): Cell[][] {
  const first = new Date(year, month, 1)
  const offset = (first.getDay() + 6) % 7 // Monday = 0
  const start = new Date(year, month, 1 - offset)
  const weeks: Cell[][] = []
  for (let w = 0; w < 6; w++) {
    const row: Cell[] = []
    for (let d = 0; d < 7; d++) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d)
      row.push({ iso: toISO(date), day: date.getDate(), inMonth: date.getMonth() === month })
    }
    weeks.push(row)
  }
  return weeks
}
