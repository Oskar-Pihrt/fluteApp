import { hole, lever, oval } from '@/instruments/chart'
import type { ChartLayout, KeyDrawing } from '@/instruments/types'
import type { ClarinetOehlerKeyId } from './keys'

/**
 * The Oehler clarinet's keywork as an upright fingering chart, laid out like
 * the Boehm chart: rings down the centre, thumb hole and register key on the
 * left, the sliver keys beside the rings (F/C and E♭/B♭ on the left hand,
 * B♭/F on the right), side keys to the right, and the little-finger keys —
 * five for the left beside the break, two for the right at the bottom.
 *
 * Geometry is in viewBox units.
 */

const CX = 125
const R = 21

const DRAWINGS: Record<ClarinetOehlerKeyId, KeyDrawing> = {
  REGISTER: lever(46, 112, 28, 22),
  THUMB: { ...hole(60, 172, 16), text: { x: 60, y: 172 } },

  L_A: oval(CX, 72, 20, 9, 0),
  L_GSHARP: oval(84, 92, 8, 15, -30, 9),

  L1: hole(CX, 120, R),
  L_F: oval(160, 152, 6, 13, 20, 8),
  L2: hole(CX, 180, R),
  L_EB: oval(160, 213, 6, 14, 20, 8),
  L3: hole(CX, 246, R),

  // Left little finger, beside the break between the hands.
  L_CSHARP: lever(28, 262, 54, 20),
  L_E: lever(28, 288, 25, 24),
  L_FSHARP: lever(57, 288, 25, 24, 8, 10),
  L_BB: lever(28, 318, 25, 22, 8, 10),
  L_AB: lever(57, 318, 25, 22, 8, 10),

  SIDE_1: lever(176, 300, 22, 18, 6, 10),
  SIDE_2: lever(176, 322, 22, 18, 6, 10),
  SIDE_3: lever(176, 344, 22, 18, 6, 10),
  SIDE_4: lever(176, 366, 22, 18, 6, 10),

  R1: hole(CX, 336, R),
  R2: hole(CX, 396, R),
  R_BB: oval(160, 429, 6, 14, 20, 8),
  R3: hole(CX, 462, R),

  // Right little finger, at the bottom.
  R_AB: lever(82, 500, 28, 24, 8, 10),
  R_F: lever(114, 500, 28, 24),
}

export const CLARINET_OEHLER_CHART: ChartLayout = {
  width: 230,
  height: 540,
  pixelWidth: { sm: 84, md: 120, lg: 196 },
  drawings: DRAWINGS,
  decorations: [{ s: 'arm', x1: 106, y1: 291, x2: 144, y2: 291 }],
  matchAnchor: { x: 200, y: 170 },
}
