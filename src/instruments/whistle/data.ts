import { parseFingeringCode } from '@/domain/fingering'
import type { InstrumentData } from '@/instruments/types'
import { WHISTLE_GRAMMAR, WHISTLE_SPECS } from './fingerings'
import { WHISTLE_KEY_IDS, WHISTLE_KEYS } from './keys'
import { WHISTLE_CHART } from './layout'

/** Holes, chart and fingerings shared by every tin whistle — loaded on demand. */
export const WHISTLE_DATA: InstrumentData = {
  keys: WHISTLE_KEYS,
  keyOrder: WHISTLE_KEY_IDS,
  exclusiveGroups: [],
  parse: (code) => parseFingeringCode(code, WHISTLE_GRAMMAR, WHISTLE_KEY_IDS),
  specs: WHISTLE_SPECS,
  chart: WHISTLE_CHART,
  partialLabel: 'half covered',
  source: {
    intro: 'Fingerings are converted from',
    linkText: 'The Woodwind Fingering Guide',
    url: 'https://www.wfg.woodwind.org/tinwhistle/',
    outro: 'basic chart for tin whistle.',
  },
}

/** Where this chunk was loaded from, so a stale cached copy can be told apart. */
export const MODULE_URL = import.meta.url
