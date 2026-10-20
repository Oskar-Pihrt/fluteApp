import { parseFingeringCode } from '@/domain/fingering'
import type { InstrumentData } from '@/instruments/types'
import { SAX_GRAMMAR, SAX_SPECS } from './fingerings'
import { SAX_EXCLUSIVE_GROUPS, SAX_KEYS, type SaxKeyId } from './keys'
import { SAX_CHART } from './layout'

/**
 * Canonical key order for fingering ids. It is not `SAX_KEY_IDS`: the
 * saxophone was added when one key order covered every instrument, flute keys
 * first, and saved sheets store ids built in that order. So the keys the sax
 * shares with the flute come first, in the flute's order, then the rest.
 */
const SAX_KEY_ORDER: readonly SaxKeyId[] = [
  'L1',
  'L2',
  'L3',
  'L_GSHARP',
  'R1',
  'R2',
  'R3',
  'R_EFLAT',
  'OCTAVE',
  'PALM_D',
  'PALM_DSHARP',
  'PALM_F',
  'FRONT_F',
  'BIS',
  'LOW_CSHARP',
  'LOW_B',
  'LOW_BB',
  'SIDE_BB',
  'SIDE_C',
  'SIDE_E',
  'HIGH_FSHARP',
  'ALT_FSHARP',
  'LOW_C',
]

/** Keywork, chart and fingerings shared by every saxophone — loaded on demand. */
export const SAX_DATA: InstrumentData = {
  keys: SAX_KEYS,
  keyOrder: SAX_KEY_ORDER,
  exclusiveGroups: SAX_EXCLUSIVE_GROUPS,
  parse: (code) => parseFingeringCode(code, SAX_GRAMMAR, SAX_KEY_ORDER),
  specs: SAX_SPECS,
  chart: SAX_CHART,
  partialLabel: 'half covered',
  source: {
    intro: 'Fingerings follow the standard charts; compare with',
    linkText: 'The Woodwind Fingering Guide',
    url: 'https://www.wfg.woodwind.org/sax/',
    outro: 'basic charts for saxophone.',
  },
}

/** Where this chunk was loaded from, so a stale cached copy can be told apart. */
export const MODULE_URL = import.meta.url
