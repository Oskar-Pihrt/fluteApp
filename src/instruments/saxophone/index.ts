import { resolveFingering } from '@/domain/fingering'
import type { Instrument, InstrumentId } from '@/instruments/types'
import { SAX_GRAMMAR, SAX_SPECS } from './fingerings'
import { SAX_EXCLUSIVE_GROUPS, SAX_KEYS } from './keys'
import { SAX_CHART } from './layout'

interface SaxophoneSpec {
  id: InstrumentId
  name: string
  shortName: string
  noun: string
  transposeSemitones: number
}

/**
 * Every saxophone shares one keywork, one chart and one written-pitch fingering
 * table; what sets them apart is only how far below written they sound. So each
 * is built from the shared parts, with its own id prefix so fingering ids stay
 * unique across instruments.
 */
function makeSaxophone(spec: SaxophoneSpec): Instrument {
  return {
    ...spec,
    family: 'sax',
    keys: SAX_KEYS,
    exclusiveGroups: SAX_EXCLUSIVE_GROUPS,
    grammar: SAX_GRAMMAR,
    fingerings: SAX_SPECS.map((fingering, i) =>
      resolveFingering(fingering, i, {
        id: spec.id,
        grammar: SAX_GRAMMAR,
        keys: SAX_KEYS,
        idPrefix: `${spec.id}:`,
      }),
    ),
    chart: SAX_CHART,
    registerNames: {
      3: 'Low register',
      4: 'Low register',
      5: 'Middle register',
      6: 'Palm keys',
    },
    defaultPickerOctave: 4,
  }
}

export const ALTO_SAX = makeSaxophone({
  id: 'altoSax',
  name: 'Alto saxophone',
  shortName: 'Alto',
  noun: 'alto sax',
  // E♭ instrument: written C5 sounds E♭4, a major sixth down.
  transposeSemitones: -9,
})

export const TENOR_SAX = makeSaxophone({
  id: 'tenorSax',
  name: 'Tenor saxophone',
  shortName: 'Tenor',
  noun: 'tenor sax',
  // B♭ instrument an octave down: written D5 sounds C4.
  transposeSemitones: -14,
})
