import { type Duration, type DurationType, durationTicks, type Jump, measureTicks, type TimeSignature } from '@/score/model'
import type { Detection } from './detector'
import type { Barline } from './glyphs'
import { buildMeasureNumbering } from './pitch'
import { staffForY } from './staves'
import type { Staff } from './types'

/**
 * Rhythm from detections: measures of notes and rests with durations, time
 * signatures, repeats, endings and navigation marks.
 *
 * The network reads each notehead's duration and dots where it sits, so this
 * never has to pair stems, beams and dots with noteheads. What it does do is
 * check every measure against the time signature: a measure that doesn't add
 * up gets the cheapest correction the network itself thought plausible (a
 * runner-up duration, a dot more or less, on one or two notes), and if none
 * fits it is reported for the player to fix.
 */

export interface RhythmNoteInput {
  /** Written pitch, after key, accidentals, ottava. */
  pitch: string
  /** Staff position, so a key-signature correction can re-spell the note. */
  relative?: number
  x: number
  staffIndex: number
  bbox: { x: number; y: number; width: number; height: number }
  confidence: number
  grace?: boolean
  /** Continues a tie from the note before. */
  tied?: boolean
  /** The network's durations for this head, most likely first. */
  durations?: { name: string; p: number }[]
  dots?: number
}

export interface RhythmEvent {
  kind: 'note' | 'rest'
  pitch?: string
  duration: Duration
  /** How sure the network was of the duration (0–1). */
  durationScore: number
  /** Tied into the next note. */
  tie?: boolean
  bbox?: RhythmNoteInput['bbox']
  confidence?: number
  relative?: number
}

export interface RhythmMeasure {
  events: RhythmEvent[]
  time?: TimeSignature
  barStart?: 'repeatStart'
  barEnd?: 'repeatEnd'
  volta?: { numbers: number[] }
  jumps?: Jump[]
  /** Whether its durations add up: as read, after a correction, or not at all. */
  fill: 'ok' | 'fixed' | 'off'
}

export interface Rhythm {
  measures: RhythmMeasure[]
}

const REST_DURATION: Record<string, DurationType> = {
  rest_whole: 'whole',
  rest_half: 'half',
  rest_quarter: 'quarter',
  rest_8th: 'eighth',
  rest_16th: '16th',
  rest_32nd: '32nd',
}

const TIME_CLASSES: Record<string, TimeSignature> = {
  ts_2_4: { beats: 2, beatType: 4 },
  ts_3_4: { beats: 3, beatType: 4 },
  ts_4_4: { beats: 4, beatType: 4 },
  ts_2_2: { beats: 2, beatType: 2 },
  ts_3_8: { beats: 3, beatType: 8 },
  ts_6_8: { beats: 6, beatType: 8 },
  ts_9_8: { beats: 9, beatType: 8 },
  ts_12_8: { beats: 12, beatType: 8 },
  ts_5_4: { beats: 5, beatType: 4 },
  ts_common: { beats: 4, beatType: 4, symbol: 'common' },
  ts_cut: { beats: 2, beatType: 2, symbol: 'cut' },
}

const JUMP_CLASSES: Record<string, Jump> = {
  segno: 'segno',
  coda: 'coda',
  fine: 'fine',
  to_coda: 'toCoda',
  dc: 'dc',
  dc_al_fine: 'dcAlFine',
  dc_al_coda: 'dcAlCoda',
  ds: 'ds',
  ds_al_fine: 'dsAlFine',
  ds_al_coda: 'dsAlCoda',
}

const DURATION_NAMES = new Set<string>(['whole', 'half', 'quarter', 'eighth', '16th', '32nd'])

export interface RhythmInput {
  notes: RhythmNoteInput[]
  detections: Detection[]
  staves: Staff[]
  barlines: Barline[]
  /** Staff space in the detections' pixels. */
  S: number
  /** Per staff, the x where the music starts (after clef and key). */
  contentStartX: number[]
}

/** A candidate reading of one event: its duration, and how likely the network found it. */
interface Option {
  duration: Duration
  p: number
}

