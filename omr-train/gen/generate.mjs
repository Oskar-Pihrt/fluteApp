#!/usr/bin/env node
/**
 * Render synthetic training pages with Verovio.
 *
 *   node generate.mjs --from 0 --count 500 [--out ../data/verovio]
 *
 * Each seed is one random piece (melody.mjs) engraved with randomised font,
 * page size, staff size, spacing and line weights, rasterised by rsvg-convert at
 * a random staff spacing, and written as `<seed>-p<page>.png` plus a JSON of
 * ground truth in pixels: staff lines, every notehead with its sounding pitch,
 * and every symbol class the detector learns.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import createVerovioModule from 'verovio/wasm'
import { VerovioToolkit } from 'verovio/esm'
import { generatePiece, rng } from './melody.mjs'
import { extractBoxes } from './verovio-boxes.mjs'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(name)
  return i === -1 ? fallback : args[i + 1]
}
const from = Number(flag('--from', 0))
const count = Number(flag('--count', 10))
const out = resolve(flag('--out', new URL('../data/verovio', import.meta.url).pathname))
mkdirSync(out, { recursive: true })

const FONTS = ['Leipzig', 'Bravura', 'Leland', 'Petaluma', 'Gootville']
/** SMuFL accidental code points → printed accidental. */
const ACCIDENTALS = { E260: 'flat', E261: 'natural', E262: 'sharp', E263: 'dsharp', E264: 'dflat', E266: 'dsharp', E267: 'dflat' }
/** SMuFL rest code points → the rest's duration. */
const RESTS = { E4E3: 'whole', E4E4: 'half', E4E5: 'quarter', E4E6: 'eighth', E4E7: '16th', E4E8: '32nd' }
/** SMuFL time signature digits, and the common/cut symbols. */
const TIME_DIGITS = { E080: '0', E081: '1', E082: '2', E083: '3', E084: '4', E085: '5', E086: '6', E087: '7', E088: '8', E089: '9' }
const TIME_SYMBOLS = { E08A: 'common', E08B: 'cut' }
/** MEI @dur → duration name. */
const DURATIONS = { 1: 'whole', 2: 'half', 4: 'quarter', 8: 'eighth', 16: '16th', 32: '32nd' }

/**
 * Verovio sets a metronome mark's note as a glyph of the music font in text,
 * which rsvg can't draw without the font installed. Draw it as the engraver
 * would instead: the page's own notehead symbol and a stem, in the room the
 * glyph took. Nothing here is a notehead in the truth, so the detector learns
 * that a note in a tempo mark is not one to read.
 */
function drawMetronomeMarks(svg, r) {
  const staffLines = [...(svg.match(/class="staff"[\s\S]*?<\/g>/)?.[0] ?? '').matchAll(/d="M\d+ (\d+) L\d+ \d+"/g)].map((m) => +m[1])
  if (staffLines.length < 5) return svg
  const space = (staffLines[4] - staffLines[0]) / 4
  const black = svg.match(/xlink:href="#(E0A4-[^"]+)"/)?.[1]
  const hollow = svg.match(/xlink:href="#(E0A3-[^"]+)"/)?.[1] ?? black
  if (!black) return svg
  return svg.replace(/(<g[^>]*class="tempo"[^>]*>\s*<text x="([\d.]+)" y="([\d.]+)"[^>]*>)([\s\S]*?)(<\/text>)/g, (all, open, x, y, body, close) => {
    const glyph = body.match(/<tspan[^>]*class="rend"[^>]*>\s*<tspan[^>]*class="text"[^>]*>\s*<tspan font-family="[^"]*" font-size="([\d.]+)px">(.)<\/tspan>\s*<\/tspan>\s*<\/tspan>/)
    if (!glyph) return all
    const textSize = Number(body.match(/<tspan font-size="([\d.]+)px">/)?.[1] ?? space * 2.2)
    // Where the glyph starts: after the text before it, at about half an em a character.
    const before = [...body.slice(0, glyph.index).matchAll(/<tspan font-size="[\d.]+px">([^<]*)<\/tspan>/g)].map((m) => m[1]).join('')
    const startX = Number(x) + before.length * textSize * 0.58
    const scale = 0.72 * (0.7 + r.next() * 0.45)
    const headWidth = 1.18 * space * (scale / 0.72)
    const cx = startX + space * 0.2
    const cy = Number(y) - space * 0.3
    const code = glyph[2].codePointAt(0).toString(16).toUpperCase()
    const href = code === 'E1D3' ? hollow : black
    const stemX = cx + headWidth - space * 0.06
    const flag = code === 'E1D7' ? `<path d="M${stemX} ${cy - space * 3} Q${stemX + space * 0.9} ${cy - space * 2.2} ${stemX + space * 0.7} ${cy - space * 1.2}" fill="none" stroke-width="${space * 0.18}" />` : ''
    const note = `<g class="metronome"><use xlink:href="#${href}" transform="translate(${cx}, ${cy}) scale(${scale}, ${scale})" /><path d="M${stemX} ${cy - space * 0.15} L${stemX} ${cy - space * 3}" stroke-width="${space * 0.12}" />${flag}</g>`
    // Keep the room the glyph took, so "= 112" still sits after the note.
    const gap = `<tspan font-size="${textSize}px">${'\u00a0'.repeat(4)}</tspan>`
    return open + body.replace(glyph[0], gap) + close + note
  })
}

