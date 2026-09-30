import { resolveFingering } from '@/domain/fingering'
import type { Instrument } from '@/instruments/types'
import { TENOR_SAX_GRAMMAR, TENOR_SAX_SPECS } from './fingerings'
import { TENOR_SAX_EXCLUSIVE_GROUPS, TENOR_SAX_KEYS } from './keys'
import { TENOR_SAX_CHART } from './layout'

export const TENOR_SAX: Instrument = {
  id: 'tenorSax',
  name: 'Tenor saxophone',
  shortName: 'Tenor sax',
  noun: 'tenor sax',
  keys: TENOR_SAX_KEYS,
  exclusiveGroups: TENOR_SAX_EXCLUSIVE_GROUPS,
  grammar: TENOR_SAX_GRAMMAR,
  fingerings: TENOR_SAX_SPECS.map((spec, i) =>
    resolveFingering(spec, i, {
      id: 'tenorSax',
      grammar: TENOR_SAX_GRAMMAR,
      keys: TENOR_SAX_KEYS,
      idPrefix: 'tenorSax:',
    }),
  ),
  chart: TENOR_SAX_CHART,
  // B♭ instrument an octave down: written D5 sounds C4.
  transposeSemitones: -14,
  registerNames: {
    3: 'Low register',
    4: 'Low register',
    5: 'Middle register',
    6: 'Palm keys',
  },
  defaultPickerOctave: 4,
}
