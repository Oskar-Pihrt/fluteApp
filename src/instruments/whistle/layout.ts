import { openHole } from '@/instruments/chart'
import type { ChartLayout, KeyDrawing } from '@/instruments/types'
import type { WhistleKeyId } from './keys'

/** Six holes down the centre, with a break between the hands. */

const CX = 70

const DRAWINGS: Record<WhistleKeyId, KeyDrawing> = {
  H1: openHole(CX, 60, 20),
  H2: openHole(CX, 118, 20),
  H3: openHole(CX, 176, 20),
  H4: openHole(CX, 264, 20),
  H5: openHole(CX, 322, 20),
  H6: openHole(CX, 380, 20),
}

export const WHISTLE_CHART: ChartLayout = {
  width: 140,
  height: 420,
  pixelWidth: { sm: 52, md: 74, lg: 120 },
  drawings: DRAWINGS,
  decorations: [{ s: 'arm', x1: 51, y1: 220, x2: 89, y2: 220 }],
  matchAnchor: { x: 125, y: 120 },
}
