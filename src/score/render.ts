import type * as VexFlowModule from 'vexflow'
import { type MeasureFill, keyAt } from './ops'
import type { Duration, Jump, Measure, Score, ScoreEvent } from './model'

/**
 * Draws a score with VexFlow into an element, as a page: measures packed
 * into systems that fill the width, each system stretched to it. Returns
 * where every note landed, so taps can be hit-tested without asking the SVG.
 *
 * Pure of Vue; `ScoreView.vue` owns loading VexFlow, sizing and taps.
 */

export type VexFlow = typeof VexFlowModule

export interface RenderOptions {
  width: number
  selectedId?: string | null
  playingId?: string | null
  /** Notes worth a second look (low detection confidence). */
  flagged?: ReadonlySet<string>
  /** Per measure, rhythm mode only: measures that don't add up are tinted. */
  fill?: readonly MeasureFill[]
}

export interface NoteHit {
  id: string
  measureIndex: number
  x: number
  y: number
  width: number
  height: number
}

export interface StaveGeometry {
  measureIndex: number
  x: number
  width: number
  /** y of the bottom staff line, and the distance between lines. */
  bottomLineY: number
  spacing: number
}

export interface RenderResult {
  height: number
  hits: NoteHit[]
  staves: StaveGeometry[]
}

const SELECTED = '#2f7a20'
const FLAGGED = '#b45309'
const OFF_TINT = 'rgba(217, 119, 6, 0.14)'

const SYSTEM_HEIGHT = 120
const TOP_MARGIN = 34
const EMPTY_MEASURE = 70

const KEY_NAMES = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#']

export function keyName(fifths: number): string {
  return KEY_NAMES[Math.max(-7, Math.min(7, fifths)) + 7]
}

const VF_DURATION: Record<Duration['type'], string> = {
  whole: 'w',
  half: 'h',
  quarter: 'q',
  eighth: '8',
  '16th': '16',
  '32nd': '32',
}

