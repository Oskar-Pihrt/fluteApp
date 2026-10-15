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

const toolkit = new VerovioToolkit(await createVerovioModule())
// Verovio is chatty about recoverable encoding quirks; they are not errors here.
console.warn = () => {}

for (let seed = from; seed < from + count; seed++) {
  const r = rng(seed * 7919 + 13)
  const { mei, notes } = generatePiece(seed)
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
    const svg = toolkit.renderToSVG(page)
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
      noteheads.push({ x: b.x + b.width / 2, y: b.y + b.height / 2, width: b.width, height: b.height, midi: truth.midi, grace: truth.grace, hollow: truth.hollow, tied: truth.tied, chordLow: !!truth.chordLow })
    }

    const symbols = []
    for (const e of elements) {
      if (e.cls === 'accid' || e.cls === 'keyAccid') {
        const kind = e.glyphs.map((g) => ACCIDENTALS[g]).find(Boolean)
        if (kind) symbols.push({ cls: kind, key: e.cls === 'keyAccid', ...px(e.box) })
      } else if (['clef', 'barLine', 'octave', 'rest', 'mRest', 'multiRest', 'tie', 'slur', 'meterSig', 'dynam', 'fing', 'trill', 'artic', 'dots', 'beam'].includes(e.cls)) {
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
