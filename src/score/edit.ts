import { Note } from 'tonal'
import {
  type Duration,
  durationTicks,
  eventId,
  type Measure,
  measureTicks,
  type NoteEvent,
  type Score,
  type ScoreEvent,
} from './model'
import { keyAt, measureFill, timeAt } from './ops'

/**
 * The editor's operations. Like everything in `src/score`, each returns a
 * new score and leaves its input alone — undo is keeping the old one.
 */

export interface Position {
  measure: number
  /** Index within the measure's events. */
  index: number
}

export function locate(score: Score, id: string): Position | null {
  for (let measure = 0; measure < score.measures.length; measure++) {
    const index = score.measures[measure].events.findIndex((e) => e.id === id)
    if (index !== -1) return { measure, index }
  }
  return null
}

export function eventById(score: Score, id: string): ScoreEvent | null {
  const at = locate(score, id)
  return at ? score.measures[at.measure].events[at.index] : null
}

function withMeasure(score: Score, index: number, change: (measure: Measure) => Measure): Score {
  return { ...score, measures: score.measures.map((m, i) => (i === index ? change(m) : m)) }
}

function measureTotal(measure: Measure): number {
  return measure.events.reduce((sum, e) => sum + (e.duration ? durationTicks(e.duration) : 0), 0)
}

/** Insert an event at a position. */
export function insertAt(score: Score, at: Position, event: ScoreEvent): Score {
  return withMeasure(score, at.measure, (m) => {
    const events = [...m.events]
    events.splice(at.index, 0, event)
    return { ...m, events }
  })
}

/**
 * Insert after an event, or at the very end with `null` — how notes are
 * typed in. In rhythm mode, typing past the end of a full last measure
 * starts a new measure rather than overfilling it.
 */
export function insertAfter(score: Score, afterId: string | null, event: ScoreEvent): Score {
  const lastMeasure = score.measures.length - 1
  const at = afterId ? locate(score, afterId) : null
  const position: Position = at
    ? { measure: at.measure, index: at.index + 1 }
    : { measure: lastMeasure, index: score.measures[lastMeasure].events.length }
  const measure = score.measures[position.measure]
  const atMeasureEnd = position.index === measure.events.length
  if (
    score.mode === 'rhythm' &&
    atMeasureEnd &&
    position.measure === lastMeasure &&
    measure.events.length > 0 &&
    measureTotal(measure) >= measureTicks(timeAt(score, position.measure))
  ) {
    return { ...score, measures: [...score.measures, { id: eventId(), events: [event] }] }
  }
  return insertAt(score, position, event)
}

/**
 * Remove an event. A measure left empty disappears — unless it is the only
 * one — and passes its time or key change, repeat start or jumps on to the
 * measure that now starts where it did.
 */
export function removeEvent(score: Score, id: string): Score {
  const at = locate(score, id)
  if (!at) return score
  const measures = score.measures.map((m, i) =>
    i === at.measure ? { ...m, events: m.events.filter((e) => e.id !== id) } : m,
  )
  const emptied = measures[at.measure]
  if (emptied.events.length || measures.length === 1) return { ...score, measures }
  const { id: _id, events: _events, barEnd: _barEnd, volta: _volta, ...carried } = emptied
  const rest = measures.filter((_, i) => i !== at.measure)
  if (at.measure < rest.length) rest[at.measure] = { ...carried, ...rest[at.measure] }
  return { ...score, measures: rest }
}

export function updateEvent(score: Score, id: string, change: (event: ScoreEvent) => ScoreEvent): Score {
  const at = locate(score, id)
  if (!at) return score
  return withMeasure(score, at.measure, (m) => ({
    ...m,
    events: m.events.map((e, i) => (i === at.index ? change(e) : e)),
  }))
}

export function updateNote(score: Score, id: string, change: (note: NoteEvent) => NoteEvent): Score {
  return updateEvent(score, id, (e) => (e.kind === 'note' ? change(e) : e))
}

export function setDuration(score: Score, id: string, duration: Duration): Score {
  return updateEvent(score, id, (e) => ({ ...e, duration }))
}

/** Cycle 0 → 1 → 2 → 0 dots. */
export function cycleDots(score: Score, id: string): Score {
  return updateEvent(score, id, (e) => ({
    ...e,
    duration: { type: e.duration?.type ?? 'quarter', dots: ((e.duration?.dots ?? 0) + 1) % 3 },
  }))
}

