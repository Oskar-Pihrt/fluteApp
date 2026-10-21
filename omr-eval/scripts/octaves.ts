/**
 * Where a page's octave slips are: each wrong-octave note with its staff and
 * position, beside the ottava marks the detector found.
 *
 *   npx tsx --tsconfig omr-eval/tsconfig.json omr-eval/scripts/octaves.ts page.pgm
 */
import { readFileSync } from 'node:fs'
import { Note } from 'tonal'
import { loadNet, type NetManifest } from '@/omr/net'
import { recogniseWithNet } from '@/omr/recogniseNet'
import { type PageTruth, readPgm, truthSequence } from '../lib'

const page = process.argv[2]
const model = process.env.MODEL ?? 'public/omr/detector'
const bin = readFileSync(`${model}.bin`)
const net = loadNet(JSON.parse(readFileSync(`${model}.json`, 'utf8')) as NetManifest, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength))
const truth = JSON.parse(readFileSync(page.replace(/\.pgm$/, '.json'), 'utf8')) as PageTruth
const gray = readPgm(page)
const { result } = recogniseWithNet(gray, net, { mergeTies: false })
const heads = truthSequence(truth)
const S = (truth.staves[0].lines[4] - truth.staves[0].lines[0]) / 4
const events = result.rhythm?.measures.flatMap((m) => m.events) ?? []
const rows: string[] = []
for (const e of events) {
  if (e.kind !== 'note' || !e.bbox) continue
  const cx = (e.bbox.x + e.bbox.width / 2) * gray.width
  const cy = (e.bbox.y + e.bbox.height / 2) * gray.height
  const head = heads.find((h) => Math.hypot(h.x - cx, h.y - cy) < S * 0.6)
  if (!head) continue
  const got = Note.midi(e.pitch ?? '') ?? -1
  if (got !== head.midi) rows.push(`staff ${head.staffIndex} x=${Math.round(cx)} got ${e.pitch} (${got}) want ${head.midi} diff ${got - head.midi}`)
}
console.log(rows.join('\n'))
console.log('ottava marks:')
for (const o of result.diagnostics.ottavas ?? []) {
  const y = o.y * gray.height
  const staff = truth.staves.findIndex((s) => y > s.lines[0] - S * 8 && y < s.lines[4] + S * 8)
  console.log(`  ${o.cls} x=${Math.round(o.x * gray.width)} y=${Math.round(y)} near staff ${staff}`)
}
