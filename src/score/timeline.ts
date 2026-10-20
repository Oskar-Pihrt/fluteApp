import { Note } from 'tonal'
import { durationTicks, measureTicks, type Score, TICKS_PER_QUARTER } from './model'
import { timeAt } from './ops'
import { playbackOrder } from './playback-order'

/**
 * A score laid out in time for playback: every event in playing order with
 * its start and length in seconds, and the metronome's beats. Pure, so the
 * arithmetic is tested apart from the audio.
 */

export interface TimedEvent {
  id: string
  /** Null for a rest. */
  pitch: string | null
  start: number
  duration: number
  /** False for the continuation of a tie: highlighted, not played again. */
  attack: boolean
}

export interface Beat {
  time: number
  /** The first beat of a measure. */
  accent: boolean
}

export interface Timeline {
  events: TimedEvent[]
  beats: Beat[]
  length: number
}

/** Seconds per tick at a tempo in quarter notes per minute. */
function secondsPerTick(tempo: number): number {
  return 60 / tempo / TICKS_PER_QUARTER
}

/** The beat the metronome clicks: the time signature's denominator, or dotted quarters in 6/8-type meters. */
function beatTicks(beats: number, beatType: number): number {
  const unit = (TICKS_PER_QUARTER * 4) / beatType
  return beatType === 8 && beats % 3 === 0 && beats > 3 ? unit * 3 : unit
}

export function buildTimeline(score: Score, tempo: number, startId: string | null = null): Timeline {
  const tick = secondsPerTick(tempo)
  const rhythm = score.mode === 'rhythm'
  const events: TimedEvent[] = []
  const beats: Beat[] = []
  let time = 0
  let lastSounding: TimedEvent | null = null
  let lastTied = false

  for (const measureIndex of playbackOrder(score)) {
    const measure = score.measures[measureIndex]
    const signature = timeAt(score, measureIndex)
    const length = rhythm
      ? measure.events.reduce((sum, e) => sum + (e.duration ? durationTicks(e.duration) : 0), 0)
      : measure.events.length * TICKS_PER_QUARTER
    const full = rhythm ? measureTicks(signature) : length
    // A short first measure is a pickup: its beats are the last ones of a bar.
    const beat = rhythm ? beatTicks(signature.beats, signature.beatType) : TICKS_PER_QUARTER
    const offset = rhythm && length < full ? full - length : 0
    for (let t = Math.ceil(offset / beat) * beat; t < full; t += beat) {
      beats.push({ time: time + (t - offset) * tick, accent: t === 0 })
    }

    let at = time
    for (const event of measure.events) {
      const ticks = rhythm ? (event.duration ? durationTicks(event.duration) : TICKS_PER_QUARTER) : TICKS_PER_QUARTER
      const seconds = ticks * tick
      if (event.kind === 'rest') {
        events.push({ id: event.id, pitch: null, start: at, duration: seconds, attack: false })
        lastSounding = null
        lastTied = false
      } else {
        const continues =
          rhythm && lastTied && lastSounding !== null && Note.midi(lastSounding.pitch ?? '') === Note.midi(event.pitch)
        if (continues && lastSounding) lastSounding.duration += seconds
        const timed: TimedEvent = { id: event.id, pitch: event.pitch, start: at, duration: seconds, attack: !continues }
        events.push(timed)
        if (!continues) lastSounding = timed
        lastTied = rhythm && !!event.tie
      }
      at += seconds
    }
    time += length * tick
  }

  const end = time
  if (!startId) return { events, beats, length: end }
  const from = events.find((e) => e.id === startId)
  if (!from) return { events, beats, length: end }
  const shift = from.start
  return {
    events: events
      .filter((e) => e.start >= shift)
      .map((e) => ({ ...e, start: e.start - shift, attack: e.id === startId ? true : e.attack })),
    beats: beats.filter((b) => b.time >= shift - 1e-9).map((b) => ({ ...b, time: b.time - shift })),
    length: end - shift,
  }
}
