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
  { id: 'clarinets', label: 'Clarinets' },
  { id: 'doubleReeds', label: 'Oboes' },
  { id: 'recorders', label: 'Recorders' },
  { id: 'whistles', label: 'Tin whistles' },
  { id: 'brass', label: 'Brass' },
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

type ClarinetSpec = Pick<InstrumentMeta, 'id' | 'name' | 'shortName' | 'noun' | 'transposeSemitones' | 'musicXmlNames'> & {
  system: 'boehm' | 'oehler'
  /** How far down it reaches: the soprano clarinets' E, the alto's E♭, or low C. */
  bottom?: 'E' | 'Eb' | 'C'
}

const LOW_KEYS = ['LOW_EB', 'LOW_D', 'LOW_CSHARP', 'LOW_C']

/**
 * Clarinets of one system finger alike in every size; they differ in how
 * they transpose and how far down they reach. The low clarinets stop at the
 * top of the clarion: their altissimo needs half-hole fingerings this data
 * doesn't have.
 */
function clarinet({ system, bottom = 'E', ...spec }: ClarinetSpec): InstrumentMeta {
  const low = bottom === 'E' ? 'E3' : bottom === 'Eb' ? 'D#3' : 'C3'
  const high = bottom === 'E' ? 'C7' : 'C6'
  const extraKeys: InstrumentOption[] = [
    {
      kind: 'toggle',
      heading: 'Keys',
      requirement: 'leftAb',
      label: 'Left A♭/E♭ key',
      description: 'A fifth key for the left little finger, on some professional models.',
      default: false,
    },
    ...(system === 'oehler'
      ? [
          {
            kind: 'toggle',
            heading: 'Keys',
            requirement: 'leftBb',
            label: 'Left B♭/F key',
            description: 'The extra left little finger key some Oehler clarinets have.',
            default: false,
          } as const,
        ]
      : []),
    ...(bottom === 'C'
      ? [
          {
            kind: 'toggle',
            heading: 'Low keys',
            requirement: 'lowC',
            label: 'Low C extension',
            description: 'Low D, C♯ and C keys, down to written C.',
            default: true,
          } as const,
        ]
      : []),
  ]
  return {
    ...spec,
    family: 'clarinet',
    group: 'clarinets',
    dataModule: system === 'boehm' ? 'clarinetBoehm' : 'clarinetOehler',
    idPrefix: `${spec.id}:`,
    registerNames: { 3: 'Chalumeau', 4: 'Chalumeau and throat', 5: 'Clarion', 6: 'Altissimo', 7: 'Altissimo' },
    defaultPickerOctave: 4,
    options: extraKeys,
    omitKeys: system === 'oehler' ? [] : bottom === 'E' ? LOW_KEYS : bottom === 'Eb' ? LOW_KEYS.slice(1) : [],
    writtenRange: [low, high],
    expectedRange: [low, high],
  }
}

type OboeSpec = Pick<InstrumentMeta, 'id' | 'name' | 'shortName' | 'noun' | 'transposeSemitones' | 'musicXmlNames'> & {
  writtenRange: readonly [string, string]
  /** The oboe d'amore has no low B♭ key. */
  lowBb: boolean
}

/** The oboe and its larger relatives finger alike; they differ in pitch and range. */
function oboe({ writtenRange, lowBb, ...spec }: OboeSpec): InstrumentMeta {
  return {
    ...spec,
    family: 'oboe',
    group: 'doubleReeds',
    dataModule: 'oboe',
    idPrefix: `${spec.id}:`,
    registerNames: { 3: 'Low register', 4: 'Low register', 5: 'Second octave', 6: 'Third octave' },
    defaultPickerOctave: 4,
    options: [
      ...(lowBb
        ? [
            {
              kind: 'toggle',
              heading: 'Keys',
              requirement: 'lowBb',
              label: 'Low B♭ key',
              description: 'The bottom note, B♭3. Some student models lack it.',
              default: true,
            } as const,
          ]
        : []),
      {
        kind: 'toggle',
        heading: 'Keys',
        requirement: 'leftF',
        label: 'Left F key',
        description: 'The left little-finger F, on most full conservatoire oboes.',
        default: true,
      },
      {
        kind: 'toggle',
        heading: 'Keys',
        requirement: 'thirdOctaveKey',
        label: 'Third octave key',
        description: 'A second thumb octave key for some third-octave fingerings.',
        default: false,
      },
    ],
    omitKeys: lowBb ? [] : ['L_BB'],
    writtenRange,
    expectedRange: writtenRange,
  }
}

