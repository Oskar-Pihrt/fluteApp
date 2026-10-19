#!/usr/bin/env node
/**
 * Random monophonic parts engraved by LilyPond — the second synthetic engraver.
 *
 *   node lilypond-random.mjs --from 0 --count 300 [--out ../data/lilyrand]
 *
 * Verovio pages teach the SMuFL fonts; these teach Emmentaler and LilyPond's
 * own conventions (its ottava "8" with a dashed line, its beaming, its
 * accidental placement), which is closer to traditional published engraving.
 * LilyPond does the musical bookkeeping itself — beams, accidentals, line
 * breaks — so the generator only has to choose notes. Ground truth comes from
 * the same SVG tagging as the eval set (omr-eval/lilypond/omr-annotate.ly).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { rng } from './melody.mjs'
import { parsePageSvg } from '../../omr-eval/scripts/svg-truth.mjs'

const args = process.argv.slice(2)
const flag = (name, fallback) => {
  const i = args.indexOf(name)
  return i === -1 ? fallback : args[i + 1]
}
const from = Number(flag('--from', 0))
const count = Number(flag('--count', 10))
const out = resolve(flag('--out', new URL('../data/lilyrand', import.meta.url).pathname))
const LILYPOND = resolve(new URL('../.tools/lilypond-2.24.4/bin/lilypond', import.meta.url).pathname)
const ANNOTATE = resolve(new URL('../../omr-eval/lilypond/omr-annotate.ly', import.meta.url).pathname)
mkdirSync(out, { recursive: true })

const NAMES = ['c', 'd', 'e', 'f', 'g', 'a', 'b']
const SHARP_ORDER = ['f', 'c', 'g', 'd', 'a', 'e', 'b']
const FLAT_ORDER = ['b', 'e', 'a', 'd', 'g', 'c', 'f']
const MAJOR_KEYS = { 0: 'c', 1: 'g', 2: 'd', 3: 'a', 4: 'e', 5: 'b', 6: 'fis', '-1': 'f', '-2': 'bes', '-3': 'ees', '-4': 'aes', '-5': 'des', '-6': 'ges' }
const DYNAMICS = ['\\pp', '\\p', '\\mp', '\\mf', '\\f', '\\ff', '\\sfz', '\\fp']
const ARTICULATIONS = ['-.', '->', '--', '-^', '-!']
const TEXTS = ['dolce', 'cresc.', 'dim.', 'espress.', 'rit.', 'a tempo', 'legato', 'leggiero']

/** LilyPond absolute pitch name for a diatonic index and alteration. */
function pitchName(d7, alteration) {
  const step = NAMES[((d7 % 7) + 7) % 7]
  const octave = Math.floor(d7 / 7) // 0 = the octave of middle C's octave below c'
  const accidental = alteration === 1 ? 'is' : alteration === -1 ? (step === 'e' || step === 'a' ? 's' : 'es') : ''
  const marks = octave >= 4 ? "'".repeat(octave - 3) : ','.repeat(3 - octave)
  return `${step}${accidental}${marks}`
}

