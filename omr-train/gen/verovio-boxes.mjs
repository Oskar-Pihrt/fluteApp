/**
 * Bounding boxes for every drawn element of a Verovio SVG page.
 *
 * Verovio draws glyphs as <use> references to SMuFL glyph definitions, with
 * staff lines, stems, beams and barlines as plain paths, rects and polygons,
 * all inside <g class="…" id="…"> groups named after the MEI element. Boxes are
 * computed from the geometry itself (not from Verovio's optional bounding-box
 * rects, which miss key-signature glyphs), in the units of the inner
 * `definition-scale` viewBox.
 */

const NUMBER = /-?\d*\.?\d+(?:e-?\d+)?/gi

const parseAttrs = (tag) => {
  const attrs = {}
  for (const match of tag.matchAll(/([\w:.-]+)="([^"]*)"/g)) attrs[match[1]] = match[2]
  return attrs
}

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
      const a = (v[0] * Math.PI) / 180
      const [cx, cy] = [v[1] ?? 0, v[2] ?? 0]
      t = multiply(multiply([1, 0, 0, 1, cx, cy], [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0]), [1, 0, 0, 1, -cx, -cy])
    } else if (kind === 'matrix') t = v
    m = multiply(m, t)
  }
  return m
}

const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]

export function pathPoints(d) {
  const points = []
  let x = 0
  let y = 0
  let sx = 0
  let sy = 0
  for (const [, cmd, body] of d.matchAll(/([MmLlHhVvCcSsQqTtZz])([^MmLlHhVvCcSsQqTtZz]*)/g)) {
    const v = (body.match(NUMBER) ?? []).map(Number)
    const rel = cmd === cmd.toLowerCase()
    const C = cmd.toUpperCase()
    if (C === 'Z') {
      x = sx
      y = sy
      continue
    }
    const per = { M: 2, L: 2, T: 2, H: 1, V: 1, C: 6, S: 4, Q: 4 }[C]
    for (let i = 0; i + per <= v.length; i += per) {
      const c = v.slice(i, i + per)
      if (C === 'H') x = rel ? x + c[0] : c[0]
      else if (C === 'V') y = rel ? y + c[0] : c[0]
      else {
        for (let k = 0; k < per - 2; k += 2) points.push([rel ? x + c[k] : c[k], rel ? y + c[k + 1] : c[k + 1]])
        x = rel ? x + c[per - 2] : c[per - 2]
        y = rel ? y + c[per - 1] : c[per - 1]
      }
      points.push([x, y])
      if (C === 'M' && i === 0) {
        sx = x
        sy = y
      }
    }
  }
  return points
}

function shapePoints(name, attrs) {
  const n = (k) => Number(attrs[k] ?? 0)
  const half = n('stroke-width') / 2
  if (name === 'path') {
    const pts = pathPoints(attrs.d ?? '')
    if (!half) return pts
    return pts.flatMap(([x, y]) => [
      [x - half, y - half],
      [x + half, y + half],
    ])
  }
  if (name === 'rect') return [[n('x'), n('y')], [n('x') + n('width'), n('y') + n('height')]]
  if (name === 'ellipse') return [[n('cx') - n('rx'), n('cy') - n('ry')], [n('cx') + n('rx'), n('cy') + n('ry')]]
  if (name === 'polygon' || name === 'polyline') {
    const v = (attrs.points.match(NUMBER) ?? []).map(Number)
    const pts = []
    for (let i = 0; i + 1 < v.length; i += 2) pts.push([v[i], v[i + 1]])
    return pts
  }
  return []
}

const TRACKED = new Set([
  'note', 'notehead', 'accid', 'keyAccid', 'keySig', 'clef', 'barLine', 'octave', 'tie', 'slur', 'staff',
  'rest', 'mRest', 'multiRest', 'beam', 'stem', 'dots', 'artic', 'dynam', 'dir', 'tempo', 'trill', 'fing',
  'hairpin', 'meterSig', 'chord', 'tuplet', 'flag', 'ledgerLines', 'mNum', 'pgHead', 'label', 'reh',
  'measure', 'ending', 'repeatMark',
])

/**
 * @returns {{ viewBox: number[], elements: Array<{cls, id, box, glyphs, parent, lines}> }}
 *   `glyphs` lists the SMuFL code points drawn directly in the element;
 *   `lines` (staff only) the y of each staff line.
 */