type RecorderSpec = Pick<InstrumentMeta, 'id' | 'transposeSemitones'> & {
  size: 'Sopranino' | 'Soprano' | 'Alto' | 'Tenor'
  system: 'baroque' | 'german'
}

/**
 * Recorders share one chart in C. The C sizes (soprano, tenor) play it as
 * written; the F sizes (sopranino, alto) play every note a fourth higher.
 * The soprano and sopranino sound an octave above written.
 */
function recorder({ size, system, ...spec }: RecorderSpec): InstrumentMeta {
  const inF = size === 'Sopranino' || size === 'Alto'
  const range: [string, string] = inF ? ['F4', 'G6'] : ['C4', 'D6']
  const fingering = system === 'baroque' ? 'baroque' : 'German'
  return {
    ...spec,
    name: `${size} recorder (${fingering})`,
    shortName: `${size} recorder`,
    noun: `${size.toLowerCase()} recorder`,
    family: 'recorder',
    group: 'recorders',
    dataModule: system === 'baroque' ? 'recorderBaroque' : 'recorderGerman',
    idPrefix: `${spec.id}:`,
    registerNames: { 4: 'First octave', 5: 'Second octave', 6: 'Third octave' },
    defaultPickerOctave: 4,
    musicXmlNames: [`${size.toLowerCase()} recorder`, 'recorder', 'blockflöte', 'flauto dolce'],
    options: [],
    fingeringShift: inF ? 5 : 0,
    expectedRange: range,
  }
}

type WhistleSpec = Pick<InstrumentMeta, 'id' | 'name' | 'transposeSemitones'>

/**
 * Every tin whistle reads D-whistle notation and fingers it the same way;
 * the key of the whistle only sets how it sounds.
 */
function whistle(spec: WhistleSpec): InstrumentMeta {
  return {
    ...spec,
    shortName: spec.name,
    noun: spec.name.toLowerCase(),
    family: 'whistle',
    group: 'whistles',
    dataModule: 'whistle',
    idPrefix: `${spec.id}:`,
    registerNames: { 4: 'First octave', 5: 'Second octave', 6: 'Second octave' },
    defaultPickerOctave: 4,
    musicXmlNames: ['tin whistle', 'whistle', 'penny whistle', 'feadóg'],
    options: [],
    expectedRange: ['D4', 'D6'],
  }
}

type BrassSpec = Pick<InstrumentMeta, 'id' | 'name' | 'shortName' | 'noun' | 'transposeSemitones' | 'musicXmlNames'> & {
  dataModule: 'trumpet' | 'euphonium' | 'hornF' | 'hornDouble' | 'trombone'
  writtenRange: readonly [string, string]
  omitKeys: readonly string[]
  options?: readonly InstrumentOption[]
}

/** Brass instruments, all in treble clef; the data module sets valves or slide. */
function brass({ writtenRange, options = [], ...spec }: BrassSpec): InstrumentMeta {
  return {
    ...spec,
    family: 'brass',
    group: 'brass',
    idPrefix: `${spec.id}:`,
    registerNames: { 3: 'Low register', 4: 'Middle register', 5: 'Upper register', 6: 'High register' },
    defaultPickerOctave: 4,
    options,
    writtenRange,
    expectedRange: writtenRange,
  }
}

