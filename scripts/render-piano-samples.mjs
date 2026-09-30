#!/usr/bin/env node
/**
 * Renders the ear trainer's piano samples from a SoundFont.
 *
 * The UprightPianoKW SoundFont is 57 MB — far too much to ship in a PWA or
 * APK — but the ear trainer only needs one short note per semitone over
 * C3–C6. This renders each of those once through fluidsynth and encodes it as
 * a small mono AAC file, which every target (Chrome, Android WebView, Safari)
 * can decode. Run it by hand whenever the range or sound changes; the output
 * in public/samples/piano is committed, the SoundFont is not.
 *
 *   npm run samples:piano -- /path/to/UprightPianoKW-20220221.sf2
 *
 * Needs `fluidsynth` and `ffmpeg` on PATH.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** C3–C6, matching RANGE in src/domain/earTraining.ts. */
const LOW = 48
const HIGH = 84
const VELOCITY = 90
/** How long the key is held, and the total length of the rendered file. */
const HOLD_SECONDS = 2
const LENGTH_SECONDS = 2.5
const FADE_SECONDS = 0.4

const sf2 = process.argv[2]
if (!sf2 || !existsSync(sf2)) {
  console.error('Usage: npm run samples:piano -- <path to .sf2>')
  process.exit(1)
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public/samples/piano')
mkdirSync(outDir, { recursive: true })
const work = mkdtempSync(join(tmpdir(), 'piano-samples-'))

/** Variable-length quantity, as used for MIDI delta times. */
function vlq(value) {
  const bytes = [value & 0x7f]
  while ((value >>= 7)) bytes.unshift((value & 0x7f) | 0x80)
  return bytes
}

/**
 * A format-0 MIDI file holding one note. 480 ticks per quarter at the default
 * 120 bpm is 960 ticks per second.
 */
function singleNoteMidi(midi) {
  const holdTicks = Math.round(HOLD_SECONDS * 960)
  const events = [
    0x00, 0x90, midi, VELOCITY,
    ...vlq(holdTicks), 0x80, midi, 0x40,
    // Leave the release tail room before end-of-track, or fluidsynth cuts it.
    ...vlq(960), 0xff, 0x2f, 0x00,
  ]
  const header = [0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, 0x01, 0xe0]
  const len = events.length
  const track = [0x4d, 0x54, 0x72, 0x6b, (len >>> 24) & 0xff, (len >>> 16) & 0xff, (len >>> 8) & 0xff, len & 0xff]
  return Buffer.from([...header, ...track, ...events])
}

try {
  for (let midi = LOW; midi <= HIGH; midi++) {
    const mid = join(work, `${midi}.mid`)
    const wav = join(work, `${midi}.wav`)
    writeFileSync(mid, singleNoteMidi(midi))
    execFileSync('fluidsynth', ['-ni', '-q', '-g', '1.0', '-r', '44100', '-F', wav, sf2, mid], { stdio: 'ignore' })
    execFileSync(
      'ffmpeg',
      [
        '-y', '-loglevel', 'error', '-i', wav,
        '-af',
        `atrim=0:${LENGTH_SECONDS},afade=t=out:st=${LENGTH_SECONDS - FADE_SECONDS}:d=${FADE_SECONDS},loudnorm=I=-18:TP=-2`,
        '-ac', '1', '-ar', '44100', '-c:a', 'aac', '-b:a', '96k',
        join(outDir, `${midi}.m4a`),
      ],
      { stdio: 'inherit' },
    )
    process.stdout.write(`${midi} `)
  }
  process.stdout.write('\n')

  // CC0, but keep the credit and licence next to the files that came from it.
  const sfDir = dirname(sf2)
  const readme = join(sfDir, 'readme.txt')
  const cc0 = join(sfDir, 'cc0.txt')
  const parts = [existsSync(readme) ? readFileSync(readme, 'utf8') : '', existsSync(cc0) ? readFileSync(cc0, 'utf8') : '']
  writeFileSync(
    join(outDir, 'LICENSE.txt'),
    `Rendered from UprightPianoKW-20220221.sf2 (FreePats) by scripts/render-piano-samples.mjs.\n\n${parts.join('\n\n')}`,
  )
} finally {
  rmSync(work, { recursive: true, force: true })
}
