import { db } from './db'

const toDataURL = (b: Blob) =>
  new Promise<string>((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result as string)
    r.onerror = () => rej(r.error)
    r.readAsDataURL(b)
  })

const fromDataURL = async (u: string) => (await fetch(u)).blob()

export async function exportBackup(): Promise<Blob> {
  const [snakes, events, tasks, measurements] = await Promise.all([
    db.snakes.toArray(),
    db.events.toArray(),
    db.tasks.toArray(),
    db.measurements.toArray(),
  ])
  const data = {
    app: 'snekapp',
    version: 1,
    snakes: await Promise.all(snakes.map(async (s) => ({ ...s, photo: s.photo ? await toDataURL(s.photo) : undefined }))),
    events,
    tasks,
    measurements: await Promise.all(measurements.map(async (m) => ({ ...m, photo: await toDataURL(m.photo) }))),
  }
  return new Blob([JSON.stringify(data)], { type: 'application/json' })
}

/** Replaces everything in the database with the backup's contents. */
export async function importBackup(file: Blob): Promise<void> {
  const data = JSON.parse(await file.text())
  if (data?.app !== 'snekapp' || !Array.isArray(data.snakes)) throw new Error('Not a snekapp backup')
  const snakes = await Promise.all(data.snakes.map(async (s: any) => ({ ...s, photo: s.photo ? await fromDataURL(s.photo) : undefined })))
  const measurements = await Promise.all((data.measurements ?? []).map(async (m: any) => ({ ...m, photo: await fromDataURL(m.photo) })))
  await db.transaction('rw', db.snakes, db.events, db.tasks, db.measurements, async () => {
    await Promise.all([db.snakes.clear(), db.events.clear(), db.tasks.clear(), db.measurements.clear()])
    await db.snakes.bulkAdd(snakes)
    await db.events.bulkAdd(data.events ?? [])
    await db.tasks.bulkAdd(data.tasks ?? [])
    await db.measurements.bulkAdd(measurements)
  })
}

export async function clearAll(): Promise<void> {
  await Promise.all([db.snakes.clear(), db.events.clear(), db.tasks.clear(), db.measurements.clear()])
}
