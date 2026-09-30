import type { TenorSaxKeyId } from '@/domain/keys'
import type { Box, ChartLayout, KeyDrawing } from '@/instruments/types'

/**
 * The tenor saxophone's keys as a front-view fingering chart, matching the
 * standard labelled chart: the six main keys down the centre, the octave key
 * and front F (Aux) above them, the palm keys (C1, C2, C4) up to the right,
 * the left pinky table (G♯, B, C♯, B♭) beside the break between the hands, the
 * side keys (C3, TC, TA) and C5 / fork F♯ (TF) down the left, and the right
 * pinky E♭ / C at the bottom.
 *
 * Unlike the flute chart, the levers carry their chart labels — saxophonists
 * name these keys by them ("C3", "TA"), and the labels are also the tokens of
 * the fingering codes.
 *
 * Geometry is in viewBox units.
 */

const PAD = 5

function pad(box: Box): Box {
  return { x: box.x - PAD, y: box.y - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 }
}

/** One of the six main keys, all the same size on a sax. */
function fingerKey(cy: number): KeyDrawing {
  const cx = 105
  const r = 23
  return {
    parts: [{ s: 'circle', cx, cy, r }],
    hit: pad({ x: cx - r, y: cy - r, width: r * 2, height: r * 2 }),
  }
}

function lever(x: number, y: number, w: number, h: number, rx = 8): KeyDrawing {
  return {
    parts: [{ s: 'rect', x, y, w, h, rx }],
    hit: pad({ x, y, width: w, height: h }),
    text: { x: x + w / 2, y: y + h / 2 },
  }
}

/** A tilted oval, like the palm keys. */
function oval(cx: number, cy: number, rx: number, ry: number, rotate: number): KeyDrawing {
  const reach = Math.max(rx, ry)
  return {
    parts: [{ s: 'ellipse', cx, cy, rx, ry, rotate }],
    hit: pad({ x: cx - reach, y: cy - reach, width: reach * 2, height: reach * 2 }),
    text: { x: cx, y: cy },
  }
}

function shape(d: string, box: Box, text?: { x: number; y: number }): KeyDrawing {
  return { parts: [{ s: 'path', d }], hit: pad(box), text }
}

const DRAWINGS: Record<TenorSaxKeyId, KeyDrawing> = {
  // Octave key: the thumb's teardrop, back and to the left of the top key.
  OCTAVE: shape(
    'M 34 50 Q 44 46 56 66 Q 66 84 60 96 Q 52 104 42 96 Q 30 84 32 66 Q 32 54 34 50 Z',
    { x: 30, y: 46, width: 36, height: 58 },
    { x: 48, y: 80 },
  ),
  FRONT_F: oval(100, 30, 24, 11, -18),

  PALM_DSHARP: oval(192, 55, 12, 27, 12),
  PALM_F: oval(178, 110, 12, 27, 12),
  PALM_D: oval(228, 94, 12, 27, 12),

  L1: fingerKey(80),
  BIS: { ...oval(141, 117, 12, 12, 0), text: { x: 141, y: 117, size: 9 } },
  L2: fingerKey(148),
  L3: fingerKey(220),

  // Left pinky table, beside the break between the hands.
  L_GSHARP: lever(153, 218, 44, 22, 10),
  LOW_B: lever(137, 244, 32, 27, 10),
  LOW_CSHARP: lever(181, 244, 32, 27, 10),
  LOW_BB: lever(150, 277, 50, 22, 10),

  R1: fingerKey(318),
  R2: fingerKey(385),
  R3: fingerKey(453),

  // Side keys down the left of the right hand, top to bottom C3, TC, TA.
  SIDE_E: lever(20, 204, 28, 38),
  SIDE_C: lever(20, 250, 28, 40),
  SIDE_BB: lever(20, 298, 28, 40),
  HIGH_FSHARP: shape(
    'M 58 336 L 72 332 Q 80 331 79 340 L 77 372 Q 74 384 64 381 L 56 377 Q 51 373 52 364 L 53 344 Q 53 337 58 336 Z',
    { x: 51, y: 331, width: 29, height: 52 },
    { x: 65, y: 358 },
  ),
  ALT_FSHARP: shape(
    'M 52 398 L 68 398 Q 72 398 72 404 L 72 412 Q 78 418 72 424 L 72 436 Q 72 442 66 442 L 52 442 Q 48 442 48 436 L 48 404 Q 48 398 52 398 Z',
    { x: 48, y: 398, width: 30, height: 44 },
    { x: 60, y: 420 },
  ),

  // Right pinky: E♭ above C, the pair making one split disc.
  R_EFLAT: shape(
    'M 80 512 Q 80 490 105 490 Q 130 490 130 512 Q 130 516 126 516 L 84 516 Q 80 516 80 512 Z',
    { x: 80, y: 490, width: 50, height: 26 },
    { x: 105, y: 505 },
  ),
  LOW_C: shape(
    'M 84 521 L 126 521 Q 130 521 130 525 Q 130 546 105 546 Q 80 546 80 525 Q 80 521 84 521 Z',
    { x: 80, y: 521, width: 50, height: 25 },
    { x: 105, y: 532 },
  ),
}

export const TENOR_SAX_CHART: ChartLayout = {
  width: 260,
  height: 556,
  pixelWidth: { sm: 96, md: 138, lg: 226 },
  drawings: DRAWINGS,
  // The break between the left and right hands.
  decorations: [{ s: 'arm', x1: 86, y1: 268, x2: 124, y2: 268 }],
}
