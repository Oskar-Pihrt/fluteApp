import { doubleHole, openHole } from '@/instruments/chart'
import type { ChartLayout, KeyDrawing } from '@/instruments/types'
import type { RecorderKeyId } from './keys'

/**
 * A recorder seen from the front, mouthpiece at the top: the thumb hole
 * (underneath on the instrument) beside the first finger hole, seven finger
 * holes down the centre with a break between the hands, the lowest two as
 * double holes, and the bell at the foot.
 *
 * Geometry is in viewBox units.
 */

const CX = 100

const DRAWINGS: Record<RecorderKeyId, KeyDrawing> = {
  THUMB: { ...openHole(42, 130, 17), text: { x: 42, y: 130 } },
  L1: openHole(CX, 100, 20),
  L2: openHole(CX, 158, 20),
  L3: openHole(CX, 216, 20),
  R4: openHole(CX, 304, 20),
  R5: openHole(CX, 362, 20),
  R6: doubleHole(CX, 420, 17, 8),
  R7: doubleHole(CX, 476, 15, 7),
  BELL: {
    parts: [{ s: 'ellipse', cx: CX, cy: 532, rx: 30, ry: 9, rotate: 0 }],
    hit: { x: CX - 35, y: 518, width: 70, height: 28 },
    text: { x: CX, y: 532, size: 10 },
  },
}

export const RECORDER_CHART: ChartLayout = {
  width: 190,
  height: 556,
  pixelWidth: { sm: 70, md: 100, lg: 162 },
  drawings: DRAWINGS,
  decorations: [{ s: 'arm', x1: 81, y1: 260, x2: 119, y2: 260 }],
  matchAnchor: { x: 165, y: 160 },
}