/** A note becomes a rest of the same length, a rest a note (at `pitch`). */
export function toggleRest(score: Score, id: string, pitch = 'B4'): Score {
  return updateEvent(score, id, (e): ScoreEvent => {
    const duration = e.duration ? { duration: e.duration } : {}
    return e.kind === 'note'
      ? { kind: 'rest', id: e.id, ...duration }
      : { kind: 'note', id: e.id, pitch, source: 'manual', ...duration }
  })
}

export function toggleTie(score: Score, id: string): Score {
  return updateNote(score, id, ({ tie, ...note }) => (tie ? note : { ...note, tie: true }))
}

/**
 * Spell a note with an explicit accidental on the same letter: ♯ (+1),
 * ♭ (−1) or ♮ (0). The chosen fingering belonged to the old pitch.
 */
export function setAccidental(score: Score, id: string, alter: -1 | 0 | 1): Score {
  return updateNote(score, id, ({ chosenFingeringId: _old, ...note }) => {
    const parsed = Note.get(note.pitch)
    if (parsed.empty || parsed.oct == null) return note
    const sign = alter > 0 ? '#' : alter < 0 ? 'b' : ''
    return { ...note, pitch: `${parsed.letter}${sign}${parsed.oct}` }
  })
}

/** Set or clear measure attributes; `undefined` in the patch removes one. */
export function patchMeasure(score: Score, index: number, patch: Partial<Omit<Measure, 'id' | 'events'>>): Score {
  return withMeasure(score, index, (m) => {
    const next: Measure = { ...m, ...patch }
    for (const [key, value] of Object.entries(patch)) {
      if (value === undefined) delete next[key as keyof Measure]
    }
    return next
  })
}

const SHARPS = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
const FLATS = ['B', 'E', 'A', 'D', 'G', 'C', 'F']

/** Letters a key signature alters, in fifths: 2 → F♯ and C♯. */
export function keyAlterations(fifths: number): Map<string, '#' | 'b'> {
  const letters = fifths >= 0 ? SHARPS.slice(0, fifths) : FLATS.slice(0, -fifths)
  return new Map(letters.map((letter) => [letter, fifths >= 0 ? '#' : 'b']))
}

/**
 * The pitch on a line or space of the treble staff (`relative` steps above
 * the bottom line, E4), as the key signature in force spells it.
 */
export function pitchAt(relative: number, fifths: number): string {
  const diatonic = Math.round(relative) + 2 + 4 * 7 // E4: letter index 2 of octave 4
  const letter = 'CDEFGAB'[((diatonic % 7) + 7) % 7]
  const octave = Math.floor(diatonic / 7)
  return `${letter}${keyAlterations(fifths).get(letter) ?? ''}${octave}`
}

/** The key signature in force where an event is. */
export function keyFor(score: Score, id: string): number {
  const at = locate(score, id)
  return keyAt(score, at?.measure ?? 0)
}

/**
 * Regroup the events from `from` onwards into measures of the time
 * signatures in force — the "fix measures" after edits have left some short
 * or long. Measures before `from` are untouched, so a pickup survives;
 * attributes stay with the measure number they were on.
 */
export function rebarFrom(score: Score, from: number): Score {
  const kept = score.measures.slice(0, from)
  const events = score.measures.slice(from).flatMap((m) => m.events)
  const measures: Measure[] = [...kept]
  let current: ScoreEvent[] = []
  let used = 0
  const attributesAt = (index: number) => {
    const source = score.measures[index]
    if (!source) return { id: eventId() }
    const { events: _events, ...attributes } = source
    return attributes
  }
  const capacityAt = (index: number) => {
    const probe: Score = { ...score, measures: [...measures, { ...attributesAt(index), events: [] }] }
    return measureTicks(timeAt(probe, index))
  }
  let capacity = capacityAt(measures.length)
  const close = () => {
    measures.push({ ...attributesAt(measures.length), events: current })
    current = []
    used = 0
    capacity = capacityAt(measures.length)
  }
  for (const event of events) {
    const ticks = event.duration ? durationTicks(event.duration) : 0
    if (used > 0 && used + ticks > capacity) close()
    current.push(event)
    used += ticks
    if (used >= capacity) close()
  }
  if (current.length || measures.length === kept.length) close()
  // Measures beyond the new last one keep nothing but would lose their
  // attributes; a final barline belongs on the new last measure.
  const last = measures[measures.length - 1]
  const finalBar = score.measures[score.measures.length - 1]?.barEnd
  if (finalBar === 'final' && !last.barEnd) measures[measures.length - 1] = { ...last, barEnd: 'final' }
  return { ...score, measures }
}

/** The first measure that doesn't add up, or −1. */
export function firstOffMeasure(score: Score): number {
  return measureFill(score).findIndex((fill) => fill !== 'ok')
}