export function extractBoxes(svg) {
  // Glyph definitions: id → points in the glyph's own coordinates.
  const defs = {}
  const defsBlock = svg.match(/<defs>([\s\S]*?)<\/defs>/)?.[1] ?? ''
  for (const match of defsBlock.matchAll(/<g id="([^"]+)"[^>]*>([\s\S]*?)<\/g>/g)) {
    const pts = []
    for (const path of match[2].matchAll(/<path([^>]*)\/?>/g)) {
      const a = parseAttrs(path[1])
      const m = parseTransform(a.transform)
      for (const [x, y] of pathPoints(a.d ?? '')) pts.push(apply(m, x, y))
    }
    defs[match[1]] = pts
  }

  const body = svg.slice(svg.indexOf('</defs>'))
  const viewBox = (body.match(/class="definition-scale"[^>]*viewBox="([^"]+)"/)?.[1] ?? '0 0 0 0').split(/\s+/).map(Number)

  const elements = []
  const stack = [{ m: [1, 0, 0, 1, 0, 0], tracked: [], skip: false }]
  for (const match of body.matchAll(/<(\/?)(g|path|rect|polygon|polyline|ellipse|use|svg|text|tspan)\b([^>]*?)(\/?)>/g)) {
    const [, closing, name, attrBody, selfClosing] = match
    if (closing) {
      if (name === 'g' || name === 'svg' || name === 'text') stack.pop()
      continue
    }
    if (name === 'tspan') {
      // Text has no outline to measure; remember where it starts and how big
      // it is, so its box can be estimated from the string.
      const own = stack[stack.length - 1].tracked.at(-1)
      const size = parseFloat(parseAttrs(attrBody)['font-size'] ?? '')
      if (own?.text && size) own.text.size = Math.max(own.text.size ?? 0, size * stack[stack.length - 1].m[0])
      continue
    }
    const attrs = parseAttrs(attrBody)
    const parent = stack[stack.length - 1]
    if (name === 'text' && parent.tracked.length && !parent.skip) {
      const own = parent.tracked.at(-1)
      const [tx, ty] = apply(parent.m, parseFloat(attrs.x ?? '0'), parseFloat(attrs.y ?? '0'))
      own.text ??= { x: tx, y: ty }
    }
    if (name === 'g' || name === 'svg' || name === 'text') {
      const cls = (attrs.class ?? '').split(/\s+/)
      const skip = parent.skip || cls.includes('bounding-box')
      const m = name === 'svg' ? parent.m : multiply(parent.m, parseTransform(attrs.transform))
      let tracked = parent.tracked
      const main = cls.find((c) => TRACKED.has(c))
      if (main && !skip && name === 'g') {
        const element = {
          cls: main,
          id: attrs.id ?? null,
          parent: parent.tracked.at(-1) ?? null,
          minX: Infinity,
          minY: Infinity,
          maxX: -Infinity,
          maxY: -Infinity,
          glyphs: [],
          lines: [],
        }
        elements.push(element)
        tracked = [...parent.tracked, element]
      }
      if (!selfClosing) stack.push({ m, tracked, skip })
      continue
    }
    if (parent.skip || !parent.tracked.length) continue
    const m = multiply(parent.m, parseTransform(attrs.transform))
    let pts
    if (name === 'use') {
      const href = (attrs['xlink:href'] ?? attrs.href ?? '').slice(1)
      pts = defs[href] ?? []
      const code = href.split('-')[0]
      parent.tracked.at(-1).glyphs.push(code)
    } else {
      pts = shapePoints(name, attrs)
    }
    const own = parent.tracked.at(-1)
    if (own.cls === 'staff' && name === 'path') {
      const p = pathPoints(attrs.d ?? '')
      if (p.length === 2 && Math.abs(p[0][1] - p[1][1]) < 1e-6 && Math.abs(p[1][0] - p[0][0]) > 500) {
        const [x0, y] = apply(m, p[0][0], p[0][1])
        const [x1] = apply(m, p[1][0], p[1][1])
        own.lines.push({ y, x0: Math.min(x0, x1), x1: Math.max(x0, x1) })
      }
    }
    for (const [px, py] of pts) {
      const [x, y] = apply(m, px, py)
      for (const element of parent.tracked) {
        if (x < element.minX) element.minX = x
        if (y < element.minY) element.minY = y
        if (x > element.maxX) element.maxX = x
        if (y > element.maxY) element.maxY = y
      }
    }
  }

  return {
    viewBox,
    elements: elements
      .filter((e) => Number.isFinite(e.minX) || e.lines.length || e.text)
      .map((e) => ({
        cls: e.cls,
        id: e.id,
        parent: e.parent,
        glyphs: e.glyphs,
        lines: e.lines,
        text: e.text ?? null,
        box: { x: e.minX, y: e.minY, width: e.maxX - e.minX, height: e.maxY - e.minY },
        ref: e,
      })),
  }
}
