/**
 * Score the recogniser against every page with ground truth.
 *
 *   npm run omr:eval -- [--filter regex] [--limit n] [--label name] [--quiet]
 *                       [--detector net|heuristic] [--model public/omr/detector]
 *
 * Pages are any `<name>.pgm` with a sibling `<name>.json` under omr-eval/data
 * and omr-eval/private. The headline number is **sequence accuracy**:
 * 1 − edit distance / truth length, over the note sequence a player reads off
 * the page. It is what decides whether the fingering list is right, so it is
 * what the gates are set on. Notehead recall/precision and pitch accuracy say
 * *why* it is wrong.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Note } from 'tonal'
import { loadNet, type NetManifest } from '@/omr/net'
import { recognise } from '@/omr/recognise'
import { recogniseWithNet } from '@/omr/recogniseNet'
import { levenshtein, type PageTruth, readPgm, truthDuration, truthRhythm, truthSequence } from './lib'

const ROOT = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const flag = (name: string) => {
  const i = args.indexOf(name)
  return i === -1 ? null : args[i + 1]
}
const filter = flag('--filter')
const limit = Number(flag('--limit') ?? Infinity)
const label = flag('--label') ?? 'latest'
const quiet = args.includes('--quiet')
const detector = flag('--detector') ?? 'net'
const modelBase = resolve(process.cwd(), flag('--model') ?? 'public/omr/detector')
const net =
  detector === 'net'
    ? (() => {
        const bin = readFileSync(`${modelBase}.bin`)
        return loadNet(JSON.parse(readFileSync(`${modelBase}.json`, 'utf8')) as NetManifest, bin.buffer.slice(bin.byteOffset, bin.byteOffset + bin.byteLength))
      })()
    : null

function findPages(dir: string): string[] {
  if (!existsSync(dir)) return []
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) out.push(...findPages(path))
    else if (entry.endsWith('.pgm') && existsSync(path.replace(/\.pgm$/, '.json'))) out.push(path)
  }
  return out.sort()
}

interface PageScore {
  page: string
  group: string
  truthLength: number
  detectedLength: number
  edits: number
  playedEdits: number
  playedLength: number
  truthHeads: number
  matchedHeads: number
  detectedHeads: number
  pitchCorrect: number
  /** Pitch errors among matched heads, by kind: semitone, step, octave, other. */
  pitchErrors: Record<string, number>
  ms: number
  warnings: string[]
  /** Rhythm, when the detector reads it: durations and dots of matched heads. */
  durMatched: number
  durCorrect: number
  dotsMatched: number
  dotsCorrect: number
  /** Rhythm eval pages: edit distance over note/rest tokens, and measures. */
  rhythmEdits: number
  rhythmLength: number
  measures: number
  measuresFitting: number
  /** The rhythm path — what the app shows after "read notes and rhythm". */
  rNotes: number
  rMatched: number
  rPitchCorrect: number
  rOctaveErrors: number
}

/** Which bucket a page reports under: source and resolution. */
function groupOf(page: string): string {
  const rel = relative(ROOT, page)
  const dpi = rel.match(/-(\d+)\.pgm$/)?.[1]
  const source = rel.split('/').slice(0, 2).join('/')
  return dpi ? `${source} @${dpi}dpi` : source
}

const pages = findPages(join(ROOT, 'data'))
  .concat(findPages(join(ROOT, 'private')))
  .filter((p) => !filter || new RegExp(filter).test(p))
  .slice(0, limit)

