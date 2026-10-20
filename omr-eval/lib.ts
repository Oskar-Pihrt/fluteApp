import { readFileSync } from 'node:fs'
import type { Bitmap } from '@/omr/types'

/** Binary PGM (P5), which is what the build scripts write. */
export function readPgm(path: string): Bitmap {
  const buffer = readFileSync(path)
  let offset = 0
  const tokens: string[] = []
  while (tokens.length < 4) {
    // Skip whitespace and comments between header tokens.
    while (offset < buffer.length && /\s/.test(String.fromCharCode(buffer[offset]))) offset++
    if (buffer[offset] === 0x23) {
      while (buffer[offset] !== 0x0a) offset++
      continue
    }
    let token = ''
    while (offset < buffer.length && !/\s/.test(String.fromCharCode(buffer[offset]))) {
      token += String.fromCharCode(buffer[offset++])
    }
    tokens.push(token)
  }
  offset++ // the single whitespace byte after maxval
  const [magic, w, h, max] = tokens
  if (magic !== 'P5' || Number(max) > 255) throw new Error(`${path}: not an 8-bit binary PGM`)
  const width = Number(w)
  const height = Number(h)
  return { data: new Uint8Array(buffer.subarray(offset, offset + width * height)), width, height }
}

/** Edit distance between two sequences. */
export function levenshtein<T>(a: readonly T[], b: readonly T[]): number {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    }
    previous = current
  }
  return previous[b.length]
}

export interface TruthNotehead {
  x: number
  y: number
  width: number
  height: number
  staffIndex: number
  midi: number
  step: number
  log: number
  grace: boolean
  tied: boolean
  /** Rhythm eval pages: the duration by name, and the dots. */
  dur?: string
  dots?: number
  chordLow?: boolean
}

export interface PageTruth {
  /** Pitches are letter and octave only (accidentals unknown) — compare those. */
  naturalOnly?: boolean
  dpi?: number
  width: number
  height: number
  staves: { lines: number[]; x0: number; x1: number }[]
  noteheads: TruthNotehead[]
  /** Rhythm eval pages: the rests too, and a flag that durations are complete. */
  rests?: { x: number; y: number; staffIndex: number; kind: string; measure?: boolean; dots?: number }[]
  rhythm?: boolean
}

const LOG_NAMES = ['whole', 'half', 'quarter', 'eighth', '16th', '32nd']

/** A truth notehead's duration name, from `dur` or LilyPond's `log`. */
export function truthDuration(head: TruthNotehead): string | null {
  if (head.dur) return head.dur
  return LOG_NAMES[head.log] ?? null
}

/**
 * The rhythm a player reads, as tokens: per staff, left to right, a note as
 * pitch:duration:dots and a rest as `r` (rests are compared by presence —
 * a whole-measure rest is drawn the same whatever the measure's length).
 */
export function truthRhythm(truth: PageTruth): string[] {
  const out: string[] = []
  truth.staves.forEach((_, staffIndex) => {
    const items = [
      ...truth.noteheads
        .filter((n) => n.staffIndex === staffIndex && !n.grace && !n.chordLow && n.dur)
        .map((n) => ({ x: n.x, token: `${n.midi}:${n.dur}:${n.dots ?? 0}` })),
      ...(truth.rests ?? []).filter((r) => r.staffIndex === staffIndex).map((r) => ({ x: r.x, token: 'r' })),
    ].sort((a, b) => a.x - b.x)
    out.push(...items.map((i) => i.token))
  })
  return out
}

/**
 * The note sequence a player would read off the page: staff by staff, left to
 * right, a chord reduced to its top note — the same convention the recogniser
 * follows. Grace notes are kept (they are fingered too). `played` additionally
 * drops tied continuations, which sound as one note.
 */
export function truthSequence(truth: PageTruth, { played = false } = {}): TruthNotehead[] {
  const out: TruthNotehead[] = []
  truth.staves.forEach((staff, staffIndex) => {
    const S = (staff.lines[4] - staff.lines[0]) / 4
    const heads = truth.noteheads.filter((n) => n.staffIndex === staffIndex).sort((a, b) => a.x - b.x)
    let group: TruthNotehead[] = []
    const flush = () => {
      if (!group.length) return
      out.push(group.reduce((top, n) => (n.midi > top.midi ? n : top)))
      group = []
    }
    for (const head of heads) {
      if (played && head.tied) continue
      if (group.length && Math.abs(head.x - group[0].x) > S * 0.5) flush()
      group.push(head)
    }
    flush()
  })
  return out
}
