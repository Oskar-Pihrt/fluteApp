import type { FluteKeyId } from '@/domain/keys'
import type { Box, ChartLayout, KeyDrawing } from '@/instruments/types'

/**
 * The flute's keywork drawn as a fingering chart, in the same visual language
 * as the saxophone chart: six equal finger keys down the centre with a break
 * between the hands, and the levers drawn as shaped, lettered keys around them
 * rather than plain boxes.
 *
 * Laid out upright with the headjoint at the top: the two thumb keys back to
 * the left of the left hand, the G♯ lever out to the right beside it, the two
 * trill keys tucked between the right-hand keys on the left, the E♭ lever to
 * the right of the right hand, and the footjoint keys in a row at the bottom.
 *
 * Geometry is in viewBox units.
 */

const PAD = 5

function pad(box: Box): Box {
  return { x: box.x - PAD, y: box.y - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 }
}

/** One of the six finger keys. Ring keys, so they can be drawn vented. */
function fingerKey(cy: number): KeyDrawing {
  const cx = 120
  const r = 24
  return {
    parts: [{ s: 'circle', cx, cy, r }],
    ring: { cx, cy, r },
    hit: pad({ x: cx - r, y: cy - r, width: r * 2, height: r * 2 }),
  }
}

/** A tilted oval, like the trill keys. */
function oval(cx: number, cy: number, rx: number, ry: number, rotate: number, size?: number): KeyDrawing {
  const reach = Math.max(rx, ry)
  return {
    parts: [{ s: 'ellipse', cx, cy, rx, ry, rotate }],
    hit: pad({ x: cx - reach, y: cy - reach, width: reach * 2, height: reach * 2 }),
    text: { x: cx, y: cy, size },
  }
}

function shape(d: string, box: Box, text: { x: number; y: number; size?: number }): KeyDrawing {
  return { parts: [{ s: 'path', d }], hit: pad(box), text }
}

const DRAWINGS: Record<FluteKeyId, KeyDrawing> = {
  // Thumb keys, back and to the left of the left hand: the small B♭ lever
  // reaching towards the headjoint, and the B thumb's teardrop below it.
  THUMB_BB: shape(
    'M 52 34 L 72 39 Q 80 41 78 50 L 72 80 Q 70 88 62 86 L 48 82 Q 41 80 42 72 L 44 42 Q 45 33 52 34 Z',
    { x: 41, y: 33, width: 39, height: 55 },
    { x: 61, y: 61 },
  ),
  THUMB_B: shape(
    'M 56 96 Q 80 100 80 128 Q 80 166 64 180 Q 56 186 48 180 Q 32 166 32 128 Q 32 100 56 96 Z',
    { x: 32, y: 96, width: 48, height: 87 },
    { x: 56, y: 138 },
  ),

  L1: fingerKey(60),
  L2: fingerKey(128),
  L3: fingerKey(196),

  // The G♯ lever for the left little finger, out to the right of L3.
  L_GSHARP: shape(
    'M 160 186 L 200 178 Q 210 177 210 187 L 210 206 Q 210 214 201 215 L 162 220 Q 154 221 154 212 L 154 194 Q 154 187 160 186 Z',
    { x: 154, y: 177, width: 56, height: 44 },
    { x: 182, y: 199 },
  ),

  R1: fingerKey(292),
  R2: fingerKey(360),
  R3: fingerKey(428),

  // Trill keys: small tilted levers on the left, between the right-hand keys.
  TRILL_D: oval(72, 326, 11, 21, -20, 10),
  TRILL_DSHARP: oval(72, 394, 11, 21, -20, 10),

  // The E♭ lever for the right little finger, out to the right of R3.
  R_EFLAT: shape(
    'M 160 420 L 200 412 Q 210 411 210 421 L 210 444 Q 210 452 201 453 L 162 458 Q 154 459 154 450 L 154 428 Q 154 421 160 420 Z',
    { x: 154, y: 411, width: 56, height: 48 },
    { x: 182, y: 435 },
  ),

  // Footjoint, across the bottom: the broad C♯ lever, the C and B rollers,
  // and the little gizmo key.
  FOOT_CSHARP: shape(
    'M 52 486 L 88 482 Q 98 481 98 491 L 98 540 Q 98 550 88 550 L 52 548 Q 42 547 42 537 L 42 496 Q 42 487 52 486 Z',
    { x: 42, y: 481, width: 56, height: 69 },
    { x: 70, y: 516 },
  ),
  FOOT_C: shape(
    'M 120 482 Q 130 482 130 494 L 130 538 Q 130 550 120 550 Q 110 550 110 538 L 110 494 Q 110 482 120 482 Z',
    { x: 110, y: 482, width: 20, height: 68 },
    { x: 120, y: 516 },
  ),
  FOOT_B: shape(
    'M 152 482 Q 162 482 162 494 L 162 538 Q 162 550 152 550 Q 142 550 142 538 L 142 494 Q 142 482 152 482 Z',
    { x: 142, y: 482, width: 20, height: 68 },
    { x: 152, y: 516 },
  ),
  GIZMO: oval(188, 524, 10, 22, 12, 9),
}

export const FLUTE_CHART: ChartLayout = {
  width: 230,
  height: 566,
  pixelWidth: { sm: 84, md: 120, lg: 196 },
  drawings: DRAWINGS,
  // The break between the left and right hands.
  decorations: [{ s: 'arm', x1: 101, y1: 244, x2: 139, y2: 244 }],
  // In the margin left of the chart, level with the break between the hands.
  matchAnchor: { x: -30, y: 283 },
}
