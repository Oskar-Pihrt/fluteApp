/**
 * Ground truth from a LilyPond SVG page tagged by omr-annotate.ly.
 *
 * LilyPond's SVG is a flat-ish tree of <g transform="translate(...)"> groups
 * around paths, lines, rects and polygons, with the tagged grobs wrapped in
 * <g class="omr-…">. A small tag scanner with a transform stack is enough to
 * recover a bounding box for every tagged grob, in SVG user units (one unit is
 * one staff space at the default staff size; the page scale says how big).
 */

const NUMBER = /-?\d*\.?\d+(?:e-?\d+)?/gi

function parseAttrs(tag) {
  const attrs = {}
  for (const match of tag.matchAll(/([\w:-]+)="([^"]*)"/g)) attrs[match[1]] = match[2]
  return attrs
}

/** Affine [a b c d e f], composed parent-first like SVG. */
function multiply(m, n) {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ]
}

function parseTransform(value) {
  let m = [1, 0, 0, 1, 0, 0]
  if (!value) return m
  for (const [, kind, body] of value.matchAll(/(\w+)\(([^)]*)\)/g)) {
    const v = (body.match(NUMBER) ?? []).map(Number)
    let t = [1, 0, 0, 1, 0, 0]
    if (kind === 'translate') t = [1, 0, 0, 1, v[0], v[1] ?? 0]
    else if (kind === 'scale') t = [v[0], 0, 0, v[1] ?? v[0], 0, 0]
    else if (kind === 'rotate') {
      const r = (v[0] * Math.PI) / 180
      const [cx, cy] = [v[1] ?? 0, v[2] ?? 0]
      t = multiply(multiply([1, 0, 0, 1, cx, cy], [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]), [1, 0, 0, 1, -cx, -cy])
    } else if (kind === 'matrix') t = v
    m = multiply(m, t)
  }
  return m
}

const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]

/** Every point a path visits, control points included — a superset of its outline. */
function pathPoints(d) {
  const points = []
  let x = 0
  let y = 0
  let startX = 0
  let startY = 0
  for (const [, cmd, body] of d.matchAll(/([MmLlHhVvCcSsQqTtZz])([^MmLlHhVvCcSsQqTtZz]*)/g)) {
    const v = (body.match(NUMBER) ?? []).map(Number)
    const rel = cmd === cmd.toLowerCase()
    const C = cmd.toUpperCase()
    const per = { M: 2, L: 2, T: 2, H: 1, V: 1, C: 6, S: 4, Q: 4, Z: 0 }[C]
    if (C === 'Z') {
      x = startX
      y = startY
      continue
    }
    for (let i = 0; i + per <= v.length; i += per) {
      const chunk = v.slice(i, i + per)
      if (C === 'H') {
        x = rel ? x + chunk[0] : chunk[0]
        points.push([x, y])
        continue
      }
      if (C === 'V') {
        y = rel ? y + chunk[0] : chunk[0]
        points.push([x, y])
        continue
      }
      for (let k = 0; k < per; k += 2) points.push([rel ? x + chunk[k] : chunk[k], rel ? y + chunk[k + 1] : chunk[k + 1]])
      const [ex, ey] = points[points.length - 1]
      x = ex
      y = ey
      if (C === 'M' && i === 0) {
        startX = x
        startY = y
      }
    }
  }
  return points
}

function shapePoints(name, attrs) {
  const n = (key) => Number(attrs[key] ?? 0)
  const half = n('stroke-width') / 2
  if (name === 'line') {
    return [
      [n('x1') - half, n('y1') - half],
      [n('x2') + half, n('y2') + half],
      [n('x1') - half, n('y1') + half],
      [n('x2') + half, n('y2') - half],
    ]
  }
  if (name === 'rect') {
    return [
      [n('x'), n('y')],
      [n('x') + n('width'), n('y') + n('height')],
    ]
  }
  if (name === 'polygon') {
    const v = (attrs.points.match(NUMBER) ?? []).map(Number)
    const pts = []
    for (let i = 0; i + 1 < v.length; i += 2) pts.push([v[i], v[i + 1]])
    return pts
  }
  if (name === 'path') return pathPoints(attrs.d ?? '')
  return []
}

