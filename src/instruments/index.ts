import { FLUTE } from './flute'
import { TENOR_SAX } from './tenorSax'
import type { Instrument, InstrumentId } from './types'

export const INSTRUMENTS: Record<InstrumentId, Instrument> = {
  flute: FLUTE,
  tenorSax: TENOR_SAX,
}

export function getInstrument(id: InstrumentId | undefined): Instrument {
  return INSTRUMENTS[id ?? 'flute'] ?? FLUTE
}

export { FLUTE, TENOR_SAX }
export * from './types'
