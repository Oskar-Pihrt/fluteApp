import { transposeBy } from '@/domain/lookup'
import {
  DEFAULT_TIME,
  type Duration,
  durationTicks,
  eventId,
  type Measure,
  measureTicks,
  type NoteEvent,
  type Score,
  type ScoreEvent,
  type TimeSignature,
} from './model'

/**
 * Pure operations on scores. Nothing here mutates its input: every edit
 * returns a new score, which is what makes undo a matter of keeping the old
 * one.
 */

/** One event in reading order, and whether its measure ends after it. */
export interface SequenceItem {
  event: ScoreEvent
  /** The last event of a measure that isn't the last measure. */
  barAfter: boolean
}

/**
 * The score as one list in reading order — how the note strip, detection and
 * the quick fixes see it. `fromSequence` turns such a list back into
 * measures.
 */
export function toSequence(score: Score): SequenceItem[] {
  const items: SequenceItem[] = []
  score.measures.forEach((measure, index) => {
    measure.events.forEach((event, i) => {
      items.push({ event, barAfter: i === measure.events.length - 1 && index < score.measures.length - 1 })
    })
  })
  return items
}

/**
 * Measures rebuilt from a reading-order list, splitting after each `barAfter`.
 * Measure-level attributes (time and key changes, repeats, endings, jumps)
 * stay with their measure by position, taken from `template`.
 */
export function fromSequence(items: readonly SequenceItem[], template: Score): Score {
  const groups: ScoreEvent[][] = [[]]
  items.forEach((item, index) => {
    groups[groups.length - 1].push(item.event)
    if (item.barAfter && index < items.length - 1) groups.push([])
  })
  const measures: Measure[] = groups.map((events, index) => {
    const { events: _old, ...attributes } = template.measures[index] ?? { id: eventId(), events: [] }
    return { ...attributes, id: attributes.id ?? eventId(), events }
  })
  return { ...template, measures }
}

/** The notes of a score in reading order. */
export function notesOf(score: Score): NoteEvent[] {
  return score.measures.flatMap((m) => m.events.filter((e): e is NoteEvent => e.kind === 'note'))
}

/** What the app stored before scores: a pitch per note, a divider after some. */
export interface PitchListEntry {
  note: string
  chosenFingeringId?: string
  bbox?: NoteEvent['bbox']
  source?: 'manual' | 'detected'
  barAfter?: boolean
}

/** A pitches-mode score from the old note list: each divider ends a measure. */
export function fromPitchList(entries: readonly PitchListEntry[]): Score {
  const template: Score = { mode: 'pitches', clef: 'treble', measures: [] }
  return fromSequence(
    entries.map(({ note, chosenFingeringId, bbox, source, barAfter }) => ({
      event: {
        kind: 'note',
        id: eventId(),
        pitch: note,
        ...(chosenFingeringId ? { chosenFingeringId } : {}),
        ...(bbox ? { bbox: { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height } } : {}),
        ...(source ? { source } : {}),
      },
      barAfter: !!barAfter,
    })),
    template,
  )
}

/** The time signature in force at a measure. */
export function timeAt(score: Score, measureIndex: number): TimeSignature {
  for (let i = measureIndex; i >= 0; i--) {
    const time = score.measures[i]?.time
    if (time) return time
  }
  return DEFAULT_TIME
}

/** The key signature in force at a measure, in fifths. */
export function keyAt(score: Score, measureIndex: number): number {
  for (let i = measureIndex; i >= 0; i--) {
    const key = score.measures[i]?.keyFifths
    if (key !== undefined) return key
  }
  return 0
}

export type MeasureFill = 'ok' | 'under' | 'over' | 'missing'

/**
 * How each measure's durations add up against its time signature. A first
 * measure that is short is a pickup, not a mistake; so is a last measure
 * that completes it. `missing` means some event has no duration.
 */
export function measureFill(score: Score): MeasureFill[] {
  return score.measures.map((measure, index) => {
    if (measure.events.some((e) => !e.duration)) return 'missing'
    const total = measure.events.reduce((sum, e) => sum + durationTicks(e.duration!), 0)
    const expected = measureTicks(timeAt(score, index))
    if (total === expected) return 'ok'
    if (total > expected) return 'over'
    const pickup = index === 0 || index === score.measures.length - 1
    return pickup && total > 0 ? 'ok' : 'under'
  })
}

const QUARTER: Duration = { type: 'quarter', dots: 0 }

/**
 * Events regrouped into measures of `time`, in order. An event that doesn't
 * fit what is left of a measure starts the next one; the short measure it
 * leaves behind shows up in `measureFill`.
 */
export function rebar(events: readonly ScoreEvent[], time: TimeSignature): ScoreEvent[][] {
  const capacity = measureTicks(time)
  const measures: ScoreEvent[][] = [[]]
  let used = 0
  for (const event of events) {
    const ticks = durationTicks(event.duration ?? QUARTER)
    if (used > 0 && used + ticks > capacity) {
      measures.push([])
      used = 0
    }
    measures[measures.length - 1].push(event)
    used += ticks
    if (used >= capacity) {
      measures.push([])
      used = 0
    }
  }
  if (measures.length > 1 && !measures[measures.length - 1].length) measures.pop()
  return measures
}

/**
 * Switch a score to rhythm mode. A score that has always had durations just
 * shows them again. One that hasn't gives every note without a duration a
 * quarter and is regrouped into measures of the time signature — its old
 * dividers were phrase marks, not measures.
 */
export function toRhythmMode(score: Score, time: TimeSignature = timeAt(score, 0)): Score {
  const events = score.measures.flatMap((m) => m.events)
  if (events.every((e) => e.duration)) return { ...score, mode: 'rhythm' }
  const first = score.measures[0]
  const groups = rebar(
    events.map((e) => (e.duration ? e : { ...e, duration: QUARTER })),
    time,
  )
  return {
    ...score,
    mode: 'rhythm',
    measures: groups.map((group, index) => ({
      id: index === 0 ? first.id : eventId(),
      events: group,
      ...(index === 0 ? { time, ...(first.keyFifths !== undefined ? { keyFifths: first.keyFifths } : {}) } : {}),
    })),
  }
}

/** Switch to pitches mode. Durations stay stored, only hidden. */
export function toPitchesMode(score: Score): Score {
  return { ...score, mode: 'pitches' }
}

/** Key signature moved with a transposition, kept within seven accidentals. */
export function transposeFifths(fifths: number, semitones: number): number {
  let delta = (((semitones * 7) % 12) + 12) % 12
  if (delta > 6) delta -= 12
  let result = fifths + delta
  if (result > 7) result -= 12
  if (result < -7) result += 12
  return result
}

/**
 * The same music for an instrument `semitones` higher in written pitch —
 * notes spelled by interval, key signatures moved with them. Chosen
 * fingerings are dropped: they belonged to the old notes.
 */
export function transposeScore(score: Score, semitones: number): Score {
  if (!semitones) return score
  return {
    ...score,
    measures: score.measures.map((measure) => ({
      ...measure,
      ...(measure.keyFifths !== undefined ? { keyFifths: transposeFifths(measure.keyFifths, semitones) } : {}),
      events: measure.events.map((event) => {
        if (event.kind !== 'note') return event
        const { chosenFingeringId: _dropped, ...rest } = event
        return { ...rest, pitch: transposeBy(event.pitch, semitones) ?? event.pitch }
      }),
    })),
  }
}