function optionsFor(note: RhythmNoteInput): Option[] {
  const dots = Math.min(2, note.dots ?? 0)
  const ranked = (note.durations ?? []).filter((d) => DURATION_NAMES.has(d.name))
  if (!ranked.length) return [{ duration: { type: 'quarter', dots }, p: 0.5 }]
  const options: Option[] = []
  ranked.slice(0, 2).forEach((d, i) => {
    options.push({ duration: { type: d.name as DurationType, dots }, p: d.p })
    // A missed or phantom dot is the other common misread; tried at a cost.
    if (i === 0) {
      if (dots < 1) options.push({ duration: { type: d.name as DurationType, dots: 1 }, p: d.p * 0.25 })
      if (dots > 0) options.push({ duration: { type: d.name as DurationType, dots: 0 }, p: d.p * 0.25 })
    }
  })
  return options
}

/**
 * The most likely readings of a measure that add up to `target` ticks,
 * changing at most two events from their first choice. Null if none does.
 */
function fit(options: Option[][], target: number): Duration[] | null {
  const first = options.map((o) => o[0])
  const total = first.reduce((sum, o) => sum + durationTicks(o.duration), 0)
  if (total === target) return first.map((o) => o.duration)
  let best: { p: number; picks: Option[] } | null = null
  const consider = (picks: Option[]) => {
    const sum = picks.reduce((s, o) => s + durationTicks(o.duration), 0)
    if (sum !== target) return
    const p = picks.reduce((prod, o) => prod * o.p, 1)
    if (!best || p > best.p) best = { p, picks }
  }
  for (let i = 0; i < options.length; i++) {
    for (const alt of options[i].slice(1)) {
      const picks = [...first]
      picks[i] = alt
      consider(picks)
    }
  }
  if (!best && options.length <= 24) {
    for (let i = 0; i < options.length; i++) {
      for (let j = i + 1; j < options.length; j++) {
        for (const a of options[i].slice(1)) {
          for (const b of options[j].slice(1)) {
            const picks = [...first]
            picks[i] = a
            picks[j] = b
            consider(picks)
          }
        }
      }
    }
  }
  return best ? (best as { picks: Option[] }).picks.map((o) => o.duration) : null
}

