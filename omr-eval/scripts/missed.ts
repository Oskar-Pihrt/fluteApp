/** Truth noteheads a page's reading missed, with their place relative to the staff. */
import { readFileSync } from 'node:fs'
import { loadNet, type NetManifest } from '@/omr/net'
import { recogniseWithNet } from '@/omr/recogniseNet'
import { type PageTruth, readPgm, truthSequence } from '../lib'

const page = process.argv[2]
const bin = readFileSync('public/omr/detector.bin')
const net = loadNet(JSON.parse(readFileSync('public/omr/detector.json', 'utf8')) as NetManifest, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength))
const truth = JSON.parse(readFileSync(page.replace(/\.pgm$/, '.json'), 'utf8')) as PageTruth
const gray = readPgm(page)
const { result } = recogniseWithNet(gray, net, { mergeTies: false })
const S = (truth.staves[0].lines[4] - truth.staves[0].lines[0]) / 4
for (const h of truthSequence(truth)) {
  const found = result.notes.some((n) => Math.hypot((n.bbox.x + n.bbox.width / 2) * gray.width - h.x, (n.bbox.y + n.bbox.height / 2) * gray.height - h.y) < S * 0.6)
  if (found) continue
  const st = truth.staves[h.staffIndex]
  const steps = Math.round(((st.lines[4] - h.y) / (S / 2)) * 10) / 10
  console.log(`missed x=${Math.round(h.x)} y=${Math.round(h.y)} staff ${h.staffIndex} steps-from-bottom ${steps} midi ${h.midi} grace ${h.grace}`)
}
