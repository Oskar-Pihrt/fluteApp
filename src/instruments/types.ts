import type { CodeParser, Fingering, FingeringSpec } from '@/domain/fingering'
import type { InstrumentKey, KeyGroup, KeyId, Requirement } from '@/domain/keys'

/**
 * Every instrument the app knows, in the order the catalog lists them. The
 * lightweight description of each lives in `catalog.ts`; its keys, chart and
 * fingerings are loaded only when the player uses it.
 */
export const INSTRUMENT_IDS = [
  'flute',
  'piccolo',
  'altoFlute',
  'bassFlute',
  'sopraninoSax',
  'sopranoSax',
  'altoSax',
  'tenorSax',
  'baritoneSax',
  'bassSax',
  'clarinetEb',
  'clarinetBb',
  'clarinetA',
  'bassetHorn',
  'altoClarinet',
  'bassClarinet',
  'clarinetEbOehler',
  'clarinetBbOehler',
  'clarinetAOehler',
  'oboe',
  'oboeDamore',
  'englishHorn',
  'recorderSopraninoBaroque',
  'recorderSopranoBaroque',
  'recorderAltoBaroque',
  'recorderTenorBaroque',
  'recorderSopraninoGerman',
  'recorderSopranoGerman',
  'recorderAltoGerman',
  'recorderTenorGerman',
  'whistleD',
  'whistleC',
  'whistleBb',
  'whistleEb',
  'whistleF',
  'whistleG',
  'whistleLowA',
  'whistleLowD',
  'trumpetBb',
  'trumpetC',
  'trumpetD',
  'trumpetEb',
  'piccoloTrumpet',
  'cornet',
  'flugelhorn',
  'hornF',
  'hornDouble',
  'baritoneHorn',
  'euphonium',
  'trombone',
  'tenorbassTrombone',
  'ocarina',
] as const

export type InstrumentId = (typeof INSTRUMENT_IDS)[number]

/** Instruments that share tone colour. */
export type InstrumentFamily = 'flute' | 'sax' | 'clarinet' | 'oboe' | 'recorder' | 'whistle' | 'brass' | 'ocarina'

/** Headings the instrument picker groups the catalog under. */
export type CatalogGroup = 'flutes' | 'saxophones' | 'clarinets' | 'doubleReeds' | 'recorders' | 'whistles' | 'ocarinas' | 'brass'

/**
 * A lazily loaded bundle of keys, chart and fingerings. Several instruments
 * can share one — every saxophone fingers the same way.
 */
export type DataModuleId = 'flute' | 'saxophone' | 'clarinetBoehm' | 'clarinetOehler' | 'oboe' | 'recorderBaroque' | 'recorderGerman' | 'whistle' | 'trumpet' | 'euphonium' | 'hornF' | 'hornDouble' | 'trombone' | 'ocarina'

/** The optional hardware the player has — see `Requirement`. */
export type InstrumentConfig = readonly Requirement[]

/**
 * A piece of optional hardware the player tells the app about in Setup. A
 * `choice` picks one of several builds (C or B footjoint); a `toggle` is a key
 * or feature the instrument has or hasn't.
 */
export type InstrumentOption =
  | {
      kind: 'choice'
      heading: string
      choices: readonly { label: string; description: string; requirement: Requirement | null }[]
      /** Index of the choice a new player starts with. */
      default: number
    }
  | {
      kind: 'toggle'
      heading: string
      requirement: Requirement
      label: string
      description: string
      default: boolean
    }

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
  /**
   * Parts filled when the key is only partly closed — a recorder's double
   * hole shows just its small hole covered. Without it, and without a
   * `ring`, a partly closed key is drawn half filled.
   */
  partialParts?: number[]
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
  /**
   * Centre of the empty spot, in viewBox units, where the finger finder echoes
   * the matched note on a phone. May lie outside the chart, in the margin.
   */
  matchAnchor: { x: number; y: number }
}

/** Where a fingering table comes from, for the note in Setup. */
export interface DataSource {
  /** "Fingerings are transcribed from" — runs into the link. */
  intro: string
  /** "The Woodwind Fingering Guide" */
  linkText: string
  url: string
  /** "basic charts for flute, octaves 1–3." — follows the link. */
  outro: string
}

/**
 * What the app knows about an instrument before loading it: enough to list it,
 * switch to it, transpose for it and play its pitch.
 */
export interface InstrumentMeta {
  id: InstrumentId
  /** "Transverse flute" — headings, the switch menu and the app subtitle. */
  name: string
  /** "Flute" — the closed switch, where space is tight. */
  shortName: string
  /** "flute" — mid-sentence, as in "not on this flute". */
  noun: string
  family: InstrumentFamily
  group: CatalogGroup
  dataModule: DataModuleId
  /** Prepended to fingering ids, which saved sheets store. */
  idPrefix: string
  /**
   * Semitones from written to sounding pitch. Everything the player sees is
   * written pitch; only audio and Hz readouts apply this.
   */
  transposeSemitones: number
  /** What each octave is called, for the note library headings. */
  registerNames: Readonly<Record<number, string>>
  /** Octave the note picker opens on. */
  defaultPickerOctave: number
  /** Words that identify this instrument's part in a MusicXML score. */
  musicXmlNames: readonly string[]
  options: readonly InstrumentOption[]
  /**
   * Keys of the shared data module this instrument doesn't have — the
   * piccolo's missing footjoint, the baritone-only low A on other saxes.
   * They are left off the chart, and fingerings using them are dropped.
   */
  omitKeys?: readonly KeyId[]
  /** Written notes outside this range are dropped from the shared fingerings. */
  writtenRange?: readonly [string, string]
  /**
   * Semitones the shared fingerings are moved by: an F recorder plays the C
   * recorder's fingering a fourth higher.
   */
  fingeringShift?: number
  /**
   * Written range, lowest and highest note, with every option on. The data is
   * the source of truth for the range; this is what a test holds it to.
   */
  expectedRange: readonly [string, string]
}

/** What a data module provides. Shared by every instrument that uses it. */
export interface InstrumentData {
  keys: readonly InstrumentKey[]
  /**
   * Canonical key order. Fingering ids are built in this order and saved
   * sheets store them, so it must never change for an existing instrument.
   */
  keyOrder: readonly KeyId[]
  exclusiveGroups: readonly KeyGroup[]
  parse: CodeParser
  specs: readonly FingeringSpec[]
  chart: ChartLayout
  /** What a partly closed key means here, e.g. "ring depressed, hole open". */
  partialLabel: string
  /** Hardware any partly closed key needs, if any. */
  partialRequires?: Requirement
  source: DataSource
}

/** A loaded instrument: its description, keywork, chart and fingerings. */
export interface Instrument extends InstrumentMeta, Omit<InstrumentData, 'specs' | 'parse'> {
  fingerings: readonly Fingering[]
}

/** Badge text for a fingering's requirements. */
export const REQUIREMENT_LABELS: Record<Requirement, string> = {
  bFoot: 'B footjoint',
  openHole: 'Open hole',
  highFSharp: 'High F♯ key',
  lowA: 'Low A key',
  leftAb: 'Left A♭ key',
  leftBb: 'Left B♭ key',
  lowC: 'Low C extension',
  lowBb: 'Low B♭ key',
  leftF: 'Left F key',
  thirdOctaveKey: 'Third octave key',
  fourthValve: 'Fourth valve',
  fTrigger: 'F trigger',
}
