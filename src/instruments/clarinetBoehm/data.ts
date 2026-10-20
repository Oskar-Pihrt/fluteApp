import { parseFingeringCode } from '@/domain/fingering'
import type { InstrumentData } from '@/instruments/types'
import { CLARINET_BOEHM_GRAMMAR, CLARINET_BOEHM_SPECS } from './fingerings'
import { CLARINET_BOEHM_EXCLUSIVE_GROUPS, CLARINET_BOEHM_KEY_IDS, CLARINET_BOEHM_KEYS } from './keys'
import { CLARINET_BOEHM_CHART } from './layout'

/** Keywork, chart and fingerings shared by every Boehm-system clarinet — loaded on demand. */
export const CLARINET_BOEHM_DATA: InstrumentData = {
  keys: CLARINET_BOEHM_KEYS,
  keyOrder: CLARINET_BOEHM_KEY_IDS,
  exclusiveGroups: CLARINET_BOEHM_EXCLUSIVE_GROUPS,
  parse: (code) => parseFingeringCode(code, CLARINET_BOEHM_GRAMMAR, CLARINET_BOEHM_KEY_IDS),
  specs: CLARINET_BOEHM_SPECS,
  chart: CLARINET_BOEHM_CHART,
  partialLabel: 'half hole',
  source: {
    intro: 'Fingerings are converted from',
    linkText: 'The Woodwind Fingering Guide',
    url: 'https://www.wfg.woodwind.org/clarinet/',
    outro: 'basic charts for Boehm-system clarinet, with its upper altissimo alternate chart.',
  },
}

/** Where this chunk was loaded from, so a stale cached copy can be told apart. */
export const MODULE_URL = import.meta.url
