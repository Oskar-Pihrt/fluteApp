import { resolveFingering } from '@/domain/fingering'
import type { Instrument } from '@/instruments/types'
import { FLUTE_GRAMMAR, FLUTE_SPECS } from './fingerings'
import { FLUTE_EXCLUSIVE_GROUPS, FLUTE_KEYS } from './keys'
import { FLUTE_CHART } from './layout'

export const FLUTE: Instrument = {
  id: 'flute',
  name: 'Transverse flute',
  shortName: 'Flute',
  noun: 'flute',
  keys: FLUTE_KEYS,
  exclusiveGroups: FLUTE_EXCLUSIVE_GROUPS,
  grammar: FLUTE_GRAMMAR,
  // No id prefix: flute ids predate the instrument switch and are stored in
  // saved sheets as `chosenFingeringId`.
  fingerings: FLUTE_SPECS.map((spec, i) =>
    resolveFingering(spec, i, { id: 'flute', grammar: FLUTE_GRAMMAR, keys: FLUTE_KEYS, idPrefix: '' }),
  ),
  chart: FLUTE_CHART,
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
}
