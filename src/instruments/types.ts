import type { CodeGrammar, Fingering } from '@/domain/fingering'
import type { InstrumentKey, KeyGroup, KeyId, Requirement } from '@/domain/keys'

export type InstrumentId = 'flute' | 'tenorSax'

export const INSTRUMENT_IDS: readonly InstrumentId[] = ['flute', 'tenorSax']

/** The optional hardware the player has — see `Requirement`. */
export type InstrumentConfig = readonly Requirement[]

/** A key is drawn from one or more primitives, all sharing its pressed state. */
export type Part =
  | { s: 'circle'; cx: number; cy: number; r: number }
  | { s: 'rect'; x: number; y: number; w: number; h: number; rx: number }
  | { s: 'arm'; x1: number; y1: number; x2: number; y2: number }
  | { s: 'ellipse'; cx: number; cy: number; rx: number; ry: number; rotate: number }
  | { s: 'path'; d: string }

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export interface KeyDrawing {
  parts: Part[]
  hit: Box
  /** Ring keys can be vented, which needs a hole drawn in the middle. */
  ring?: { cx: number; cy: number; r: number }
  /** Lettering drawn on the key, when the chart shows it. */
  text?: { x: number; y: number; size?: number }
}

/** Geometry of an instrument's fingering chart, in viewBox units. */
export interface ChartLayout {
  width: number
  height: number
  /** Rendered width in CSS pixels for each chart size. */
  pixelWidth: { sm: number; md: number; lg: number }
  drawings: Partial<Record<KeyId, KeyDrawing>>
  /** Decorative strokes that aren't keys (e.g. the divider between hands). */
  decorations?: Part[]
}

export interface Instrument {
  id: InstrumentId
  /** "Transverse flute" — headings and the app subtitle. */
  name: string
  /** "Flute" — the switch. */
  shortName: string
  /** "flute" — mid-sentence, as in "not on this flute". */
  noun: string
  keys: readonly InstrumentKey[]
  exclusiveGroups: readonly KeyGroup[]
  grammar: CodeGrammar
  fingerings: readonly Fingering[]
  chart: ChartLayout
  /**
   * Semitones from written to sounding pitch. Everything the player sees is
   * written pitch; only audio and Hz readouts apply this.
   */
  transposeSemitones: number
  /** What each octave is called, for the note library headings. */
  registerNames: Readonly<Record<number, string>>
  /** Octave the note picker opens on. */
  defaultPickerOctave: number
}

/** Badge text for a fingering's requirements. */
export const REQUIREMENT_LABELS: Record<Requirement, string> = {
  bFoot: 'B footjoint',
  openHole: 'Open hole',
  highFSharp: 'High F♯ key',
}
