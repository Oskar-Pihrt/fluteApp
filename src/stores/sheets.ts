import { defineStore } from 'pinia'
import { ref } from 'vue'
import { db, newId, type Sheet, type SheetNote } from '@/data/db'
import { blobToBase64, base64ToBlob, prepareImage } from '@/data/images'
import { emptyScore, type Score, toPlain } from '@/score/model'
import { fromPitchList, transposeScore } from '@/score/ops'
import { isInstrumentId, loadInstrument } from '@/instruments'
import type { InstrumentId } from '@/instruments/types'

/**
 * The sheet-music library: CRUD over Dexie plus whole-library backup.
 *
 * Note sequences are stored as flat rows with a contiguous `index`, so the
 * automatic recogniser added later can bulk-insert suggestions into exactly the
 * same shape the manual editor writes.
 */
/**
 * The instrument a sheet is written for. Absent means the flute, the only
 * instrument older sheets could have been made for; an id this version doesn't
 * know (a backup from a newer one) falls back to it too.
 */
export function sheetInstrument(sheet: Pick<Sheet, 'instrument'>): InstrumentId {
  return isInstrumentId(sheet.instrument) ? sheet.instrument : 'flute'
}

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

  /** The pre-score note list, kept only for sheets that have no score row. */
  async function legacyNotes(sheetId: string): Promise<SheetNote[]> {
    const rows = await db.sheetNotes.where('sheetId').equals(sheetId).toArray()
    return rows.sort((a, b) => a.index - b.index)
  }

  /** A sheet's notation. Sheets from before scores are converted on the fly. */
  async function scoreFor(sheetId: string): Promise<Score> {
    const row = await db.scores.get(sheetId)
    return row ? row.score : fromPitchList(await legacyNotes(sheetId))
  }

  async function saveScore(sheetId: string, score: Score) {
    await db.transaction('rw', db.sheets, db.scores, async () => {
      await db.scores.put({ sheetId, score: toPlain(score) })
      await db.sheets.update(sheetId, { updatedAt: Date.now() })
    })
    await loadAll()
  }

  async function create(
    file: Blob,
    title: string,
    instrument: InstrumentId,
    composer = '',
    score: Score = emptyScore(),
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
    await db.transaction('rw', db.sheets, db.scores, async () => {
      await db.sheets.add(sheet)
      await db.scores.put({ sheetId: sheet.id, score: toPlain(score) })
    })
    await loadAll()
    return sheet.id
  }

  async function updateMeta(id: string, patch: Pick<Sheet, 'title' | 'composer' | 'description'>) {
    await db.sheets.update(id, { ...patch, updatedAt: Date.now() })
    await loadAll()
  }

  async function remove(id: string) {
    await db.transaction('rw', db.sheets, db.sheetNotes, db.scores, async () => {
      await db.sheetNotes.where('sheetId').equals(id).delete()
      await db.scores.delete(id)
      await db.sheets.delete(id)
    })
    await loadAll()
  }

  /**
   * Re-file a sheet under another instrument, rewriting every note into that
   * instrument's written pitch so it still sounds the same. Chosen fingerings
   * are dropped: they belong to the old instrument's keywork.
   */
  async function convertInstrument(sheetId: string, to: InstrumentId) {
    const sheet = await db.sheets.get(sheetId)
    if (!sheet) return
    const from = await loadInstrument(sheetInstrument(sheet))
    const target = await loadInstrument(to)
    const score = transposeScore(await scoreFor(sheetId), from.transposeSemitones - target.transposeSemitones)
    await db.transaction('rw', db.sheets, db.scores, async () => {
      await db.scores.put({ sheetId, score: toPlain(score) })
      await db.sheets.update(sheetId, { instrument: to, updatedAt: Date.now() })
    })
    await loadAll()
  }

  // ── Backup ────────────────────────────────────────────────────────────────
  // Local-only storage means the user carries the responsibility for their own
  // data, so export/import is a first-class feature rather than a debug tool.

  interface BackupSheet extends Omit<Sheet, 'image' | 'thumbnail'> {
    image: string
    thumbnail: string
    /** Versions 1–3: the note list. */
    notes?: Omit<SheetNote, 'id' | 'sheetId'>[]
    /** Version 4: the score. */
    score?: Score
  }

  /**
   * Version 2 carries each note's `bbox` and `source`. Version 1 files import
   * unchanged — those fields are optional, and a note without a box simply
   * cannot be highlighted on the scan.
   *
   * Version 3 carries each sheet's `instrument`. Older files have none, which
   * reads as the flute — the only instrument they could have been made for.
   *
   * Version 4 carries each sheet's `score` instead of a note list; older
   * note lists import as pitches-mode scores.
   *
   * The format id predates the TimbreMap name and stays, so every backup
   * ever exported still imports.
   */
  interface Backup {
    format: 'fluteapp-backup'
    version: 1 | 2 | 3 | 4
    exportedAt: number
    sheets: BackupSheet[]
  }

  async function exportBackup(): Promise<Blob> {
    const all = await db.sheets.toArray()
    const payload: Backup = {
      format: 'fluteapp-backup',
      version: 4,
      exportedAt: Date.now(),
      sheets: await Promise.all(
        all.map(async (sheet) => ({
          ...sheet,
          image: await blobToBase64(sheet.image),
          thumbnail: await blobToBase64(sheet.thumbnail),
          score: toPlain(await scoreFor(sheet.id)),
        })),
      ),
    }
    return new Blob([JSON.stringify(payload)], { type: 'application/json' })
  }

  /** Returns how many sheets were added. Existing sheets are left untouched. */
  async function importBackup(file: Blob): Promise<number> {
    const parsed = JSON.parse(await file.text()) as Backup
    if (parsed?.format !== 'fluteapp-backup') {
      throw new Error('That file is not a TimbreMap backup.')
    }

    let added = 0
    await db.transaction('rw', db.sheets, db.scores, async () => {
      for (const backup of parsed.sheets ?? []) {
        if (await db.sheets.get(backup.id)) continue
        const { image, thumbnail, notes, score, ...meta } = backup
        await db.sheets.add({
          ...meta,
          image: base64ToBlob(image),
          thumbnail: base64ToBlob(thumbnail),
        })
        await db.scores.put({ sheetId: backup.id, score: toPlain(score ?? fromPitchList(notes ?? [])) })
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
    scoreFor,
    saveScore,
    create,
    updateMeta,
    remove,
    convertInstrument,
    exportBackup,
    importBackup,
  }
})