const scores: PageScore[] = []
for (const page of pages) {
  const truth = JSON.parse(readFileSync(page.replace(/\.pgm$/, '.json'), 'utf8')) as PageTruth
  const gray = readPgm(page)
  const started = performance.now()
  // Printed order, ties kept: the truth's `tied` flags let `played` merge them below.
  const { result } = net ? recogniseWithNet(gray, net, { mergeTies: false }) : recognise(gray)
  const ms = performance.now() - started

  const truthSeq = truthSequence(truth)
  const played = truthSequence(truth, { played: true })
  // Pages whose truth has no accidentals are compared on letter and octave.
  const midiOf = (note: string) => {
    const n = Note.get(note)
    return (truth.naturalOnly ? Note.midi(`${n.letter}${n.oct}`) : Note.midi(note)) ?? -1
  }
  const detected = result.notes.map((n) => midiOf(n.note))
  const detectedPlayed = result.notes.filter((n) => !n.tied).map((n) => midiOf(n.note))

  // Location matching: each detection claims the nearest unclaimed truth head
  // within 0.6 staff spaces.
  const S = truth.staves.length ? (truth.staves[0].lines[4] - truth.staves[0].lines[0]) / 4 : 10
  const claimed = new Set<number>()
  let matched = 0
  let pitchCorrect = 0
  const pitchErrors: Record<string, number> = {}
  for (const note of result.notes) {
    const cx = (note.bbox.x + note.bbox.width / 2) * gray.width
    const cy = (note.bbox.y + note.bbox.height / 2) * gray.height
    let best = -1
    let bestDistance = S * 0.6
    truthSeq.forEach((head, index) => {
      if (claimed.has(index)) return
      const distance = Math.hypot(head.x - cx, head.y - cy)
      if (distance < bestDistance) {
        bestDistance = distance
        best = index
      }
    })
    if (best >= 0) {
      claimed.add(best)
      matched++
      const got = midiOf(note.note)
      const want = truthSeq[best].midi
      if (got === want) pitchCorrect++
      else {
        const diff = got - want
        const kind = Math.abs(diff) % 12 === 0 ? 'octave' : Math.abs(diff) <= 2 ? `semitone${diff > 0 ? '+' : '-'}${Math.abs(diff)}` : 'other'
        pitchErrors[kind] = (pitchErrors[kind] ?? 0) + 1
      }
    }
  }

  // ── Rhythm ──────────────────────────────────────────────────────────────
  let durMatched = 0
  let durCorrect = 0
  let dotsMatched = 0
  let dotsCorrect = 0
  let rhythmEdits = 0
  let rhythmLength = 0
  let rMatched = 0
  let rPitchCorrect = 0
  let rOctaveErrors = 0
  const measures = result.rhythm?.measures ?? []
  const rNotes = measures.flatMap((m) => m.events).filter((e) => e.kind === 'note').length
  if (result.rhythm) {
    const taken = new Set<number>()
    for (const event of measures.flatMap((m) => m.events)) {
      if (event.kind !== 'note' || !event.bbox) continue
      const cx = (event.bbox.x + event.bbox.width / 2) * gray.width
      const cy = (event.bbox.y + event.bbox.height / 2) * gray.height
      let best = -1
      let bestDistance = S * 0.6
      truthSeq.forEach((head, index) => {
        if (taken.has(index)) return
        const distance = Math.hypot(head.x - cx, head.y - cy)
        if (distance < bestDistance) {
          bestDistance = distance
          best = index
        }
      })
      if (best < 0) continue
      taken.add(best)
      const head = truthSeq[best]
      rMatched++
      const gotMidi = midiOf(event.pitch ?? '')
      if (gotMidi === head.midi) rPitchCorrect++
      else if (Math.abs(gotMidi - head.midi) % 12 === 0) rOctaveErrors++
      const want = truthDuration(head)
      if (want && !head.grace) {
        durMatched++
        if (want === event.duration.type) durCorrect++
      }
      if (head.dots !== undefined && !head.grace) {
        dotsMatched++
        if (head.dots === event.duration.dots) dotsCorrect++
      }
    }
    if (truth.rhythm) {
      const want = truthRhythm(truth)
      const got = measures
        .flatMap((m) => m.events)
        .map((e) => (e.kind === 'rest' ? 'r' : `${midiOf(e.pitch ?? '')}:${e.duration.type}:${e.duration.dots}`))
      rhythmEdits = levenshtein(got, want)
      rhythmLength = want.length
    }
  }

  const score: PageScore = {
    page: relative(ROOT, page),
    group: groupOf(page),
    truthLength: truthSeq.length,
    detectedLength: detected.length,
    edits: levenshtein(detected, truthSeq.map((n) => n.midi)),
    playedEdits: levenshtein(detectedPlayed, played.map((n) => n.midi)),
    playedLength: played.length,
    truthHeads: truthSeq.length,
    matchedHeads: matched,
    detectedHeads: result.notes.length,
    pitchCorrect,
    pitchErrors,
    ms,
    warnings: result.warnings.map((w) => w.code),
    durMatched,
    durCorrect,
    dotsMatched,
    dotsCorrect,
    rhythmEdits,
    rhythmLength,
    measures: measures.length,
    measuresFitting: measures.filter((m) => m.fill !== 'off').length,
    rNotes,
    rMatched,
    rPitchCorrect,
    rOctaveErrors,
  }
  scores.push(score)
  if (!quiet) {
    const acc = Math.max(0, 1 - score.edits / Math.max(1, score.truthLength))
    console.log(
      `${(acc * 100).toFixed(1).padStart(5)}%  ${String(score.detectedLength).padStart(4)}/${String(score.truthLength).padEnd(4)} ${Math.round(ms).toString().padStart(5)}ms  ${score.page}  ${Object.entries(pitchErrors).map(([k, v]) => `${k}:${v}`).join(' ')}`,
    )
  }
}

