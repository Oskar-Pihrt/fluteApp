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

/** High F♯ is standard on modern saxophones, but not on every bass. */
function saxOptions(highFSharpByDefault: boolean, lowA = false): readonly InstrumentOption[] {
  return [
    {
      kind: 'toggle',
      heading: 'Keys',
      requirement: 'highFSharp',
      label: 'High F♯ key',
      description: 'Adds the top F♯ (written F♯6) that needs the C5 key.',
      default: highFSharpByDefault,
    },
    ...(lowA
      ? [
          {
            kind: 'toggle',
            heading: 'Low A',
            requirement: 'lowA',
            label: 'Low A key',
            description: 'The thumb key for written low A, on most modern baritones.',
            default: true,
          } as const,
        ]
      : []),
  ]
}

type SaxSpec = Pick<InstrumentMeta, 'id' | 'name' | 'shortName' | 'noun' | 'transposeSemitones'> & {
  musicXmlNames: readonly string[]
  /** The baritone's low A key; the other sizes don't have it. */
  lowA?: boolean
  highFSharpByDefault?: boolean
}

/**
 * Every saxophone shares one keywork, one chart and one written-pitch
 * fingering table; what sets them apart is how far below written they sound,
 * and the baritone's extra low A.
 */
function saxophone({ lowA = false, highFSharpByDefault = true, ...spec }: SaxSpec): InstrumentMeta {
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
    options: saxOptions(highFSharpByDefault, lowA),
    omitKeys: lowA ? [] : ['LOW_A'],
    expectedRange: [lowA ? 'A3' : 'A#3', 'F#6'],
  }
}

type FluteSpec = Pick<
  InstrumentMeta,
  'id' | 'name' | 'shortName' | 'noun' | 'transposeSemitones' | 'musicXmlNames' | 'registerNames'
> & { writtenRange: readonly [string, string]; omitKeys: readonly string[] }

/**
 * The flute's relatives finger like it, on a smaller or larger tube with less
 * keywork: the C flute's chart and fingerings, without the keys they lack and
 * the notes beyond their range. Closed-hole, as they usually are.
 */
function fluteRelative({ writtenRange, ...spec }: FluteSpec): InstrumentMeta {
  return {
    ...spec,
    family: 'flute',
    group: 'flutes',
    dataModule: 'flute',
    idPrefix: `${spec.id}:`,
    defaultPickerOctave: 5,
    options: [],
    writtenRange,
    expectedRange: writtenRange,
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
  piccolo: fluteRelative({
    id: 'piccolo',
    name: 'Piccolo',
    shortName: 'Piccolo',
    noun: 'piccolo',
    // Written an octave below where it sounds.
    transposeSemitones: 12,
    // No footjoint: the lowest note is D.
    writtenRange: ['D4', 'C7'],
    omitKeys: ['FOOT_CSHARP', 'FOOT_C', 'FOOT_B', 'GIZMO'],
    registerNames: { 4: 'Low register', 5: 'Middle register', 6: 'High register', 7: 'High register' },
    musicXmlNames: ['piccolo', 'ottavino'],
  }),
  altoFlute: fluteRelative({
    id: 'altoFlute',
    name: 'Alto flute in G',
    shortName: 'Alto flute',
    noun: 'alto flute',
    // G instrument: written C5 sounds G4, a fourth down.
    transposeSemitones: -5,
    // C footjoint; the third octave thins out above C7.
    writtenRange: ['C4', 'C7'],
    omitKeys: ['FOOT_B', 'GIZMO'],
    registerNames: { 4: 'Low register', 5: 'Middle register', 6: 'High register', 7: 'High register' },
    musicXmlNames: ['alto flute', 'flauto contralto', 'altflöte'],
  }),
  bassFlute: fluteRelative({
    id: 'bassFlute',
    name: 'Bass flute',
    shortName: 'Bass flute',
    noun: 'bass flute',
    // An octave below the C flute.
    transposeSemitones: -12,
    // Three octaves from the C foot; the very top is rarely written.
    writtenRange: ['C4', 'C7'],
    omitKeys: ['FOOT_B', 'GIZMO'],
    registerNames: { 4: 'Low register', 5: 'Middle register', 6: 'High register', 7: 'High register' },
    musicXmlNames: ['bass flute', 'flauto basso', 'bassflöte'],
  }),
  sopraninoSax: saxophone({
    id: 'sopraninoSax',
    name: 'Sopranino saxophone',
    shortName: 'Sopranino',
    noun: 'sopranino sax',
    // E♭ instrument above written: written C5 sounds E♭5, a minor third up.
    transposeSemitones: 3,
    musicXmlNames: ['sopranino'],
  }),
  sopranoSax: saxophone({
    id: 'sopranoSax',
    name: 'Soprano saxophone',
    shortName: 'Soprano',
    noun: 'soprano sax',
    // B♭ instrument: written D5 sounds C5, a tone down.
    transposeSemitones: -2,
    musicXmlNames: ['soprano sax', 'soprano saxophone', 'sopransax'],
  }),
  altoSax: saxophone({
    id: 'altoSax',
    name: 'Alto saxophone',
    shortName: 'Alto',
    noun: 'alto sax',
    // E♭ instrument: written C5 sounds E♭4, a major sixth down.
    transposeSemitones: -9,
    musicXmlNames: ['alto sax', 'alto saxophone', 'altsax'],
  }),
  tenorSax: saxophone({
    id: 'tenorSax',
    name: 'Tenor saxophone',
    shortName: 'Tenor',
    noun: 'tenor sax',
    // B♭ instrument an octave down: written D5 sounds C4.
    transposeSemitones: -14,
    musicXmlNames: ['tenor sax', 'tenor saxophone', 'tenorsax'],
  }),
  baritoneSax: saxophone({
    id: 'baritoneSax',
    name: 'Baritone saxophone',
    shortName: 'Baritone',
    noun: 'baritone sax',
    // E♭ instrument an octave and a sixth down: written C5 sounds E♭3.
    transposeSemitones: -21,
    lowA: true,
    musicXmlNames: ['baritone sax', 'baritone saxophone', 'bari sax', 'baritonsax'],
  }),
  bassSax: saxophone({
    id: 'bassSax',
    name: 'Bass saxophone',
    shortName: 'Bass sax',
    noun: 'bass sax',
    // B♭ instrument two octaves and a tone down: written D5 sounds C3.
    transposeSemitones: -26,
    highFSharpByDefault: false,
    musicXmlNames: ['bass sax', 'bass saxophone', 'basssax'],
  }),
}

export function isInstrumentId(value: unknown): value is InstrumentId {
  return typeof value === 'string' && Object.hasOwn(CATALOG, value)
}