/** Three-valve trumpet-family chart; the key only changes how it sounds. */
const trumpetLike = (
  spec: Pick<BrassSpec, 'id' | 'name' | 'shortName' | 'noun' | 'transposeSemitones' | 'musicXmlNames'>,
  writtenRange: readonly [string, string] = ['F#3', 'C6'],
) => brass({ ...spec, dataModule: 'trumpet', writtenRange, omitKeys: ['THUMB_BB', 'V4'] })

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
  clarinetEb: clarinet({
    id: 'clarinetEb',
    name: 'E♭ clarinet (Boehm)',
    shortName: 'E♭ clarinet',
    noun: 'E♭ clarinet',
    system: 'boehm',
    // Sounds a minor third above written.
    transposeSemitones: 3,
    musicXmlNames: ['e-flat clarinet', 'eb clarinet', 'clarinet in e', 'es-klarinette'],
  }),
  clarinetBb: clarinet({
    id: 'clarinetBb',
    name: 'B♭ clarinet (Boehm)',
    shortName: 'Clarinet',
    noun: 'clarinet',
    system: 'boehm',
    // Sounds a tone below written.
    transposeSemitones: -2,
    musicXmlNames: ['clarinet', 'klarinette', 'clarinetto', 'clarinette'],
  }),
  clarinetA: clarinet({
    id: 'clarinetA',
    name: 'A clarinet (Boehm)',
    shortName: 'A clarinet',
    noun: 'A clarinet',
    system: 'boehm',
    // Sounds a minor third below written.
    transposeSemitones: -3,
    musicXmlNames: ['clarinet in a', 'a clarinet', 'klarinette in a'],
  }),
  bassetHorn: clarinet({
    id: 'bassetHorn',
    name: 'Basset horn',
    shortName: 'Basset horn',
    noun: 'basset horn',
    system: 'boehm',
    bottom: 'C',
    // In F: sounds a fifth below written.
    transposeSemitones: -7,
    musicXmlNames: ['basset horn', 'bassetthorn', 'corno di bassetto'],
  }),
  altoClarinet: clarinet({
    id: 'altoClarinet',
    name: 'Alto clarinet',
    shortName: 'Alto clarinet',
    noun: 'alto clarinet',
    system: 'boehm',
    bottom: 'Eb',
    // In E♭, a major sixth below written.
    transposeSemitones: -9,
    musicXmlNames: ['alto clarinet', 'altklarinette'],
  }),
  bassClarinet: clarinet({
    id: 'bassClarinet',
    name: 'Bass clarinet',
    shortName: 'Bass clarinet',
    noun: 'bass clarinet',
    system: 'boehm',
    bottom: 'C',
    // In B♭, written in treble clef a major ninth above sounding.
    transposeSemitones: -14,
    musicXmlNames: ['bass clarinet', 'bassklarinette', 'clarinetto basso'],
  }),
  clarinetEbOehler: clarinet({
    id: 'clarinetEbOehler',
    name: 'E♭ clarinet (Oehler)',
    shortName: 'E♭ clarinet',
    noun: 'E♭ clarinet',
    system: 'oehler',
    transposeSemitones: 3,
    musicXmlNames: ['e-flat clarinet', 'eb clarinet', 'es-klarinette'],
  }),
  clarinetBbOehler: clarinet({
    id: 'clarinetBbOehler',
    name: 'B♭ clarinet (Oehler)',
    shortName: 'Clarinet',
    noun: 'clarinet',
    system: 'oehler',
    transposeSemitones: -2,
    musicXmlNames: ['clarinet', 'klarinette', 'clarinetto'],
  }),
  clarinetAOehler: clarinet({
    id: 'clarinetAOehler',
    name: 'A clarinet (Oehler)',
    shortName: 'A clarinet',
    noun: 'A clarinet',
    system: 'oehler',
    transposeSemitones: -3,
    musicXmlNames: ['clarinet in a', 'a clarinet', 'klarinette in a'],
  }),
  oboe: oboe({
    id: 'oboe',
    name: 'Oboe',
    shortName: 'Oboe',
    noun: 'oboe',
    transposeSemitones: 0,
    writtenRange: ['A#3', 'A6'],
    lowBb: true,
    musicXmlNames: ['oboe', 'hautbois', 'oboa'],
  }),
  oboeDamore: oboe({
    id: 'oboeDamore',
    name: 'Oboe d’amore',
    shortName: 'Oboe d’amore',
    noun: 'oboe d’amore',
    // In A: sounds a minor third below written.
    transposeSemitones: -3,
    writtenRange: ['B3', 'E6'],
    lowBb: false,
    musicXmlNames: ["oboe d'amore", 'oboe d’amore', 'oboe damore'],
  }),
  englishHorn: oboe({
    id: 'englishHorn',
    name: 'English horn',
    shortName: 'English horn',
    noun: 'English horn',
    // In F: sounds a fifth below written.
    transposeSemitones: -7,
    writtenRange: ['A#3', 'G6'],
    lowBb: true,
    musicXmlNames: ['english horn', 'cor anglais', 'corno inglese', 'englischhorn'],
  }),
  recorderSopraninoBaroque: recorder({ id: 'recorderSopraninoBaroque', size: 'Sopranino', system: 'baroque', transposeSemitones: 12 }),
  recorderSopranoBaroque: recorder({ id: 'recorderSopranoBaroque', size: 'Soprano', system: 'baroque', transposeSemitones: 12 }),
  recorderAltoBaroque: recorder({ id: 'recorderAltoBaroque', size: 'Alto', system: 'baroque', transposeSemitones: 0 }),
  recorderTenorBaroque: recorder({ id: 'recorderTenorBaroque', size: 'Tenor', system: 'baroque', transposeSemitones: 0 }),
  recorderSopraninoGerman: recorder({ id: 'recorderSopraninoGerman', size: 'Sopranino', system: 'german', transposeSemitones: 12 }),
  recorderSopranoGerman: recorder({ id: 'recorderSopranoGerman', size: 'Soprano', system: 'german', transposeSemitones: 12 }),
  recorderAltoGerman: recorder({ id: 'recorderAltoGerman', size: 'Alto', system: 'german', transposeSemitones: 0 }),
  recorderTenorGerman: recorder({ id: 'recorderTenorGerman', size: 'Tenor', system: 'german', transposeSemitones: 0 }),
  // Transposition: the whistle's lowest note minus written D4.
  whistleD: whistle({ id: 'whistleD', name: 'D whistle', transposeSemitones: 12 }),
  whistleC: whistle({ id: 'whistleC', name: 'C whistle', transposeSemitones: 10 }),
  whistleBb: whistle({ id: 'whistleBb', name: 'B♭ whistle', transposeSemitones: 8 }),
  whistleEb: whistle({ id: 'whistleEb', name: 'E♭ whistle', transposeSemitones: 13 }),
  whistleF: whistle({ id: 'whistleF', name: 'F whistle', transposeSemitones: 15 }),
  whistleG: whistle({ id: 'whistleG', name: 'G whistle', transposeSemitones: 17 }),
  whistleLowA: whistle({ id: 'whistleLowA', name: 'Low A whistle', transposeSemitones: 7 }),
  whistleLowD: whistle({ id: 'whistleLowD', name: 'Low D whistle', transposeSemitones: 0 }),
  trumpetBb: trumpetLike({
    id: 'trumpetBb',
    name: 'B♭ trumpet',
    shortName: 'Trumpet',
    noun: 'trumpet',
    transposeSemitones: -2,
    musicXmlNames: ['trumpet', 'trompete', 'tromba', 'trompette'],
  }),
  trumpetC: trumpetLike({
    id: 'trumpetC',
    name: 'C trumpet',
    shortName: 'C trumpet',
    noun: 'C trumpet',
    transposeSemitones: 0,
    musicXmlNames: ['trumpet in c', 'c trumpet'],
  }),
  trumpetD: trumpetLike({
    id: 'trumpetD',
    name: 'D trumpet',
    shortName: 'D trumpet',
    noun: 'D trumpet',
    transposeSemitones: 2,
    musicXmlNames: ['trumpet in d', 'd trumpet'],
  }),
  trumpetEb: trumpetLike({
    id: 'trumpetEb',
    name: 'E♭ trumpet',
    shortName: 'E♭ trumpet',
    noun: 'E♭ trumpet',
    transposeSemitones: 3,
    musicXmlNames: ['trumpet in e', 'eb trumpet', 'e-flat trumpet'],
  }),
  // Sounds an octave above the B♭ trumpet. Its fourth valve isn't charted;
  // the written range is where it is usually written.
  piccoloTrumpet: trumpetLike(
    {
      id: 'piccoloTrumpet',
      name: 'Piccolo trumpet in B♭',
      shortName: 'Piccolo trumpet',
      noun: 'piccolo trumpet',
      transposeSemitones: 10,
      musicXmlNames: ['piccolo trumpet'],
    },
    ['C4', 'C6'],
  ),
  cornet: trumpetLike({
    id: 'cornet',
    name: 'B♭ cornet',
    shortName: 'Cornet',
    noun: 'cornet',
    transposeSemitones: -2,
    musicXmlNames: ['cornet', 'kornett'],
  }),
  flugelhorn: trumpetLike({
    id: 'flugelhorn',
    name: 'Flugelhorn',
    shortName: 'Flugelhorn',
    noun: 'flugelhorn',
    transposeSemitones: -2,
    musicXmlNames: ['flugelhorn', 'flügelhorn', 'křídlovka'],
  }),
  hornF: brass({
    id: 'hornF',
    name: 'Horn in F',
    shortName: 'Horn',
    noun: 'horn',
    dataModule: 'hornF',
    // Sounds a fifth below written.
    transposeSemitones: -7,
    writtenRange: ['C#3', 'C6'],
    omitKeys: ['THUMB_BB', 'V4'],
    musicXmlNames: ['horn', 'french horn', 'corno', 'cor', 'waldhorn'],
  }),
  hornDouble: brass({
    id: 'hornDouble',
    name: 'Double horn (F/B♭)',
    shortName: 'Double horn',
    noun: 'double horn',
    dataModule: 'hornDouble',
    transposeSemitones: -7,
    writtenRange: ['C#3', 'C6'],
    omitKeys: ['V4'],
    musicXmlNames: ['horn', 'french horn', 'corno', 'cor', 'waldhorn'],
  }),
  baritoneHorn: trumpetLike({
    id: 'baritoneHorn',
    name: 'Baritone horn (treble clef)',
    shortName: 'Baritone',
    noun: 'baritone',
    // B♭, written in treble clef a ninth above sounding, as in brass bands.
    transposeSemitones: -14,
    musicXmlNames: ['baritone', 'bariton', 'tenorhorn'],
  }),
  euphonium: brass({
    id: 'euphonium',
    name: 'Euphonium (treble clef)',
    shortName: 'Euphonium',
    noun: 'euphonium',
    dataModule: 'euphonium',
    transposeSemitones: -14,
    writtenRange: ['C#3', 'C6'],
    omitKeys: ['THUMB_BB'],
    options: [
      {
        kind: 'toggle',
        heading: 'Valves',
        requirement: 'fourthValve',
        label: 'Fourth valve',
        description: 'Fills in the low register below written F♯3, and offers alternates for 1 3 and 1 2 3.',
        default: true,
      },
    ],
    musicXmlNames: ['euphonium'],
  }),
  trombone: brass({
    id: 'trombone',
    name: 'Trombone (treble clef)',
    shortName: 'Trombone',
    noun: 'trombone',
    dataModule: 'trombone',
    transposeSemitones: -14,
    writtenRange: ['F#3', 'C6'],
    omitKeys: ['TRIGGER'],
    musicXmlNames: ['trombone', 'posaune', 'pozoun'],
  }),
  tenorbassTrombone: brass({
    id: 'tenorbassTrombone',
    name: 'Tenor-bass trombone (treble clef)',
    shortName: 'Tenor-bass trombone',
    noun: 'trombone',
    dataModule: 'trombone',
    transposeSemitones: -14,
    // The F trigger reaches down to D; the B below it (written C♯3) is the
    // famous missing note.
    writtenRange: ['D3', 'C6'],
    omitKeys: [],
    options: [
      {
        kind: 'toggle',
        heading: 'Trigger',
        requirement: 'fTrigger',
        label: 'F trigger',
        description: 'The F attachment, for the low register and shorter positions.',
        default: true,
      },
    ],
    musicXmlNames: ['trombone', 'posaune', 'pozoun'],
  }),
}

export function isInstrumentId(value: unknown): value is InstrumentId {
  return typeof value === 'string' && Object.hasOwn(CATALOG, value)
}
