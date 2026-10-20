import { hole, lever, oval } from '@/instruments/chart'
import type { ChartLayout, KeyDrawing } from '@/instruments/types'
import type { ClarinetBoehmKeyId } from './keys'

/**
 * The Boehm clarinet's keywork as an upright fingering chart, headjoint at
 * the top: six rings down the centre with a break between the hands, the
 * thumb hole and register key back on the left, throat A and side G♯ above
 * the first ring, the sliver keys beside the third ring of each hand, the
 * four side keys to the right of the right hand, and the two little-finger
 * tables — left beside the break, right at the bottom. The low keys of the
 * bigger clarinets sit at the bottom left (right thumb) and right.
 *
 * Geometry is in viewBox units.
 */

const CX = 125
const R = 21

const DRAWINGS: Record<ClarinetBoehmKeyId, KeyDrawing> = {
  REGISTER: lever(46, 112, 28, 22),
  THUMB: { ...hole(60, 172, 16), text: { x: 60, y: 172 } },

  L_A: oval(CX, 72, 20, 9, 0),
  L_GSHARP: oval(84, 92, 8, 15, -30, 9),

  L1: hole(CX, 120, R),
  L2: hole(CX, 180, R),
  L_EB: oval(160, 213, 6, 14, 20, 8),
  L3: hole(CX, 246, R),

  // Left little finger, beside the break between the hands.
  L_CSHARP: lever(28, 262, 54, 20),
  L_E: lever(28, 288, 25, 24),
  L_FSHARP: lever(57, 288, 25, 24, 8, 10),
  L_F: lever(28, 318, 25, 22),
  L_AB: lever(57, 318, 25, 22, 8, 10),

  // Side keys, pressed with the side of the right index.
  SIDE_1: lever(176, 300, 22, 18, 6, 10),
  SIDE_2: lever(176, 322, 22, 18, 6, 10),
  SIDE_3: lever(176, 344, 22, 18, 6, 10),
  SIDE_4: lever(176, 366, 22, 18, 6, 10),

  R1: hole(CX, 336, R),
  R2: hole(CX, 396, R),
  R_B: oval(160, 429, 6, 14, 20, 8),
  R3: hole(CX, 462, R),

  // Right little finger, at the bottom.
  R_E: lever(82, 500, 28, 24),
  R_FSHARP: lever(114, 500, 28, 24, 8, 10),
  R_F: lever(82, 528, 28, 22),
  R_AB: lever(114, 528, 28, 22, 8, 10),
  LOW_EB: lever(152, 514, 38, 22, 8, 10),

  // Bass clarinet and basset horn: down to low C under the right thumb.
  LOW_D: lever(28, 470, 28, 22),
  LOW_CSHARP: lever(28, 496, 28, 22, 8, 10),
  LOW_C: lever(28, 522, 28, 22),
}

export const CLARINET_BOEHM_CHART: ChartLayout = {
  width: 230,
  height: 566,
  pixelWidth: { sm: 84, md: 120, lg: 196 },
  drawings: DRAWINGS,
  // The break between the left and right hands.
  decorations: [{ s: 'arm', x1: 106, y1: 291, x2: 144, y2: 291 }],
  // The empty space right of the left hand.
  matchAnchor: { x: 200, y: 170 },
}
