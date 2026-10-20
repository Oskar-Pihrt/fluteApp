import { parseFingeringCode } from '@/domain/fingering'
import type { InstrumentData } from '@/instruments/types'
import { OCARINA_GRAMMAR, OCARINA_SPECS } from './fingerings'
import { OCARINA_KEY_IDS, OCARINA_KEYS } from './keys'
import { OCARINA_CHART } from './layout'

/** The 12-hole ocarina — loaded on demand. */
export const OCARINA_DATA: InstrumentData = {
  keys: OCARINA_KEYS,
  keyOrder: OCARINA_KEY_IDS,
  exclusiveGroups: [],
  parse: (code) => parseFingeringCode(code, OCARINA_GRAMMAR, OCARINA_KEY_IDS),
  specs: OCARINA_SPECS,
  chart: OCARINA_CHART,
  partialLabel: 'half covered',
  source: {
    intro: 'Fingerings follow',
    linkText: 'Playsoloist’s 12-hole Alto C ocarina chart',
    url: 'https://playsoloist.com/ocarina/finger-chart',
    outro: '— the common system; the top accidentals vary between makers.',
  },
}

/** Where this chunk was loaded from, so a stale cached copy can be told apart. */
export const MODULE_URL = import.meta.url
