#!/usr/bin/env node
/**
 * Eval page + ground truth from a MuseScore SVG export.
 *
 *   node omr-eval/scripts/musescore-truth.mjs part.svg omr-eval/private/name [width=1800]
 *
 * MuseScore merges every element of a kind into one <path class="Note"> with a
 * subpath per notehead, and the five lines of each staff into class
 * "StaffLines". So noteheads and staves come out exactly, which is real
 * hand-engraved-looking music with truth for free. Pitch is taken from the
 * staff position alone — accidentals and key signatures are not in the file
 * as data — so the page is marked `naturalOnly` and the eval compares letter
 * and octave, which is what the staff-reading half of the recogniser decides.
 */
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathPoints } from '../../omr-train/gen/verovio-boxes.mjs'

const [svgPath, outBase, widthArg] = process.argv.slice(2)
const width = Number(widthArg ?? 1800)
const svg = readFileSync(svgPath, 'utf8')
const svgWidth = Number(svg.match(/<svg[^>]*\swidth="([\d.]+)"/)[1])
const svgHeight = Number(svg.match(/<svg[^>]*\sheight="([\d.]+)"/)[1])
const k = width / svgWidth

// Staves: horizontal segments "M x y H x2", five to a staff, in order.
const lines = []
for (const m of svg.matchAll(/<path class="StaffLines"[^>]*\sd="([^"]*)"/g)) {
  for (const seg of m[1].matchAll(/M([-\d.]+) ([-\d.]+)H([-\d.]+)/g)) lines.push({ x0: +seg[1], y: +seg[2], x1: +seg[3] })
}
const staves = []
for (let i = 0; i + 4 < lines.length; i += 5) {
  const group = lines.slice(i, i + 5)
  staves.push({ lines: group.map((l) => l.y), x0: Math.min(...group.map((l) => l.x0)), x1: Math.max(...group.map((l) => l.x1)) })
}

// Noteheads: one subpath per head, in every Note path (filled and hollow).
const heads = []
for (const m of svg.matchAll(/<path class="Note"[^>]*\sd="([^"]*)"/g)) {
  for (const sub of m[1].split(/(?=M)/).filter(Boolean)) {
    const pts = pathPoints(sub)
    if (!pts.length) continue
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    heads.push({ x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2, width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) })
  }
}

const LETTER_SEMITONES = [0, 2, 4, 5, 7, 9, 11] // C D E F G A B
const noteheads = []
for (const head of heads) {
  let best = -1
  let distance = Infinity
  staves.forEach((st, i) => {
    const d = Math.abs(head.y - st.lines[2])
    if (d < distance) [best, distance] = [i, d]
  })
  if (best < 0) continue
  const st = staves[best]
  const S = (st.lines[4] - st.lines[0]) / 4
  if (distance > S * 8) continue
  const relative = Math.round((st.lines[4] - head.y) / (S / 2)) // 0 = E4
  const diatonic = relative + 2 + 4 * 7 // C-based index with C4 = 28
  const octave = Math.floor(diatonic / 7)
  noteheads.push({
    ...head,
    staffIndex: best,
    step: diatonic,
    midi: 12 * (octave + 1) + LETTER_SEMITONES[((diatonic % 7) + 7) % 7],
    grace: head.width < S * 0.8,
    tied: false,
    log: 2,
  })
}

mkdirSync(dirname(resolve(outBase)), { recursive: true })
const png = `${outBase}.png`
execFileSync('rsvg-convert', ['-b', 'white', '-w', String(width), '-o', png, svgPath])
execFileSync('python3', ['-c', 'import sys; from PIL import Image; Image.open(sys.argv[1]).convert("L").save(sys.argv[2])', png, `${outBase}.pgm`])
rmSync(png)
const s = (v) => v * k
writeFileSync(
  `${outBase}.json`,
  JSON.stringify({
    naturalOnly: true,
    width,
    height: Math.round(svgHeight * k),
    staves: staves.map((st) => ({ lines: st.lines.map(s), x0: s(st.x0), x1: s(st.x1) })),
    noteheads: noteheads.map((n) => ({ ...n, x: s(n.x), y: s(n.y), width: s(n.width), height: s(n.height) })),
  }),
)
console.log(`${outBase}: ${staves.length} staves, ${noteheads.length} noteheads`)
