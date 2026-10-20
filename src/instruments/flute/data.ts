import { parseFingeringCode } from '@/domain/fingering'
import type { InstrumentData } from '@/instruments/types'
import { FLUTE_GRAMMAR, FLUTE_SPECS } from './fingerings'
import { FLUTE_EXCLUSIVE_GROUPS, FLUTE_KEY_IDS, FLUTE_KEYS } from './keys'
import { FLUTE_CHART } from './layout'

/** The Boehm flute's keywork, chart and fingerings — loaded on demand. */
export const FLUTE_DATA: InstrumentData = {
  keys: FLUTE_KEYS,
  keyOrder: FLUTE_KEY_IDS,
  exclusiveGroups: FLUTE_EXCLUSIVE_GROUPS,
  parse: (code) => parseFingeringCode(code, FLUTE_GRAMMAR, FLUTE_KEY_IDS),
  specs: FLUTE_SPECS,
  chart: FLUTE_CHART,
  partialLabel: 'ring depressed, hole open',
  partialRequires: 'openHole',
  source: {
    intro: 'Fingerings are transcribed from',
    linkText: 'The Woodwind Fingering Guide',
    url: 'https://www.wfg.woodwind.org/flute/',
    outro: 'basic charts for flute, octaves 1–3.',
  },
}

/** Where this chunk was loaded from, so a stale cached copy can be told apart. */
export const MODULE_URL = import.meta.url
