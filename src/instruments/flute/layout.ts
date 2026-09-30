import type { FluteKeyId } from '@/domain/keys'
import type { ChartLayout, KeyDrawing } from '@/instruments/types'

/**
 * The flute's keywork drawn as a fingering chart — the keys alone, in their real
 * silhouettes, with no instrument body and no lettering. Filling a key in is
 * what "pressed" means.
 *
 * Laid out from the standard horizontal key chart, rotated upright so the
 * headjoint is at the top. Two consequences of that rotation are worth knowing,
 * because they are not what you would guess:
 *
 *  - The chart's second row becomes a LEFT column. It holds the two long thumb
 *    levers beside the left hand, the G♯ touchpiece, and the two small trill
 *    keys tucked between the right-hand keys.
 *  - The E♭ key and the footjoint keys run ACROSS the width, not down it. On the
 *    horizontal chart they are tall and narrow; rotated, they become wide and
 *    short, which is why the bottom of the diagram is a row of levers.
 *
 * Geometry is in viewBox units, transcribed proportionally from the chart.
 */

/**
 * The six finger keys sit on the centre line, in two groups of three, and their
 * sizes graduate exactly as they do on the chart — the first is noticeably
 * smaller than the third.
 */
function fingerKey(cy: number, r: number): KeyDrawing {
  return {
    parts: [{ s: 'circle', cx: 130, cy, r }],
    ring: { cx: 130, cy, r },
    hit: { x: 130 - r - 6, y: cy - r - 6, width: (r + 6) * 2, height: (r + 6) * 2 },
  }
}

const DRAWINGS: Record<FluteKeyId, KeyDrawing> = {
  // Two long thumb levers down the left, beside the left hand. B♭ is the one
  // reaching further towards the headjoint.
  THUMB_BB: {
    parts: [{ s: 'rect', x: 66, y: 60, w: 30, h: 45, rx: 14 }],
    hit: { x: 66, y: 60, width: 32, height: 55 },
  },
  THUMB_B: {
    parts: [{ s: 'rect', x: 40, y: 114, w: 45, h: 70, rx: 14 }],
    hit: { x: 40, y: 114, width: 50, height: 80 },
  },

  L1: fingerKey(42, 20),
  L2: fingerKey(112, 26),
  L3: fingerKey(188, 28),

  // The G♯ key: a lobe out to the right, an arm back to its pad on the centre
  // line, and the L-shaped touchpiece the left little finger presses.
  L_GSHARP: {
    parts: [
      { s: 'rect', x: 170, y: 200, w: 40, h: 60, rx: 19 },
    ],
    hit: { x: 58, y: 214, width: 46, height: 60 },
  },

  R1: fingerKey(302, 27),
  R2: fingerKey(370, 27),
  R3: fingerKey(444, 25),

  // Trill keys: small levers on the left, between the right-hand keys.
  TRILL_D: {
    parts: [{ s: 'rect', x: 58, y: 326, w: 38, h: 24, rx: 10 }],
    hit: { x: 52, y: 320, width: 50, height: 36 },
  },
  TRILL_DSHARP: {
    parts: [{ s: 'rect', x: 58, y: 396, w: 38, h: 24, rx: 10 }],
    hit: { x: 52, y: 390, width: 50, height: 36 },
  },

  // The E♭ key spans the width — tall and narrow on the horizontal chart, so
  // wide and short once stood upright.
  R_EFLAT: {
    parts: [{ s: 'rect', x: 50, y: 482, w: 112, h: 40, rx: 16 }],
    hit: { x: 44, y: 476, width: 124, height: 52 },
  },

  // Footjoint: a row of levers across the bottom, running large to small — the
  // wide C♯ lever on the left, then C and B, with the little gizmo key on the
  // right. Spacing comes from mirroring the row about x = 97, then shifting the
  // whole row 30 units right; gaps stay even at 21 units.
  FOOT_CSHARP: {
    parts: [{ s: 'rect', x: 56, y: 534, w: 34, h: 62, rx: 13 }],
    hit: { x: 52, y: 530, width: 42, height: 70 },
  },
  FOOT_C: {
    parts: [{ s: 'rect', x: 111, y: 534, w: 15, h: 62, rx: 13 }],
    hit: { x: 103, y: 530, width: 31, height: 70 },
  },
  FOOT_B: {
    parts: [{ s: 'rect', x: 147, y: 534, w: 15, h: 62, rx: 13 }],
    hit: { x: 139, y: 530, width: 31, height: 70 },
  },
  GIZMO: {
    parts: [{ s: 'rect', x: 183, y: 546, w: 15, h: 50, rx: 13 }],
    hit: { x: 175, y: 542, width: 31, height: 58 },
  },
}

export const FLUTE_CHART: ChartLayout = {
  width: 210,
  height: 612,
  pixelWidth: { sm: 74, md: 104, lg: 172 },
  drawings: DRAWINGS,
}
