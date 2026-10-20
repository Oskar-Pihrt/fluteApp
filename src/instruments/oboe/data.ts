import { parseFingeringCode } from '@/domain/fingering'
import type { InstrumentData } from '@/instruments/types'
import { OBOE_GRAMMAR, OBOE_SPECS } from './fingerings'
import { OBOE_EXCLUSIVE_GROUPS, OBOE_KEY_IDS, OBOE_KEYS } from './keys'
import { OBOE_CHART } from './layout'

/** Keywork, chart and fingerings of the oboe family — loaded on demand. */
export const OBOE_DATA: InstrumentData = {
  keys: OBOE_KEYS,
  keyOrder: OBOE_KEY_IDS,
  exclusiveGroups: OBOE_EXCLUSIVE_GROUPS,
  parse: (code) => parseFingeringCode(code, OBOE_GRAMMAR, OBOE_KEY_IDS),
  specs: OBOE_SPECS,
  chart: OBOE_CHART,
  partialLabel: 'half hole',
  source: {
    intro: 'Fingerings are converted from',
    linkText: 'The Woodwind Fingering Guide',
    url: 'https://www.wfg.woodwind.org/oboe/',
    outro: 'basic charts for oboe, with its third-octave alternate chart.',
  },
}

/** Where this chunk was loaded from, so a stale cached copy can be told apart. */
export const MODULE_URL = import.meta.url
