/**
 * The app's own notation model: what a sheet *is*, independent of how it was
 * made (typed in, detected from a photo, imported from MusicXML) and of how
 * it is drawn.
 *
 * A score is a list of measures, each a list of events (notes and rests). It
 * has two modes:
 *
 *  - `pitches` — the order of pitches is what matters; durations are not
 *    shown and need not exist. Measures still exist, as the dividers the
 *    player sees. This is what every sheet was before scores had rhythm.
 *  - `rhythm` — every event has a duration, measures are checked against the
 *    time signature, and the piece can be played in tempo.
 *
 * A score switches between modes without losing anything: durations stay
 * stored while hidden.
 *
 * Everything here is plain data — it goes straight into IndexedDB, which
 * rejects Vue proxies, so the store always saves `toPlain` copies.
 */

export type DurationType = 'whole' | 'half' | 'quarter' | 'eighth' | '16th' | '32nd'

export const DURATION_TYPES: readonly DurationType[] = ['whole', 'half', 'quarter', 'eighth', '16th', '32nd']

export interface Duration {
  type: DurationType
  /** Augmentation dots: 0, 1 or 2. */
  dots: number
}

export interface NoteEvent {
  kind: 'note'
  id: string
  /** Written pitch, spelled: "F#5", "Bb4". */
  pitch: string
  /** Absent in pitches mode for notes that never had one. */
  duration?: Duration
  /** Tied into the next note (same pitch), which then isn't re-articulated. */
  tie?: boolean
  /** Set when the player picked something other than the primary fingering. */
  chosenFingeringId?: string
  /** Where the note sits on the sheet's image, normalised 0–1. Detected notes only. */
  bbox?: { x: number; y: number; width: number; height: number }
  source?: 'manual' | 'detected' | 'imported'
  /** Recogniser confidence, 0–1. Review-only, never saved. */
  confidence?: number
}

export interface RestEvent {
  kind: 'rest'
  id: string
  duration?: Duration
}

export type ScoreEvent = NoteEvent | RestEvent

export interface TimeSignature {
  beats: number
  beatType: number
  /** Drawn as C or ¢ instead of numbers. */
  symbol?: 'common' | 'cut'
}

/** Navigation marks a measure can carry, in reading order. */
export type Jump =
  | 'segno'
  | 'coda'
  | 'fine'
  | 'toCoda'
  | 'dc'
  | 'dcAlFine'
  | 'dcAlCoda'
  | 'ds'
  | 'dsAlFine'
  | 'dsAlCoda'

export interface Measure {
  id: string
  events: ScoreEvent[]
  /** A time signature starting here. The first measure's is the piece's. */
  time?: TimeSignature
  /** A key signature starting here, in fifths: −7 (7 flats) … 7 (7 sharps). */
  keyFifths?: number
  barStart?: 'repeatStart'
  barEnd?: 'double' | 'final' | 'repeatEnd'
  /** First/second ending: the passes this measure belongs to. */
  volta?: { numbers: number[] }
  jumps?: Jump[]
}

export interface Score {
  mode: 'pitches' | 'rhythm'
  clef: 'treble'
  measures: Measure[]
  /** Quarter notes per minute. */
  tempo?: number
}

/** Ticks per quarter note: enough for double-dotted 32nds to stay whole. */
export const TICKS_PER_QUARTER = 96

const BASE_TICKS: Record<DurationType, number> = {
  whole: 384,
  half: 192,
  quarter: 96,
  eighth: 48,
  '16th': 24,
  '32nd': 12,
}

export function durationTicks({ type, dots }: Duration): number {
  let ticks = BASE_TICKS[type]
  let add = ticks
  for (let i = 0; i < dots; i++) {
    add /= 2
    ticks += add
  }
  return ticks
}

export function measureTicks({ beats, beatType }: TimeSignature): number {
  return (beats * TICKS_PER_QUARTER * 4) / beatType
}

export const DEFAULT_TIME: TimeSignature = { beats: 4, beatType: 4 }

let counter = 0
/** Short ids for events and measures, unique within a session and across reloads. */
export function eventId(): string {
  counter = (counter + 1) % 1_000_000
  return `${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export function emptyScore(mode: Score['mode'] = 'pitches'): Score {
  return { mode, clef: 'treble', measures: [{ id: eventId(), events: [] }] }
}

/**
 * A deep plain copy: no Vue proxies, no transient fields (`confidence`), no
 * `undefined` keys. What IndexedDB and backups get.
 */
export function toPlain(score: Score): Score {
  return JSON.parse(
    JSON.stringify(score, (key, value) => (key === 'confidence' ? undefined : value)),
  ) as Score
}