function piece(seed) {
  const r = rng(seed * 104729 + 7)
  const fifths = r.int(-6, 6)
  const alter = {}
  if (fifths > 0) for (const s of SHARP_ORDER.slice(0, fifths)) alter[s] = 1
  if (fifths < 0) for (const s of FLAT_ORDER.slice(0, -fifths)) alter[s] = -1
  const meter = r.pick([[4, 4], [3, 4], [2, 4], [6, 8], [2, 2], [3, 8], [12, 8], [9, 8]])
  const density = r.next()
  const features = {
    ottava: r.chance(0.5) ? 0.3 : 0,
    grace: r.chance(0.4) ? 0.06 : 0,
    ties: r.chance(0.6) ? 0.12 : 0,
    slurs: r.chance(0.6) ? 0.3 : 0,
    dyn: r.chance(0.6) ? 0.15 : 0,
    art: r.chance(0.6) ? 0.25 : 0,
    text: r.chance(0.4) ? 0.06 : 0,
    chromatic: r.chance(0.7) ? r.next() * 0.2 : 0.02,
    rests: r.next() * 0.2,
    tuplets: r.chance(0.3),
    trill: r.chance(0.25) ? 0.05 : 0,
  }
  const top = r.int(80, 96)
  const bottom = r.int(58, 66)
  let d7 = 7 * 5 + r.int(0, 4) // around c''
  const bars = r.int(24, 64)
  const unit = meter[1]
  const barLength = meter[0] * (16 / unit) // in sixteenths
  const tokens = []
  let ottava = 0
  let slur = 0
  let tieNext = false
  let lastAlteration = 0

  for (let bar = 0; bar < bars; bar++) {
    let filled = 0
    while (filled < barLength) {
      const left = barLength - filled
      // Pick a duration that fits: dense pieces favour sixteenths.
      const options = [16, 8, 4, 2, 1, 12, 6, 3].filter((d) => d <= left)
      const weights = options.map((d) => (d === 1 ? 0.3 + density * 3 : d === 2 ? 2 : d === 4 ? 2.5 - density * 2 : d >= 8 ? 0.4 : 0.6))
      let dur = r.weighted(options.map((d, i) => [d, weights[i]]))
      // Triplets of eighths in place of a quarter.
      if (features.tuplets && dur === 4 && r.chance(0.2)) {
        const notes = []
        for (let k = 0; k < 3; k++) {
          d7 += r.pick([-1, 1, -2, 2])
          notes.push(`${pitchName(d7, alter[NAMES[((d7 % 7) + 7) % 7]] ?? 0)}8`)
        }
        tokens.push(`\\tuplet 3/2 { ${notes.join(' ')} }`)
        filled += 4
        continue
      }
      const lily = { 16: '1', 12: '2.', 8: '2', 6: '4.', 4: '4', 3: '8.', 2: '8', 1: '16' }[dur]
      if (r.chance(features.rests) && !tieNext) {
        tokens.push(`r${lily}`)
        filled += dur
        continue
      }
      if (!tieNext) {
        d7 += r.weighted([[-2, 1], [-1, 4], [1, 4], [2, 1], [r.int(-6, 6), 0.5]])
        const midi = 12 * (Math.floor(d7 / 7) + 1) + [0, 2, 4, 5, 7, 9, 11][((d7 % 7) + 7) % 7]
        if (midi > top) d7 -= r.int(2, 5)
        if (midi < bottom) d7 += r.int(2, 5)
      }
      const step = NAMES[((d7 % 7) + 7) % 7]
      let alteration = tieNext ? lastAlteration : (alter[step] ?? 0)
      if (!tieNext && r.chance(features.chromatic)) alteration = r.pick([-1, 0, 1])
      lastAlteration = alteration
      const midi = 12 * (Math.floor(d7 / 7) + 1) + [0, 2, 4, 5, 7, 9, 11][((d7 % 7) + 7) % 7]

      let prefix = ''
      if (!ottava && features.ottava && midi > 84 && r.chance(features.ottava)) {
        ottava = r.int(3, 12)
        prefix += '\\ottava #1 '
      }
      if (features.grace && r.chance(features.grace) && !tieNext) {
        prefix += `\\grace ${pitchName(d7 + 1, alter[NAMES[(((d7 + 1) % 7) + 7) % 7]] ?? 0)}16 `
      }
      let suffix = ''
      if (r.chance(features.art)) suffix += r.pick(ARTICULATIONS)
      if (r.chance(features.dyn)) suffix += r.pick(DYNAMICS)
      if (r.chance(features.text)) suffix += `${r.pick(['^', '_'])}\\markup { \\italic "${r.pick(TEXTS)}" }`
      if (r.chance(features.trill)) suffix += '\\trill'
      if (slur === 0 && r.chance(features.slurs)) {
        suffix += '('
        slur = r.int(1, 5)
      } else if (slur > 0 && --slur === 0) suffix += ')'
      tieNext = r.chance(features.ties) && filled + dur < barLength
      if (tieNext) suffix += '~'
      tokens.push(`${prefix}${pitchName(d7, alteration)}${lily}${suffix}`)
      if (ottava > 0 && --ottava === 0) tokens.push('\\ottava #0')
      filled += dur
    }
    tokens.push('|')
    if (bar % 8 === 7 && r.chance(0.2)) tokens.push(r.pick(['\\bar "||"', '\\bar ":|."', '\\bar ".|:"']))
  }
  if (ottava > 0) tokens.push('\\ottava #0')

  const staffSize = r.pick([14, 15, 16, 17, 18, 19, 20, 22])
  const music = tokens.join(' ').replace(/\( \)/g, '')
  return `\\version "2.24.0"
#(set-global-staff-size ${staffSize})
\\paper { ${r.chance(0.5) ? '#(set-paper-size "a4")' : '#(set-paper-size "letter")'} indent = ${r.int(0, 15)}\\mm ragged-last-bottom = ##t }
\\header { title = "${r.pick(['Etude', 'Sonata', 'Study', 'Air', 'Caprice', 'Sicilienne', 'Allegro'])} ${r.int(1, 40)}" composer = "${r.pick(['A. Composer', 'K. Novák', 'H. Weber', 'L. Dubois'])}" tagline = ##f }
\\score {
  \\new Staff \\with { ${r.chance(0.3) ? 'instrumentName = "Fl."' : ''} } {
    \\clef treble \\key ${MAJOR_KEYS[fifths]} \\major \\time ${meter[0]}/${meter[1]}
    ${r.chance(0.6) ? (r.chance(0.5) ? `\\tempo ${r.pick(['4', '8', '2', '4.'])} = ${r.int(60, 190)}` : `\\tempo "${r.pick(['Allegro', 'Andante', 'Moderato', 'Adagio', 'Presto'])}"`) : ''}
    ${music}
    \\bar "|."
  }
  \\layout { }
}
`
}

for (let seed = from; seed < from + count; seed++) {
  const name = String(seed).padStart(6, '0')
  if (existsSync(join(out, `${name}-p1.json`))) continue
  const work = join(out, `_${name}`)
  mkdirSync(work, { recursive: true })
  try {
    writeFileSync(join(work, 'score.ly'), piece(seed))
    execFileSync(LILYPOND, ['-dno-point-and-click', `-dinclude-settings=${ANNOTATE}`, '-dbackend=svg', '-o', 'score', 'score.ly'], { cwd: work, stdio: 'ignore', timeout: 120000 })
    const svgs = readdirSync(work).filter((f) => f.endsWith('.svg')).sort()
    const r = rng(seed)
    for (const [i, svgFile] of svgs.slice(0, 2).entries()) {
      const truth = parsePageSvg(readFileSync(join(work, svgFile), 'utf8'))
      if (!truth.noteheads.length) continue
      // A random resolution: with staff sizes of 14–22 pt this spreads the
      // staff space over roughly 6–18 px.
      const dpi = r.int(90, 260)
      const stem = join(out, `${name}-p${i + 1}`)
      execFileSync('rsvg-convert', ['-b', 'white', '--dpi-x', String(dpi), '--dpi-y', String(dpi), '-o', `${stem}.png`, join(work, svgFile)])
      writeFileSync(`${stem}.json`, JSON.stringify(truth.toPixels(dpi)))
    }
  } catch (error) {
    console.log(`skip ${seed}: ${String(error.message).slice(0, 120)}`)
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
  if (seed % 20 === 0) console.log(`seed ${seed}`)
}
