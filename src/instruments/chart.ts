import type { Box, KeyDrawing } from './types'

/** Drawing helpers shared by the instrument charts. Geometry is in viewBox units. */

const PAD = 5

/** A hit box a little larger than the key, so small keys stay tappable. */
export function pad(box: Box): Box {
  return { x: box.x - PAD, y: box.y - PAD, width: box.width + PAD * 2, height: box.height + PAD * 2 }
}

/** A round tone hole or ring key. Rings can be drawn partly closed. */
export function hole(cx: number, cy: number, r: number): KeyDrawing {
  return {
    parts: [{ s: 'circle', cx, cy, r }],
    ring: { cx, cy, r },
    hit: pad({ x: cx - r, y: cy - r, width: r * 2, height: r * 2 }),
  }
}

/** A rounded rectangular lever with its label on it. */
export function lever(x: number, y: number, w: number, h: number, rx = 8, size?: number): KeyDrawing {
  return {
    parts: [{ s: 'rect', x, y, w, h, rx }],
    hit: pad({ x, y, width: w, height: h }),
    text: { x: x + w / 2, y: y + h / 2, size },
  }
}

/** A tilted oval key with its label on it. */
export function oval(cx: number, cy: number, rx: number, ry: number, rotate: number, size?: number): KeyDrawing {
  const reach = Math.max(rx, ry)
  return {
    parts: [{ s: 'ellipse', cx, cy, rx, ry, rotate }],
    hit: pad({ x: cx - reach, y: cy - reach, width: reach * 2, height: reach * 2 }),
    text: { x: cx, y: cy, size },
  }
}
