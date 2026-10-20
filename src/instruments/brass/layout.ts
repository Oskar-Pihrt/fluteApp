import { hole, lever } from '@/instruments/chart'
import type { ChartLayout, KeyDrawing } from '@/instruments/types'
import type { SlideKeyId, ValveKeyId } from './keys'

/**
 * Brass charts, upright like the woodwind charts. Valves are drawn as their
 * buttons in a column, first at the top, with the double horn's thumb valve
 * beside the first; the trombone as its slide running down, a stop for each
 * of the seven positions and the F trigger by the bell section.
 *
 * Geometry is in viewBox units.
 */

const VALVES: Record<ValveKeyId, KeyDrawing> = {
  // The thumb valve sits beside the first valve, where the left thumb is.
  THUMB_BB: lever(14, 56, 28, 34),
  V1: { ...hole(84, 72, 24), text: { x: 84, y: 72, size: 16 } },
  V2: { ...hole(84, 136, 24), text: { x: 84, y: 136, size: 16 } },
  V3: { ...hole(84, 200, 24), text: { x: 84, y: 200, size: 16 } },
  V4: { ...hole(84, 264, 24), text: { x: 84, y: 264, size: 16 } },
}

export const VALVE_CHART: ChartLayout = {
  width: 130,
  height: 300,
  pixelWidth: { sm: 52, md: 74, lg: 120 },
  drawings: VALVES,
  // In the margin right of the narrow column, where a long list of partials fits.
  matchAnchor: { x: 185, y: 150 },
}

const STOP = (n: number) => 44 + (n - 1) * 46

const SLIDE: Record<SlideKeyId, KeyDrawing> = {
  // The trigger is under the left thumb, up by the bell section.
  TRIGGER: lever(12, 30, 30, 40),
  ...(Object.fromEntries(
    ([1, 2, 3, 4, 5, 6, 7] as const).map((n) => [`P${n}`, { ...hole(80, STOP(n), 16), text: { x: 80, y: STOP(n), size: 13 } }]),
  ) as Record<Exclude<SlideKeyId, 'TRIGGER'>, KeyDrawing>),
}

export const SLIDE_CHART: ChartLayout = {
  width: 130,
  height: 360,
  pixelWidth: { sm: 52, md: 74, lg: 120 },
  drawings: SLIDE,
  // The slide's rail, from the bell section down past seventh position.
  decorations: [{ s: 'arm', x1: 80, y1: 20, x2: 80, y2: 340 }],
  matchAnchor: { x: 185, y: 180 },
}
