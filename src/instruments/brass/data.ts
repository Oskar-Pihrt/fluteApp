import type { InstrumentData } from '@/instruments/types'
import {
  DOUBLE_HORN_SPECS,
  EUPHONIUM_SPECS,
  HORN_F_SPECS,
  parseSlide,
  parseValves,
  TROMBONE_SPECS,
  TRUMPET_SPECS,
} from './fingerings'
import { SLIDE_EXCLUSIVE_GROUPS, SLIDE_KEY_IDS, SLIDE_KEYS, VALVE_KEY_IDS, VALVE_KEYS } from './keys'
import { SLIDE_CHART, VALVE_CHART } from './layout'

const SOURCE = {
  intro: 'Fingerings are generated from the harmonic series, as standard charts are; compare with',
  linkText: 'the University of New South Wales brass acoustics pages',
  url: 'https://newt.phys.unsw.edu.au/jw/brassacoustics.html',
  outro: 'for how valves and the slide reach each note.',
}

const valved = {
  keys: VALVE_KEYS,
  keyOrder: VALVE_KEY_IDS,
  exclusiveGroups: [],
  parse: (code: string) => parseValves(code, VALVE_KEY_IDS),
  chart: VALVE_CHART,
  partialLabel: '',
  source: SOURCE,
} satisfies Omit<InstrumentData, 'specs'>

/** Three-valve brass: trumpets, cornet, flugelhorn, baritone. */
export const TRUMPET_DATA: InstrumentData = { ...valved, specs: TRUMPET_SPECS }
/** Euphonium, with a fourth valve. */
export const EUPHONIUM_DATA: InstrumentData = { ...valved, specs: EUPHONIUM_SPECS }
/** Single horn in F. */
export const HORN_F_DATA: InstrumentData = { ...valved, specs: HORN_F_SPECS }
/** Double horn in F/B♭: each side where the published chart uses it, the other as alternates. */
export const DOUBLE_HORN_DATA: InstrumentData = {
  ...valved,
  specs: DOUBLE_HORN_SPECS,
  source: {
    intro: 'Which side to use follows',
    linkText: 'Mouthpiece Express’s F-B♭ double horn chart',
    url: 'https://mouthpieceexpress.com/blogs/resources/free-french-horn-fingering-chart',
    outro: '— the fingerings themselves come from each side’s harmonic series.',
  },
}

/** Trombone, tenor or with F trigger. */
export const TROMBONE_DATA: InstrumentData = {
  keys: SLIDE_KEYS,
  keyOrder: SLIDE_KEY_IDS,
  exclusiveGroups: SLIDE_EXCLUSIVE_GROUPS,
  parse: (code: string) => parseSlide(code, SLIDE_KEY_IDS),
  specs: TROMBONE_SPECS,
  chart: SLIDE_CHART,
  partialLabel: '',
  source: SOURCE,
}

/** Where this chunk was loaded from, so a stale cached copy can be told apart. */
export const MODULE_URL = import.meta.url
