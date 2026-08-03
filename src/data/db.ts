import Dexie, { type EntityTable } from 'dexie'

/**
 * Local, offline-first storage. No accounts and no server.
 *
 * Images are kept as Blobs inside IndexedDB rather than on the filesystem,
 * because IndexedDB behaves identically in a desktop browser and in the
 * Capacitor Android WebView — one code path instead of two.
 */

export interface Sheet {
  id: string
  title: string
  composer: string
  createdAt: number
  updatedAt: number
  image: Blob
  thumbnail: Blob
  /** Natural pixel size of the stored image, for correct aspect-ratio boxes. */
  imageWidth: number
  imageHeight: number
}

export interface SheetNote {
  id: string
  sheetId: string
  /** Position in the piece, 0-based and contiguous. */
  index: number
  /** Scientific pitch, e.g. "F#5". */
  note: string
  /** Set when the player picked something other than the primary fingering. */
  chosenFingeringId?: string
  /**
   * Where this note sits on the page, normalised 0–1 against the stored image.
   * Set by automatic detection so the note can be highlighted on the scan; absent
   * for notes typed in by hand.
   *
   * No Dexie version bump is needed for this or `source`: Dexie stores whole
   * objects and only *indexes* are declared in the schema, so adding unindexed
   * optional fields is transparent to existing databases.
   */
  bbox?: { x: number; y: number; width: number; height: number }
  /** How this note got here. Absent is treated as 'manual'. */
  source?: 'manual' | 'detected'
}

class FluteDatabase extends Dexie {
  sheets!: EntityTable<Sheet, 'id'>
  sheetNotes!: EntityTable<SheetNote, 'id'>

  constructor() {
    super('fluteapp')
    this.version(1).stores({
      sheets: 'id, createdAt, updatedAt, title',
      sheetNotes: 'id, sheetId, [sheetId+index]',
    })
  }
}

export const db = new FluteDatabase()

export function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}