interface Summary {
  pages: number
  sequenceAccuracy: number
  playedAccuracy: number
  recall: number
  precision: number
  pitchAccuracy: number
  meanMs: number
  pagesAbove95: number
  durationAccuracy: number | null
  dotsAccuracy: number | null
  rhythmAccuracy: number | null
  measuresFitting: number | null
  /** Rhythm path: pitch (octave included) of the notes found, how many found notes are real, octave slips. */
  rhythmPitch: number | null
  rhythmPrecision: number | null
  rhythmRecall: number | null
  octaveErrors: number
}

function summarise(list: PageScore[]): Summary {
  const sum = (f: (s: PageScore) => number) => list.reduce((acc, s) => acc + f(s), 0)
  const truth = sum((s) => s.truthLength)
  return {
    pages: list.length,
    sequenceAccuracy: Math.max(0, 1 - sum((s) => s.edits) / Math.max(1, truth)),
    playedAccuracy: Math.max(0, 1 - sum((s) => s.playedEdits) / Math.max(1, sum((s) => s.playedLength))),
    recall: sum((s) => s.matchedHeads) / Math.max(1, sum((s) => s.truthHeads)),
    precision: sum((s) => s.matchedHeads) / Math.max(1, sum((s) => s.detectedHeads)),
    pitchAccuracy: sum((s) => s.pitchCorrect) / Math.max(1, sum((s) => s.matchedHeads)),
    meanMs: sum((s) => s.ms) / Math.max(1, list.length),
    pagesAbove95: list.filter((s) => 1 - s.edits / Math.max(1, s.truthLength) >= 0.95).length,
    durationAccuracy: sum((s) => s.durMatched) ? sum((s) => s.durCorrect) / sum((s) => s.durMatched) : null,
    dotsAccuracy: sum((s) => s.dotsMatched) ? sum((s) => s.dotsCorrect) / sum((s) => s.dotsMatched) : null,
    rhythmAccuracy: sum((s) => s.rhythmLength) ? Math.max(0, 1 - sum((s) => s.rhythmEdits) / sum((s) => s.rhythmLength)) : null,
    measuresFitting: sum((s) => s.measures) ? sum((s) => s.measuresFitting) / sum((s) => s.measures) : null,
    rhythmPitch: sum((s) => s.rMatched) ? sum((s) => s.rPitchCorrect) / sum((s) => s.rMatched) : null,
    rhythmPrecision: sum((s) => s.rNotes) ? sum((s) => s.rMatched) / sum((s) => s.rNotes) : null,
    rhythmRecall: sum((s) => s.rNotes) ? sum((s) => s.rMatched) / Math.max(1, truth) : null,
    octaveErrors: sum((s) => s.rOctaveErrors),
  }
}

const groups = [...new Set(scores.map((s) => s.group))].sort()
const summary: Record<string, Summary> = { all: summarise(scores) }
for (const group of groups) summary[group] = summarise(scores.filter((s) => s.group === group))

const pct = (v: number) => `${(v * 100).toFixed(1)}%`.padStart(7)
const opt = (v: number | null) => (v === null ? '      –' : pct(v))
console.log('\n' + 'group'.padEnd(34) + 'pages   seq.acc  played   recall  precis.  pitch   ≥95%    ms   dur.   dots  rhythm  bars  r.pitch r.prec r.recall 8va')
for (const [name, s] of Object.entries(summary)) {
  console.log(
    name.padEnd(34) +
      String(s.pages).padStart(5) +
      pct(s.sequenceAccuracy) +
      pct(s.playedAccuracy) +
      pct(s.recall) +
      pct(s.precision) +
      pct(s.pitchAccuracy) +
      `${s.pagesAbove95}/${s.pages}`.padStart(8) +
      Math.round(s.meanMs).toString().padStart(6) +
      opt(s.durationAccuracy) +
      opt(s.dotsAccuracy) +
      opt(s.rhythmAccuracy) +
      opt(s.measuresFitting) +
      opt(s.rhythmPitch) +
      opt(s.rhythmPrecision) +
      opt(s.rhythmRecall) +
      String(s.octaveErrors).padStart(5),
  )
}

const reportPath = resolve(ROOT, 'reports', `${label}.json`)
writeFileSync(reportPath, JSON.stringify({ label, date: new Date().toISOString(), summary, pages: scores }, null, 1))
console.log(`\nreport: ${relative(process.cwd(), reportPath)}`)
