import { parseFingeringCode } from '@/domain/fingering'
import type { InstrumentData } from '@/instruments/types'
import { BAROQUE_SPECS, GERMAN_SPECS, RECORDER_GRAMMAR } from './fingerings'
import { RECORDER_KEY_IDS, RECORDER_KEYS } from './keys'
import { RECORDER_CHART } from './layout'

const shared = {
  keys: RECORDER_KEYS,
  keyOrder: RECORDER_KEY_IDS,
  exclusiveGroups: [],
  parse: (code: string) => parseFingeringCode(code, RECORDER_GRAMMAR, RECORDER_KEY_IDS),
  chart: RECORDER_CHART,
  partialLabel: 'half covered',
  source: {
    intro: 'Fingerings are converted from',
    linkText: 'The Woodwind Fingering Guide',
    url: 'https://www.wfg.woodwind.org/recorder/',
    outro: 'basic chart for recorder.',
  },
} satisfies Omit<InstrumentData, 'specs'>

/** Recorders with baroque (English) fingering — loaded on demand. */
export const RECORDER_BAROQUE_DATA: InstrumentData = { ...shared, specs: BAROQUE_SPECS }

/** Recorders with German fingering — same chunk, its own fingerings. */
export const RECORDER_GERMAN_DATA: InstrumentData = { ...shared, specs: GERMAN_SPECS }

/** Where this chunk was loaded from, so a stale cached copy can be told apart. */
export const MODULE_URL = import.meta.url
