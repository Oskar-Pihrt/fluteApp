import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, newId, type Sheet, type SheetNote } from '@/data/db'
import { blobToBase64, base64ToBlob, prepareImage } from '@/data/images'
import type { InstrumentId } from '@/instruments/types'

/**
 * The sheet-music library: CRUD over Dexie plus whole-library backup.
 *
 * Note sequences are stored as flat rows with a contiguous `index`, so the
 * automatic recogniser added later can bulk-insert suggestions into exactly the
 * same shape the manual editor writes.
 */
export const useSheetsStore = defineStore('sheets', () => {
  const sheets = ref<Sheet[]>([])
  const loading = ref(false)

  async function loadAll() {
    loading.value = true
    try {
      sheets.value = await db.sheets.orderBy('updatedAt').reverse().toArray()
    } finally {
      loading.value = false
    }
  }

  async function get(id: string): Promise<Sheet | undefined> {
    return db.sheets.get(id)
  }

  async function notesFor(sheetId: string): Promise<SheetNote[]> {
    const rows = await db.sheetNotes.where('sheetId').equals(sheetId).toArray()
    return rows.sort((a, b) => a.index - b.index)
  }

  async function create(
    file: Blob,
    title: string,
    instrument: InstrumentId,
    composer = '',
  ): Promise<string> {
    const prepared = await prepareImage(file)
    const now = Date.now()
    const sheet: Sheet = {
      id: newId(),
      title: title.trim() || 'Untitled',
      composer: composer.trim(),
      createdAt: now,
      updatedAt: now,
      image: prepared.image,
      thumbnail: prepared.thumbnail,
      imageWidth: prepared.width,
      imageHeight: prepared.height,
      instrument,
    }
    await db.sheets.add(sheet)
    await loadAll()
    return sheet.id
  }

  async function updateMeta(id: string, patch: Pick<Sheet, 'title' | 'composer'>) {
    await db.sheets.update(id, { ...patch, updatedAt: Date.now() })
    await loadAll()
  }

  async function remove(id: string) {
    await db.transaction('rw', db.sheets, db.sheetNotes, async () => {
      await db.sheetNotes.where('sheetId').equals(id).delete()
      await db.sheets.delete(id)
    })
    await loadAll()
  }

  /** Replace a sheet's whole note sequence. Simpler than diffing, and fast enough. */
  async function replaceNotes(sheetId: string, notes: Omit<SheetNote, 'id' | 'sheetId'>[]) {
    await db.transaction('rw', db.sheets, db.sheetNotes, async () => {
      await db.sheetNotes.where('sheetId').equals(sheetId).delete()
      await db.sheetNotes.bulkAdd(
        notes.map((note, index) => ({ ...note, index, id: newId(), sheetId })),
      )
      await db.sheets.update(sheetId, { updatedAt: Date.now() })
    })
    await loadAll()
  }

  // ── Backup ────────────────────────────────────────────────────────────────
  // Local-only storage means the user carries the responsibility for their own
  // data, so export/import is a first-class feature rather than a debug tool.

  interface BackupSheet extends Omit<Sheet, 'image' | 'thumbnail'> {
    image: string
    thumbnail: string
    notes: Omit<SheetNote, 'id' | 'sheetId'>[]
  }

  /**
   * Version 2 carries each note's `bbox` and `source`. Version 1 files import
   * unchanged — those fields are optional, and a note without a box simply
   * cannot be highlighted on the scan.
   *
   * Version 3 carries each sheet's `instrument`. Older files have none, which
   * reads as the flute — the only instrument they could have been made for.
   */
  interface Backup {
    format: 'fluteapp-backup'
    version: 1 | 2 | 3
    exportedAt: number
    sheets: BackupSheet[]
  }

  async function exportBackup(): Promise<Blob> {
    const all = await db.sheets.toArray()
    const payload: Backup = {
      format: 'fluteapp-backup',
      version: 3,
      exportedAt: Date.now(),
      sheets: await Promise.all(
        all.map(async (sheet) => {
          const notes = await notesFor(sheet.id)
          return {
            ...sheet,
            image: await blobToBase64(sheet.image),
            thumbnail: await blobToBase64(sheet.thumbnail),
            // Fields are listed explicitly rather than spread, to keep database
            // ids and sheet ids out of the file. That means every new SheetNote
            // field has to be added here too — omitting one loses it silently on
            // backup and restore, with nothing to signal the loss.
            notes: notes.map(({ note, index, chosenFingeringId, bbox, source }) => ({
              note,
              index,
              chosenFingeringId,
              bbox,
              source,
            })),
          }
        }),
      ),
    }
    return new Blob([JSON.stringify(payload)], { type: 'application/json' })
  }

  /** Returns how many sheets were added. Existing sheets are left untouched. */
  async function importBackup(file: Blob): Promise<number> {
    const parsed = JSON.parse(await file.text()) as Backup
    if (parsed?.format !== 'fluteapp-backup') {
      throw new Error('That file is not a FluteApp backup.')
    }

    let added = 0
    await db.transaction('rw', db.sheets, db.sheetNotes, async () => {
      for (const backup of parsed.sheets ?? []) {
        if (await db.sheets.get(backup.id)) continue
        const { image, thumbnail, notes, ...meta } = backup
        await db.sheets.add({
          ...meta,
          image: base64ToBlob(image),
          thumbnail: base64ToBlob(thumbnail),
        })
        await db.sheetNotes.bulkAdd(
          (notes ?? []).map((note, index) => ({
            ...note,
            index,
            id: newId(),
            sheetId: backup.id,
          })),
        )
        added++
      }
    })

    await loadAll()
    return added
  }

  return {
    sheets,
    loading,
    loadAll,
    get,
    notesFor,
    create,
    updateMeta,
    remove,
    replaceNotes,
    exportBackup,
    importBackup,
  }
})
