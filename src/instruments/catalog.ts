import type { CatalogGroup, InstrumentId, InstrumentMeta, InstrumentOption } from './types'

/**
 * Every instrument the app knows, described without its keys, chart or
 * fingerings — those are loaded on demand (`index.ts`). This file ships with
 * the app shell, so it stays small: names, transposition, register names and
 * the options a player can set.
 */

/** Headings of the instrument picker, in order. */
export const CATALOG_GROUPS: readonly { id: CatalogGroup; label: string }[] = [
  { id: 'flutes', label: 'Flutes' },
  { id: 'saxophones', label: 'Saxophones' },
]

const FLUTE_OPTIONS: readonly InstrumentOption[] = [
  {
    kind: 'choice',
    heading: 'Footjoint',
    choices: [
      { label: 'C foot', description: 'Lowest note C4', requirement: null },
      { label: 'B foot', description: 'Lowest note B3, plus gizmo key', requirement: 'bFoot' },
    ],
    default: 0,
  },
  {
    kind: 'toggle',
    heading: 'Holes',
    requirement: 'openHole',
    label: 'Open hole (French)',
    description: 'Unlocks fingerings that need a partly uncovered tone hole.',
    default: false,
  },
]

const SAX_OPTIONS: readonly InstrumentOption[] = [
  {
    kind: 'toggle',
    heading: 'Keys',
    requirement: 'highFSharp',
    label: 'High F♯ key',
    description: 'Adds the top F♯ (written F♯6) that needs the C5 key.',
    default: true,
  },
]

type SaxSpec = Pick<InstrumentMeta, 'id' | 'name' | 'shortName' | 'noun' | 'transposeSemitones'>

/**
 * Every saxophone shares one keywork, one chart and one written-pitch
 * fingering table; what sets them apart is only how far below written they
 * sound.
 */
function saxophone(spec: SaxSpec): InstrumentMeta {
  return {
    ...spec,
    family: 'sax',
    group: 'saxophones',
    dataModule: 'saxophone',
    idPrefix: `${spec.id}:`,
    registerNames: {
      3: 'Low register',
      4: 'Low register',
      5: 'Middle register',
      6: 'Palm keys',
    },
    defaultPickerOctave: 4,
    musicXmlNames: [spec.noun, spec.shortName, 'sax'],
    options: SAX_OPTIONS,
    expectedRange: ['A#3', 'F#6'],
  }
}

export const CATALOG: Record<InstrumentId, InstrumentMeta> = {
  flute: {
    id: 'flute',
    name: 'Transverse flute',
    shortName: 'Flute',
    noun: 'flute',
    family: 'flute',
    group: 'flutes',
    dataModule: 'flute',
    // No id prefix: flute ids predate the instrument switch and are stored in
    // saved sheets as `chosenFingeringId`.
    idPrefix: '',
    transposeSemitones: 0,
    // Registers are how flutists actually think about the range.
    registerNames: {
      3: 'Low register',
      4: 'Low register',
      5: 'Middle register',
      6: 'High register',
      7: 'High register',
    },
    defaultPickerOctave: 5,
    musicXmlNames: ['flute', 'flauto', 'flöte'],
    options: FLUTE_OPTIONS,
    expectedRange: ['B3', 'C7'],
  },
  altoSax: saxophone({
    id: 'altoSax',
    name: 'Alto saxophone',
    shortName: 'Alto',
    noun: 'alto sax',
    // E♭ instrument: written C5 sounds E♭4, a major sixth down.
    transposeSemitones: -9,
  }),
  tenorSax: saxophone({
    id: 'tenorSax',
    name: 'Tenor saxophone',
    shortName: 'Tenor',
    noun: 'tenor sax',
    // B♭ instrument an octave down: written D5 sounds C4.
    transposeSemitones: -14,
  }),
}

export function isInstrumentId(value: unknown): value is InstrumentId {
  return typeof value === 'string' && Object.hasOwn(CATALOG, value)
}