export function assembleRhythm(input: RhythmInput): Rhythm {
  const { detections, staves, barlines, S } = input
  const measureAt = buildMeasureNumbering(barlines, staves.length)
  const staffOf = (d: Detection) => staffForY(staves, d.y)

  type Placed = { measure: number; x: number; staffIndex: number; event: RhythmEvent; options: Option[] }
  const placed: Placed[] = []

  for (const note of input.notes) {
    if (note.grace) continue
    const options = optionsFor(note)
    placed.push({
      measure: measureAt(note.x, note.staffIndex),
      x: note.x,
      staffIndex: note.staffIndex,
      options,
      event: {
        kind: 'note',
        pitch: note.pitch,
        duration: options[0].duration,
        durationScore: options[0].p,
        bbox: note.bbox,
        confidence: note.confidence,
        relative: note.relative,
      },
    })
  }

  for (const d of detections) {
    const type = REST_DURATION[d.cls]
    if (!type) continue
    const staff = staffOf(d)
    if (!staff || d.x < (input.contentStartX[staff.index] ?? staff.x0)) continue
    const duration: Duration = { type, dots: Math.min(2, d.dots ?? 0) }
    placed.push({
      measure: measureAt(d.x, staff.index),
      x: d.x,
      staffIndex: staff.index,
      options: [{ duration, p: d.score }],
      event: { kind: 'rest', duration, durationScore: d.score },
    })
  }
  placed.sort((a, b) => a.staffIndex - b.staffIndex || a.x - b.x)

  // Ties: a continuation marks the note before it as tied into it.
  let previousNote: Placed | null = null
  const tiedInto = new Set(input.notes.filter((n) => n.tied && !n.grace).map((n) => `${n.staffIndex}:${n.x}`))
  for (const p of placed) {
    if (p.event.kind !== 'note') continue
    if (previousNote && tiedInto.has(`${p.staffIndex}:${p.x}`)) previousNote.event.tie = true
    previousNote = p
  }

  // Measure numbers from the barlines can skip (a staff's last barline leaves
  // an empty segment after it): renumber by what actually has music.
  const numbers = [...new Set(placed.map((p) => p.measure))].sort((a, b) => a - b)
  const index = new Map(numbers.map((n, i) => [n, i]))
  const measures: RhythmMeasure[] = numbers.map(() => ({ events: [], fill: 'ok' }))
  const optionsOf: Option[][][] = numbers.map(() => [])
  for (const p of placed) {
    const i = index.get(p.measure)!
    measures[i].events.push(p.event)
    optionsOf[i].push(p.options)
  }

  /** The measure a mark at (x, staff) belongs to, nearest with music. */
  const measureFor = (x: number, staffIndex: number): number | null => {
    const raw = measureAt(x, staffIndex)
    const exact = index.get(raw)
    if (exact !== undefined) return exact
    const later = numbers.findIndex((n) => n > raw)
    return later === -1 ? (numbers.length ? numbers.length - 1 : null) : later
  }

  // ── Time signatures, repeats, endings, marks ─────────────────────────────
  for (const d of detections) {
    const staff = staffOf(d) ?? nearestStaff(staves, d.y)
    if (!staff) continue
    const time = TIME_CLASSES[d.cls]
    if (time) {
      const m = measureFor(d.x + S, staff.index)
      if (m !== null) measures[m].time = time
      continue
    }
    if (d.cls === 'repeat_start') {
      const m = measureFor(d.x + S, staff.index)
      if (m !== null) measures[m].barStart = 'repeatStart'
      continue
    }
    if (d.cls === 'repeat_end') {
      const m = measureFor(d.x - S, staff.index)
      if (m !== null) measures[m].barEnd = 'repeatEnd'
      continue
    }
    if (d.cls === 'volta') {
      const m = measureFor(d.x + S, staff.index)
      if (m !== null) measures[m].volta = { numbers: [] }
      continue
    }
    const jump = JUMP_CLASSES[d.cls]
    if (jump) {
      const m = measureFor(d.x, staff.index)
      if (m !== null && !measures[m].jumps?.includes(jump)) measures[m].jumps = [...(measures[m].jumps ?? []), jump]
    }
  }

  // Endings are numbered by where they fall: the one closing a repeat is the
  // first, the one right after it the second.
  measures.forEach((measure, i) => {
    if (!measure.volta) return
    const previous = measures[i - 1]
    const second = previous?.volta && previous.barEnd === 'repeatEnd'
    measure.volta = { numbers: [second ? 2 : 1] }
  })

  // ── Check every measure against its time signature ──────────────────────
  let time: TimeSignature = { beats: 4, beatType: 4 }
  measures.forEach((measure, i) => {
    if (measure.time) time = measure.time
    const target = measureTicks(time)
    const total = measure.events.reduce((sum, e) => sum + durationTicks(e.duration), 0)
    if (total === target) return
    // A pickup, or the bar that completes it at the end, is short on purpose.
    if ((i === 0 || i === measures.length - 1) && total < target) return
    // One rest alone in a measure is a whole-measure rest, whatever its glyph:
    // it lasts the measure, written as the one duration that does if any.
    if (measure.events.length === 1 && measure.events[0].kind === 'rest') {
      measure.events[0].duration = durationOfTicks(target) ?? measure.events[0].duration
      return
    }
    const fitted = fit(optionsOf[i], target)
    if (fitted) {
      measure.events.forEach((e, k) => (e.duration = fitted[k]))
      measure.fill = 'fixed'
    } else {
      measure.fill = 'off'
    }
  })

  return { measures }
}

/** The single plain or dotted duration lasting exactly `ticks`, if there is one. */
function durationOfTicks(ticks: number): Duration | null {
  for (const type of ['whole', 'half', 'quarter', 'eighth', '16th', '32nd'] as DurationType[]) {
    for (const dots of [0, 1, 2]) {
      if (durationTicks({ type, dots }) === ticks) return { type, dots }
    }
  }
  return null
}

function nearestStaff(staves: Staff[], y: number): Staff | null {
  let best: Staff | null = null
  let distance = Infinity
  for (const staff of staves) {
    const d = Math.min(Math.abs(y - staff.lines[0]), Math.abs(y - staff.lines[4]))
    if (d < distance) {
      distance = d
      best = staff
    }
  }
  return best
}