export function parsePageSvg(svg) {
  const root = svg.match(/<svg[^>]*>/)[0]
  const rootAttrs = parseAttrs(root)
  const viewBox = rootAttrs.viewBox.split(/\s+/).map(Number)
  const widthMm = parseFloat(rootAttrs.width)
  const heightMm = parseFloat(rootAttrs.height)

  /** Open groups: transform, and the tagged element collecting points, if any. */
  const stack = [{ m: [1, 0, 0, 1, 0, 0], item: null }]
  const items = []

  for (const match of svg.matchAll(/<(\/?)(g|path|line|rect|polygon|a|text)\b([^>]*?)(\/?)>/g)) {
    const [, closing, name, body, selfClosing] = match
    if (closing) {
      if (name === 'g' || name === 'a') stack.pop()
      continue
    }
    const attrs = parseAttrs(body)
    const parent = stack[stack.length - 1]
    if (name === 'g' || name === 'a') {
      const m = multiply(parent.m, parseTransform(attrs.transform))
      let item = parent.item
      if (attrs.class?.startsWith('omr-')) {
        item = { cls: attrs.class.slice(4), attrs, minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, origin: apply(m, 0, 0) }
        items.push(item)
      } else if (item && (item.cls === 'keysig' || item.cls === 'keycancel') && parent.item === item && !parent.isPart) {
        // Each glyph of a key signature is its own translated group; record it
        // separately so every sharp or flat gets its own box.
        const kind = item.cls === 'keycancel' ? 'natural' : item.attrs['data-kind']
        item = { cls: 'keyglyph', attrs: { 'data-kind': kind }, minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity, parentItem: parent.item }
        items.push(item)
      }
      if (!selfClosing) stack.push({ m, item, isPart: item?.cls === 'keyglyph' || parent.isPart })
      continue
    }
    if (!parent.item) continue
    const m = multiply(parent.m, parseTransform(attrs.transform))
    for (const [px, py] of shapePoints(name, attrs)) {
      const [x, y] = apply(m, px, py)
      for (const item of parent.item.parentItem ? [parent.item, parent.item.parentItem] : [parent.item]) {
      if (x < item.minX) item.minX = x
      if (y < item.minY) item.minY = y
      if (x > item.maxX) item.maxX = x
      if (y > item.maxY) item.maxY = y
      }
    }
  }

  const boxed = items.filter((item) => Number.isFinite(item.minX))
  const box = (item) => ({ x: item.minX, y: item.minY, width: item.maxX - item.minX, height: item.maxY - item.minY })

  // Staff lines: each StaffSymbol holds five horizontal lines.
  const staves = []
  for (const match of svg.matchAll(/<g class="omr-staff">([\s\S]*?)(?=<g class="omr-|$)/g)) {
    const ys = []
    let x0 = Infinity
    let x1 = -Infinity
    for (const line of match[1].matchAll(/<g transform="translate\(([-\d.]+), ([-\d.]+)\)">\s*<line[^>]*x1="([-\d.]+)"[^>]*x2="([-\d.]+)"/g)) {
      const [tx, ty, lx1, lx2] = line.slice(1).map(Number)
      ys.push(ty)
      x0 = Math.min(x0, tx + lx1)
      x1 = Math.max(x1, tx + lx2)
    }
    if (ys.length === 5) staves.push({ lines: ys.sort((a, b) => a - b), x0, x1 })
  }
  staves.sort((a, b) => a.lines[0] - b.lines[0])

  const noteheads = boxed
    .filter((item) => item.cls === 'notehead')
    .map((item) => {
      const b = box(item)
      const cy = b.y + b.height / 2
      const staffIndex = nearestStaff(staves, cy)
      return {
        x: b.x + b.width / 2,
        y: cy,
        width: b.width,
        height: b.height,
        staffIndex,
        midi: Number(item.attrs['data-midi']),
        step: Number(item.attrs['data-step']),
        alt: item.attrs['data-alt'],
        log: Number(item.attrs['data-log']),
        grace: item.attrs['data-grace'] === '1',
        tied: item.attrs['data-tied'] === '1',
      }
    })
    .filter((note) => note.staffIndex >= 0)

  const symbols = boxed.filter((item) => item.cls !== 'notehead' && item.cls !== 'staff').map((item) => ({ cls: item.cls, ...box(item), alt: item.attrs['data-alt'], kind: item.attrs['data-kind'] }))

  const unitMm = widthMm / viewBox[2]

  return {
    noteheads,
    staves,
    /** The same truth in pixels for a page rasterised at `dpi`. */
    toPixels(dpi) {
      const s = (unitMm / 25.4) * dpi
      const px = (b) => ({ ...b, x: b.x * s, y: b.y * s, width: b.width * s, height: b.height * s })
      return {
        dpi,
        width: Math.round((widthMm / 25.4) * dpi),
        height: Math.round((heightMm / 25.4) * dpi),
        pixelsPerUnit: s,
        staves: staves.map((st) => ({ lines: st.lines.map((y) => y * s), x0: st.x0 * s, x1: st.x1 * s })),
        noteheads: noteheads.map(px),
        symbols: symbols.map(px),
      }
    },
  }
}

/** Index of the staff a y belongs to, or -1 when it is nowhere near one. */
function nearestStaff(staves, y) {
  let best = -1
  let bestDistance = Infinity
  for (const [index, staff] of staves.entries()) {
    const centre = (staff.lines[0] + staff.lines[4]) / 2
    const distance = Math.abs(y - centre)
    if (distance < bestDistance) {
      bestDistance = distance
      best = index
    }
  }
  return bestDistance < 9 ? best : -1
}