/** "F#5" → "f#/5", the way VexFlow spells keys. */
function vfKey(pitch: string): string {
  const match = /^([A-G])(#{1,2}|b{1,2})?(-?\d)$/.exec(pitch)
  if (!match) return 'b/4'
  return `${match[1].toLowerCase()}${match[2] ?? ''}/${match[3]}`
}

/** The time signature drawn at a measure: none in pitches mode, where nothing has a duration. */
function timeSpec(score: Score, index: number): string | null {
  if (score.mode !== 'rhythm') return null
  const measure = score.measures[index]
  if (!measure.time) return index === 0 ? '4/4' : null
  if (measure.time.symbol === 'common') return 'C'
  if (measure.time.symbol === 'cut') return 'C|'
  return `${measure.time.beats}/${measure.time.beatType}`
}

/** Notes, rests and beams for one measure, freshly built (VexFlow notes can't be formatted twice). */
function buildMeasure(VF: VexFlow, score: Score, measure: Measure, options: RenderOptions) {
  const rhythm = score.mode === 'rhythm'
  const notes: VexFlowModule.StaveNote[] = []
  const byId = new Map<string, VexFlowModule.StaveNote>()
  for (const event of measure.events) {
    if (event.kind === 'rest' && !rhythm) continue
    const duration = rhythm ? (event.duration ?? { type: 'quarter', dots: 0 }) : { type: 'quarter' as const, dots: 0 }
    const note = new VF.StaveNote({
      keys: [event.kind === 'note' ? vfKey(event.pitch) : 'b/4'],
      duration: VF_DURATION[duration.type] + (event.kind === 'rest' ? 'r' : ''),
      dots: duration.dots,
      autoStem: true,
    })
    for (let i = 0; i < duration.dots; i++) VF.Dot.buildAndAttach([note], { all: true })
    const color = colorFor(event, options)
    if (color) note.setStyle({ fillStyle: color, strokeStyle: color })
    // Pitches mode: noteheads alone — no stem promises a duration. After the
    // colour, which would otherwise paint the stem back in.
    if (!rhythm) note.setStemStyle({ strokeStyle: 'transparent', fillStyle: 'transparent' })
    notes.push(note)
    byId.set(event.id, note)
  }
  return { notes, byId }
}

function colorFor(event: ScoreEvent, options: RenderOptions): string | null {
  if (event.id === options.playingId || event.id === options.selectedId) return SELECTED
  if (options.flagged?.has(event.id)) return FLAGGED
  return null
}

function voiceFor(VF: VexFlow, notes: VexFlowModule.StaveNote[]) {
  const voice = new VF.Voice({ numBeats: 4, beatValue: 4 })
  // Measures needn't add up: a pitches-mode measure has no durations, and a
  // rhythm one being edited may be short or long.
  voice.setMode(VF.Voice.Mode.SOFT)
  voice.addTickables(notes)
  return voice
}

/** The space a measure's notes need, before any stretching. */
function contentWidth(VF: VexFlow, score: Score, measure: Measure, keySpec: string): number {
  const { notes } = buildMeasure(VF, score, measure, { width: 0 })
  if (!notes.length) return EMPTY_MEASURE
  const voice = voiceFor(VF, notes)
  VF.Accidental.applyAccidentals([voice], keySpec)
  const formatter = new VF.Formatter().joinVoices([voice])
  return Math.max(EMPTY_MEASURE, formatter.preCalculateMinTotalWidth([voice]) + 28 + notes.length * 6)
}

/** Room the clef, key and time signatures take at the start of a stave. */
function headerWidth(score: Score, index: number, startsSystem: boolean): number {
  const measure = score.measures[index]
  let width = 0
  const key = keyAt(score, index)
  if (startsSystem) width += 34 + Math.abs(key) * 10 + (key ? 8 : 0)
  else if (measure.keyFifths !== undefined) width += Math.abs(measure.keyFifths) * 10 + 14
  if (timeSpec(score, index)) width += 30
  if (measure.barStart) width += 12
  return width
}

/** Greedy line breaking: as many measures per system as fit the width. */
function systemsFor(widths: number[], score: Score, width: number): number[][] {
  const systems: number[][] = []
  let current: number[] = []
  let used = 0
  widths.forEach((content, index) => {
    const needed = content + headerWidth(score, index, current.length === 0)
    if (current.length && used + needed > width) {
      systems.push(current)
      current = []
      used = content + headerWidth(score, index, true)
    } else {
      used += needed
    }
    current.push(index)
  })
  if (current.length) systems.push(current)
  return systems
}

function repetitionType(VF: VexFlow, jump: Jump): number {
  const t = VF.Repetition.type
  switch (jump) {
    case 'segno':
      return t.SEGNO_LEFT
    case 'coda':
      return t.CODA_LEFT
    case 'fine':
      return t.FINE
    case 'toCoda':
      return t.TO_CODA
    case 'dc':
      return t.DC
    case 'dcAlFine':
      return t.DC_AL_FINE
    case 'dcAlCoda':
      return t.DC_AL_CODA
    case 'ds':
      return t.DS
    case 'dsAlFine':
      return t.DS_AL_FINE
    case 'dsAlCoda':
      return t.DS_AL_CODA
  }
}

function voltaType(VF: VexFlow, score: Score, index: number): number {
  const same = (other?: Measure) =>
    !!other?.volta && JSON.stringify(other.volta.numbers) === JSON.stringify(score.measures[index].volta?.numbers)
  const begins = !same(score.measures[index - 1])
  const ends = !same(score.measures[index + 1])
  if (begins && ends) return VF.VoltaType.BEGIN_END
  if (begins) return VF.VoltaType.BEGIN
  if (ends) return VF.VoltaType.END
  return VF.VoltaType.MID
}

export function renderScore(VF: VexFlow, element: HTMLDivElement, score: Score, options: RenderOptions): RenderResult {
  element.innerHTML = ''
  const width = Math.max(240, Math.floor(options.width))
  const keys = score.measures.map((_, index) => keyName(keyAt(score, index)))
  const contents = score.measures.map((measure, index) => contentWidth(VF, score, measure, keys[index]))
  const systems = systemsFor(contents, score, width - 2)

  const height = TOP_MARGIN + systems.length * SYSTEM_HEIGHT
  const renderer = new VF.Renderer(element, VF.Renderer.Backends.SVG)
  renderer.resize(width, height)
  const context = renderer.getContext()

  const hits: NoteHit[] = []
  const staves: StaveGeometry[] = []
  const placed = new Map<string, { note: VexFlowModule.StaveNote; system: number }>()

  systems.forEach((system, systemIndex) => {
    const y = TOP_MARGIN - 20 + systemIndex * SYSTEM_HEIGHT
    const headers = system.map((index, i) => headerWidth(score, index, i === 0))
    const natural = system.reduce((sum, index, i) => sum + contents[index] + headers[i], 0)
    const last = systemIndex === systems.length - 1
    // Stretch every system to the width, except a last one that is still
    // mostly empty — a lone measure spread across the page reads badly.
    const headerTotal = headers.reduce((a, b) => a + b, 0)
    const stretch = last && natural < (width - 2) * 0.6 ? 1 : (width - 2 - headerTotal) / (natural - headerTotal)
    let x = 0

    system.forEach((index, i) => {
      const measure = score.measures[index]
      const staveWidth = headers[i] + contents[index] * stretch
      const stave = new VF.Stave(x, y, staveWidth)
      if (i === 0) {
        stave.addClef('treble')
        if (keyAt(score, index)) stave.addKeySignature(keys[index])
      } else if (measure.keyFifths !== undefined) {
        stave.addKeySignature(keys[index], keys[index - 1])
      }
      const time = timeSpec(score, index)
      if (time) stave.addTimeSignature(time)
      if (measure.barStart === 'repeatStart') stave.setBegBarType(VF.BarlineType.REPEAT_BEGIN)
      if (measure.barEnd === 'repeatEnd') stave.setEndBarType(VF.BarlineType.REPEAT_END)
      else if (measure.barEnd === 'final' || index === score.measures.length - 1) stave.setEndBarType(VF.BarlineType.END)
      else if (measure.barEnd === 'double') stave.setEndBarType(VF.BarlineType.DOUBLE)
      if (measure.volta) stave.setVoltaType(voltaType(VF, score, index), `${measure.volta.numbers.join(', ')}.`, -6)
      for (const jump of measure.jumps ?? []) stave.setRepetitionType(repetitionType(VF, jump))
      stave.setContext(context)

      const fill = options.fill?.[index]
      if (score.mode === 'rhythm' && fill && fill !== 'ok') {
        context.save()
        context.setFillStyle(OFF_TINT)
        context.fillRect(x + 1, stave.getYForLine(0) - 14, staveWidth - 2, stave.getYForLine(4) - stave.getYForLine(0) + 28)
        context.restore()
      }
      stave.draw()

      const { notes, byId } = buildMeasure(VF, score, measure, options)
      if (notes.length) {
        const voice = voiceFor(VF, notes)
        VF.Accidental.applyAccidentals([voice], keys[index])
        new VF.Formatter().joinVoices([voice]).formatToStave([voice], stave)
        const beams = score.mode === 'rhythm' ? VF.Beam.generateBeams(notes.filter((n) => !n.isRest())) : []
        voice.draw(context, stave)
        beams.forEach((beam) => beam.setContext(context).draw())
      }
      for (const [id, note] of byId) {
        placed.set(id, { note, system: systemIndex })
        const box = note.getBoundingBox()
        if (box) hits.push({ id, measureIndex: index, x: box.getX(), y: box.getY(), width: box.getW(), height: box.getH() })
      }
      staves.push({
        measureIndex: index,
        x,
        width: staveWidth,
        bottomLineY: stave.getYForLine(4),
        spacing: stave.getSpacingBetweenLines(),
      })
      x += staveWidth
    })
  })

  // Ties, last: they can cross measures and systems.
  if (score.mode === 'rhythm') {
    const events = score.measures.flatMap((m) => m.events)
    events.forEach((event, i) => {
      if (event.kind !== 'note' || !event.tie) return
      const next = events.slice(i + 1).find((e) => e.kind === 'note')
      const from = placed.get(event.id)
      const to = next && placed.get(next.id)
      if (!from) return
      if (to && to.system === from.system) {
        new VF.StaveTie({ firstNote: from.note, lastNote: to.note, firstIndexes: [0], lastIndexes: [0] })
          .setContext(context)
          .draw()
      } else {
        new VF.StaveTie({ firstNote: from.note, lastNote: null, firstIndexes: [0], lastIndexes: [0] })
          .setContext(context)
          .draw()
        if (to) {
          new VF.StaveTie({ firstNote: null, lastNote: to.note, firstIndexes: [0], lastIndexes: [0] })
            .setContext(context)
            .draw()
        }
      }
    })
  }

  return { height, hits, staves }
}
