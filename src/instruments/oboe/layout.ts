import { hole, lever, oval } from '@/instruments/chart'
import type { ChartLayout, KeyDrawing } from '@/instruments/types'
import type { OboeKeyId } from './keys'

/**
 * The oboe's keywork as an upright fingering chart: six rings down the
 * centre, the thumb octave keys on the left and the side octave key above the
 * first ring, the small trill keys between the rings, the left little-finger
 * table beside the break, the side keys to the right of the right hand, and
 * the right little-finger keys at the bottom.
 *
 * Geometry is in viewBox units.
 */

const CX = 120
const R = 20

const DRAWINGS: Record<OboeKeyId, KeyDrawing> = {
  OCT1: lever(40, 116, 30, 22),
  OCT3: lever(40, 144, 30, 20, 8, 9),
  OCT2: oval(80, 84, 8, 16, -30, 9),

  L1: hole(CX, 110, R),
  TR_B: oval(152, 140, 6, 12, 20, 8),
  TR_D_L: oval(90, 141, 6, 12, -20, 8),
  L2: hole(CX, 172, R),
  TR_CSHARP: oval(152, 203, 6, 12, 20, 7),
  L3: hole(CX, 234, R),

  // Left little finger, beside the break between the hands.
  L_GSHARP: lever(24, 250, 54, 20),
  L_EB: lever(24, 274, 25, 24),
  L_B: lever(53, 274, 25, 24),
  L_BB: lever(24, 302, 25, 22, 8, 10),
  L_F: lever(53, 302, 25, 22),

  SIDE_A: lever(168, 300, 26, 20),
  SIDE_GSHARP: lever(168, 324, 26, 20, 8, 10),

  R1: hole(CX, 330, R),
  TR_D_R: oval(152, 361, 6, 12, 20, 8),
  R2: hole(CX, 392, R),
  R_F: oval(152, 423, 6, 12, 20, 8),
  R3: hole(CX, 454, R),
  BANANA: oval(88, 423, 6, 12, -20, 8),

  // Right little finger, at the bottom.
  R_C: lever(80, 490, 30, 22),
  R_CSHARP: lever(114, 490, 30, 22, 8, 10),
  R_EB: lever(97, 516, 30, 22, 8, 10),
}

export const OBOE_CHART: ChartLayout = {
  width: 220,
  height: 552,
  pixelWidth: { sm: 80, md: 115, lg: 188 },
  drawings: DRAWINGS,
  decorations: [{ s: 'arm', x1: 101, y1: 282, x2: 139, y2: 282 }],
  matchAnchor: { x: 190, y: 170 },
}