const toolkit = new VerovioToolkit(await createVerovioModule())
// Verovio is chatty about recoverable encoding quirks; they are not errors here.
console.warn = () => {}

for (let seed = from; seed < from + count; seed++) {
  const r = rng(seed * 7919 + 13)
  const { mei, notes, measureTruth, marks } = generatePiece(seed)
  const truthById = Object.fromEntries(notes.map((n) => [n.id, n]))

  const letter = r.chance(0.3)
  toolkit.setOptions({
    font: r.pick(FONTS),
    pageWidth: letter ? 2159 : r.chance(0.15) ? r.int(1400, 2000) : 2100,
    pageHeight: letter ? 2794 : 2970,
    pageMarginLeft: r.int(40, 200),
    pageMarginRight: r.int(40, 200),
    pageMarginTop: r.int(40, 200),
    pageMarginBottom: r.int(40, 150),
    unit: 6.5 + r.next() * 3.5,
    spacingLinear: 0.15 + r.next() * 0.2,
    spacingNonLinear: 0.45 + r.next() * 0.25,
    spacingStaff: r.int(5, 16),
    spacingSystem: r.int(2, 10),
    staffLineWidth: 0.1 + r.next() * 0.15,
    stemWidth: 0.15 + r.next() * 0.15,
    ledgerLineThickness: 0.18 + r.next() * 0.12,
    mnumInterval: r.pick([0, 0, 1, 5]),
    header: r.chance(0.7) ? 'auto' : 'none',
    footer: 'none',
    justifyVertically: r.chance(0.3),
    breaks: 'auto',
    beamMaxSlope: r.int(5, 15),
  })
  if (!toolkit.loadData(mei)) {
    console.log(`skip ${seed}: MEI rejected`)
    continue
  }

  const pages = Math.min(toolkit.getPageCount(), 2)
  for (let page = 1; page <= pages; page++) {
    const svg = drawMetronomeMarks(toolkit.renderToSVG(page), r)
    const { viewBox, elements } = extractBoxes(svg)
    const byRef = new Map(elements.map((e) => [e.ref, e]))
    const parentOf = (e) => (e.parent ? byRef.get(e.parent) : null)

    const staves = elements
      .filter((e) => e.cls === 'staff' && e.lines.length === 5)
      .map((e) => ({ lines: e.lines.map((l) => l.y).sort((a, b) => a - b), x0: Math.min(...e.lines.map((l) => l.x0)), x1: Math.max(...e.lines.map((l) => l.x1)) }))
    // Verovio draws a staff per measure; merge those on the same system.
    const systems = []
    for (const staff of staves.sort((a, b) => a.lines[0] - b.lines[0] || a.x0 - b.x0)) {
      const same = systems.find((s) => Math.abs(s.lines[0] - staff.lines[0]) < 1)
      if (same) {
        same.x0 = Math.min(same.x0, staff.x0)
        same.x1 = Math.max(same.x1, staff.x1)
      } else systems.push({ ...staff })
    }
    if (!systems.length) continue
    const S = (systems[0].lines[4] - systems[0].lines[0]) / 4

    // Raster scale: a random staff spacing, so the model sees real size variety
    // before its own scale normalisation.
    const targetS = 7 + r.next() * 10
    const k = targetS / S
    const width = Math.round(viewBox[2] * k)
    const height = Math.round(viewBox[3] * k)
    const px = (b) => ({ x: b.x * k, y: b.y * k, width: b.width * k, height: b.height * k })

    const noteheads = []
    for (const e of elements) {
      if (e.cls !== 'notehead') continue
      const note = parentOf(e)
      const truth = note?.id ? truthById[note.id] : null
      if (!truth) continue
      const b = px(e.box)
      // Noteheads are stored by centre, like the eval truth; symbols by top-left box.
      noteheads.push({
        x: b.x + b.width / 2,
        y: b.y + b.height / 2,
        width: b.width,
        height: b.height,
        midi: truth.midi,
        grace: truth.grace,
        hollow: truth.hollow,
        tied: truth.tied,
        chordLow: !!truth.chordLow,
        ...(truth.dur ? { dur: DURATIONS[truth.dur], dots: truth.dots ?? 0 } : {}),
      })
    }

    // Augmentation dots, counted per note or rest they belong to.
    const dotCount = new Map()
    for (const e of elements) {
      if (e.cls !== 'dots' || !e.parent) continue
      dotCount.set(e.parent, (dotCount.get(e.parent) ?? 0) + e.glyphs.filter((g) => g === 'E1E7').length)
    }
    // Barlines by the measure they close (or open, for a repeat start).
    const barlinesOf = new Map()
    for (const e of elements) {
      if (e.cls !== 'barLine' || !e.parent) continue
      const list = barlinesOf.get(e.parent) ?? []
      list.push(e)
      barlinesOf.set(e.parent, list)
    }
    const barlineKind = (e) => {
      const measure = parentOf(e)
      const truth = measure?.id ? measureTruth[measure.id] : null
      if (!truth) return 'normal'
      const list = (barlinesOf.get(e.parent) ?? []).sort((a, b) => a.box.x - b.box.x)
      const first = list[0] === e && list.length > 1
      if (truth.left === 'rptstart' && first) return 'repeat_start'
      if (truth.right === 'rptend') return 'repeat_end'
      if (truth.right === 'rptboth') return 'repeat_both'
      if (truth.right === 'end') return 'final'
      if (truth.right === 'dbl') return 'double'
      return 'normal'
    }

    const symbols = []
    for (const e of elements) {
      if (e.cls === 'accid' || e.cls === 'keyAccid') {
        const kind = e.glyphs.map((g) => ACCIDENTALS[g]).find(Boolean)
        if (kind) symbols.push({ cls: kind, key: e.cls === 'keyAccid', ...px(e.box) })
      } else if (e.cls === 'rest' || e.cls === 'mRest') {
        const kind = e.glyphs.map((g) => RESTS[g]).find(Boolean)
        symbols.push({ cls: e.cls, ...(kind ? { kind, dots: dotCount.get(e.ref) ?? 0 } : {}), ...px(e.box) })
      } else if (e.cls === 'meterSig') {
        const symbol = e.glyphs.map((g) => TIME_SYMBOLS[g]).find(Boolean)
        const digits = e.glyphs.map((g) => TIME_DIGITS[g] ?? '').join('')
        symbols.push({ cls: e.cls, kind: symbol ?? digits, ...px(e.box) })
      } else if (e.cls === 'barLine') {
        symbols.push({ cls: e.cls, kind: barlineKind(e), ...px(e.box) })
      } else if (e.cls === 'ending') {
        symbols.push({ cls: 'volta', ...px(e.box) })
      } else if (e.cls === 'repeatMark' && e.id && marks[e.id]) {
        symbols.push({ cls: 'mark', kind: marks[e.id], ...px(e.box) })
      } else if (e.cls === 'dir' && e.id && marks[e.id] && e.text?.size) {
        // Text has no outline: a box estimated from where it starts, its size
        // and the string's length.
        const string = { dc: 'D.C.', dc_al_fine: 'D.C. al Fine', dc_al_coda: 'D.C. al Coda', ds: 'D.S.', ds_al_fine: 'D.S. al Fine', ds_al_coda: 'D.S. al Coda', fine: 'Fine', to_coda: 'To Coda' }[marks[e.id]] ?? ''
        const size = e.text.size
        symbols.push({ cls: 'mark', kind: marks[e.id], ...px({ x: e.text.x, y: e.text.y - size * 0.75, width: size * 0.5 * string.length, height: size }) })
      } else if (['clef', 'octave', 'multiRest', 'tie', 'slur', 'dynam', 'fing', 'trill', 'artic', 'dots', 'beam'].includes(e.cls)) {
        symbols.push({ cls: e.cls, ...px(e.box) })
      }
    }

    const name = `${String(seed).padStart(6, '0')}-p${page}`
    writeFileSync(join(out, `${name}.svg`), svg)
    execFileSync('rsvg-convert', ['-b', 'white', '-w', String(width), '-h', String(height), '-o', join(out, `${name}.png`), join(out, `${name}.svg`)])
    rmSync(join(out, `${name}.svg`))
    writeFileSync(
      join(out, `${name}.json`),
      JSON.stringify({
        source: 'verovio',
        width,
        height,
        S: S * k,
        staves: systems.map((s) => ({ lines: s.lines.map((y) => y * k), x0: s.x0 * k, x1: s.x1 * k })),
        noteheads,
        symbols,
      }),
    )
  }
  if (seed % 25 === 0) console.log(`seed ${seed}`)
}
