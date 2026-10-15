import { FLUTE } from './flute'
import { ALTO_SAX, TENOR_SAX } from './saxophone'
import type { Instrument, InstrumentId } from './types'

export const INSTRUMENTS: Record<InstrumentId, Instrument> = {
  flute: FLUTE,
  altoSax: ALTO_SAX,
  tenorSax: TENOR_SAX,
}

export function getInstrument(id: InstrumentId | undefined): Instrument {
  return INSTRUMENTS[id ?? 'flute'] ?? FLUTE
}

export { ALTO_SAX, FLUTE, TENOR_SAX }
export * from './types'
