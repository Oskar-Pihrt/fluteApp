import { openHole } from '@/instruments/chart'
import type { ChartLayout, KeyDrawing } from '@/instruments/types'
import type { OcarinaKeyId } from './keys'

/**
 * The ocarina from above: the left hand's four holes down the left, the
 * right hand's down the right, index finger at the top, each sub-hole beside
 * its middle-finger hole, and the two thumb holes (underneath) at the foot.
 */

const DRAWINGS: Record<OcarinaKeyId, KeyDrawing> = {
  L1: openHole(60, 60, 18),
  L2: openHole(60, 114, 18),
  L3: openHole(60, 168, 18),
  L4: openHole(60, 216, 14),
  R1: openHole(170, 60, 18),
  R2: openHole(170, 114, 18),
  R3: openHole(170, 168, 18),
  R4: openHole(170, 216, 14),
  SUB_A: { ...openHole(94, 114, 8), text: { x: 94, y: 114, size: 8 } },
  SUB_B: { ...openHole(136, 114, 8), text: { x: 136, y: 114, size: 8 } },
  LT: { ...openHole(60, 276, 15), text: { x: 60, y: 276 } },
  RT: { ...openHole(170, 276, 15), text: { x: 170, y: 276 } },
}

export const OCARINA_CHART: ChartLayout = {
  width: 230,
  height: 306,
  pixelWidth: { sm: 92, md: 130, lg: 210 },
  drawings: DRAWINGS,
  // Between the thumbs (underneath) and the finger holes (on top).
  decorations: [{ s: 'arm', x1: 40, y1: 246, x2: 190, y2: 246 }],
  matchAnchor: { x: 115, y: 180 },
}
