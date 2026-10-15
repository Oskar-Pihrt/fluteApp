#!/usr/bin/env node
/**
 * Build the LilyPond part of the eval set (and, with --split train, training
 * pages from a second engraver).
 *
 * For each piece in corpus.json: download the Mutopia LilyPond source, update
 * its syntax with convert-ly, compile it to SVG with every symbol tagged by
 * omr-annotate.ly, then rasterise each SVG page at several resolutions and
 * write one ground-truth JSON per page. The image is rendered from the very
 * SVG the truth is read from — LilyPond's PDF backend lays text out slightly
 * differently, enough to shift whole systems off their annotations.
 *
 *   node omr-eval/scripts/build-lilypond.mjs [--split eval|train|all] [--only id,id]
 *
 * Needs: LilyPond 2.24 in omr-train/.tools (see omr-eval/README.md), rsvg-convert,
 * python3 with Pillow (PNG → PGM), unzip.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parsePageSvg } from './svg-truth.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LILYPOND_BIN = resolve(ROOT, '../omr-train/.tools/lilypond-2.24.4/bin')
const ANNOTATE = join(ROOT, 'lilypond/omr-annotate.ly')

/** Screenshot-sized, a typical scan, and a high-quality scan. */
const DPIS = [72, 150, 300]
/**
 * Engraving variants. `default` is the piece as its editor set it; `small`
 * forces a 16pt staff, which packs more systems on a page — closer to dense
 * commercial parts than LilyPond's roomy default.
 */
const VARIANTS = {
  default: null,
  small: '#(set-global-staff-size 16)',
}

const args = process.argv.slice(2)
const flag = (name) => {
  const i = args.indexOf(name)
  return i === -1 ? null : args[i + 1]
}
const split = flag('--split') ?? 'eval'
const only = flag('--only')?.split(',')
const outRoot = split === 'train' ? resolve(ROOT, '../omr-train/data/lilypond') : join(ROOT, 'data/lilypond')

const corpus = JSON.parse(readFileSync(join(ROOT, 'corpus.json'), 'utf8'))
const pieces = corpus.pieces.filter(
  (piece) => (split === 'all' || piece.split === split) && (!only || only.includes(piece.id)),
)

function run(cmd, cmdArgs, options = {}) {
  return execFileSync(cmd, cmdArgs, { stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28, ...options })
}

async function download(url, target) {
  if (existsSync(target)) return
  // Mutopia occasionally drops connections under a burst of requests.
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await fetch(url)
      if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`)
      writeFileSync(target, Buffer.from(await response.arrayBuffer()))
      return
    } catch (error) {
      if (attempt >= 4) throw error
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt))
    }
  }
}

/** The .ly to compile: the single file, or the one in a zip that holds the \score. */
function mainSource(dir) {
  const lys = readdirSync(dir, { recursive: true })
    .map(String)
    .filter((file) => file.endsWith('.ly') && !file.includes('__MACOSX') && !/midi/i.test(file))
  const withScore = lys.filter((file) => /\\(score|book)\b/.test(readFileSync(join(dir, file), 'utf8')))
  // Prefer a file that \includes the others — it is the entry point.
  const entry =
    withScore.find((file) => /\\include\s+"(?!english|deutsch|italiano|articulate)/.test(readFileSync(join(dir, file), 'utf8'))) ??
    withScore[0] ??
    lys[0]
  if (!entry) throw new Error(`no .ly in ${dir}`)
  return join(dir, entry)
}

function compile(source, outBase, variant) {
  const settings = [ANNOTATE]
  if (VARIANTS[variant]) {
    const extra = `${outBase}-settings.ly`
    writeFileSync(extra, `${VARIANTS[variant]}\n\\include "${ANNOTATE}"\n`)
    settings[0] = extra
  }
  const common = ['-dno-point-and-click', `-dinclude-settings=${settings[0]}`, '-dmidi-extension=midi']
  const cwd = dirname(source)
  run(join(LILYPOND_BIN, 'lilypond'), [...common, '-dbackend=svg', '-o', `${outBase}`, source], { cwd })
}

for (const piece of pieces) {
  const work = join(outRoot, piece.id)
  const src = join(work, 'src')
  mkdirSync(src, { recursive: true })
  try {
    const file = join(src, basename(piece.ly))
    await download(piece.ly, file)
    if (file.endsWith('.zip')) run('unzip', ['-o', '-q', file, '-d', src])
    const source = mainSource(src)
    try {
      run(join(LILYPOND_BIN, 'convert-ly'), ['-e', '-q', source], { cwd: dirname(source) })
    } catch {
      // Already current, or convert-ly could not help — let the compile decide.
    }
    // Overrides of layout properties that no longer exist abort the whole
    // compile; they only tweak spacing, so drop them.
    const text = readFileSync(source, 'utf8')
    const cleaned = text.replace(/^.*\\override\s+Staff\.VerticalAxisGroup\s*\n?\s*#'minimum-Y-extent.*$/gm, '')
    if (cleaned !== text) writeFileSync(source, cleaned)

    for (const variant of Object.keys(VARIANTS)) {
      const vdir = join(work, variant)
      if (existsSync(join(vdir, 'done'))) continue
      rmSync(vdir, { recursive: true, force: true })
      mkdirSync(vdir, { recursive: true })
      const outBase = join(vdir, 'score')
      compile(source, outBase, variant)

      const svgs = readdirSync(vdir)
        .filter((f) => f.endsWith('.svg'))
        .sort((a, b) => (parseInt(a.match(/(\d+)\.svg$/)?.[1] ?? '0') - parseInt(b.match(/(\d+)\.svg$/)?.[1] ?? '0')))
      for (const [index, svgFile] of svgs.entries()) {
        const page = index + 1
        const truth = parsePageSvg(readFileSync(join(vdir, svgFile), 'utf8'))
        if (!truth.noteheads.length) continue
        for (const dpi of DPIS) {
          const stem = join(vdir, `p${page}-${dpi}`)
          run('rsvg-convert', ['-b', 'white', '--dpi-x', String(dpi), '--dpi-y', String(dpi), '-o', `${stem}.png`, join(vdir, svgFile)])
          run('python3', ['-c', 'import sys; from PIL import Image; Image.open(sys.argv[1]).convert("L").save(sys.argv[2])', `${stem}.png`, `${stem}.pgm`])
          rmSync(`${stem}.png`)
          writeFileSync(`${stem}.json`, JSON.stringify(truth.toPixels(dpi)))
        }
      }
      writeFileSync(join(vdir, 'done'), '')
    }
    console.log(`ok   ${piece.id}`)
  } catch (error) {
    console.log(`FAIL ${piece.id}: ${String(error.stderr ?? error.message).split('\n').filter(Boolean).slice(-3).join(' | ')}`)
  }
}
