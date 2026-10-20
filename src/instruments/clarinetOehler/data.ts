import { parseFingeringCode } from '@/domain/fingering'
import type { InstrumentData } from '@/instruments/types'
import { CLARINET_OEHLER_GRAMMAR, CLARINET_OEHLER_SPECS } from './fingerings'
import { CLARINET_OEHLER_EXCLUSIVE_GROUPS, CLARINET_OEHLER_KEY_IDS, CLARINET_OEHLER_KEYS } from './keys'
import { CLARINET_OEHLER_CHART } from './layout'

/** Keywork, chart and fingerings shared by every Oehler-system clarinet — loaded on demand. */
export const CLARINET_OEHLER_DATA: InstrumentData = {
  keys: CLARINET_OEHLER_KEYS,
  keyOrder: CLARINET_OEHLER_KEY_IDS,
  exclusiveGroups: CLARINET_OEHLER_EXCLUSIVE_GROUPS,
  parse: (code) => parseFingeringCode(code, CLARINET_OEHLER_GRAMMAR, CLARINET_OEHLER_KEY_IDS),
  specs: CLARINET_OEHLER_SPECS,
  chart: CLARINET_OEHLER_CHART,
  partialLabel: 'half hole',
  source: {
    intro: 'Fingerings are converted from',
    linkText: 'The Woodwind Fingering Guide',
    url: 'https://www.wfg.woodwind.org/clarinet/',
    outro: 'basic charts for Oehler-system clarinet, with its upper altissimo alternate chart.',
  },
}

/** Where this chunk was loaded from, so a stale cached copy can be told apart. */
export const MODULE_URL = import.meta.url
