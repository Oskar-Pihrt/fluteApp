import { hole, lever } from '@/instruments/chart'
import type { ChartLayout, KeyDrawing } from '@/instruments/types'
import type { SlideKeyId, ValveKeyId } from './keys'

/**
 * Brass charts. Valves are drawn as their buttons seen from above, in a row,
 * with the double horn's thumb valve to the left; the trombone as its slide,
 * with a stop for each of the seven positions and the F trigger below.
 *
 * Geometry is in viewBox units.
 */

const VALVES: Record<ValveKeyId, KeyDrawing> = {
  THUMB_BB: lever(14, 56, 34, 28),
  V1: { ...hole(84, 70, 22), text: { x: 84, y: 70, size: 16 } },
  V2: { ...hole(138, 70, 22), text: { x: 138, y: 70, size: 16 } },
  V3: { ...hole(192, 70, 22), text: { x: 192, y: 70, size: 16 } },
  V4: { ...hole(246, 70, 22), text: { x: 246, y: 70, size: 16 } },
}

export const VALVE_CHART: ChartLayout = {
  width: 284,
  height: 140,
  pixelWidth: { sm: 120, md: 170, lg: 270 },
  drawings: VALVES,
  matchAnchor: { x: 142, y: 128 },
}

const STOP = (n: number) => 36 + (n - 1) * 44

const SLIDE: Record<SlideKeyId, KeyDrawing> = {
  TRIGGER: lever(14, 96, 40, 26),
  ...(Object.fromEntries(
    ([1, 2, 3, 4, 5, 6, 7] as const).map((n) => [`P${n}`, { ...hole(STOP(n), 52, 15), text: { x: STOP(n), y: 52, size: 13 } }]),
  ) as Record<Exclude<SlideKeyId, 'TRIGGER'>, KeyDrawing>),
}

export const SLIDE_CHART: ChartLayout = {
  width: 340,
  height: 140,
  pixelWidth: { sm: 140, md: 200, lg: 320 },
  drawings: SLIDE,
  // The slide's rail, from the bell section out past seventh position.
  decorations: [{ s: 'arm', x1: 16, y1: 52, x2: 324, y2: 52 }],
  matchAnchor: { x: 200, y: 112 },
}
