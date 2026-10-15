import type { Detection } from './detector'
import type { AccidentalGlyph, Barline, ClefRegion } from './glyphs'
import { detectKeySignature } from './glyphs'
import { derivePitches } from './pitch'
import { relativeAt, staffForY, yAtRelative } from './staves'
import type { KeySignature, Notehead, PrintedAccidental, RecognisedNote, Staff, StaffScale } from './types'

/**
 * Detections → notes.
 *
 * The network says *what* is where; this decides what it means musically, using
 * the same pitch logic as the heuristic recogniser (`derivePitches`): staff
 * position, then key signature, then accidentals in force in the measure. On
 * top of that it handles what the heuristics never could — ottava lines, tie
 * continuations and grace notes — because the network detects them.
 */

const ACCIDENTAL_KIND: Record<string, PrintedAccidental> = {
  sharp: '#',
  flat: 'b',
  natural: 'n',
  dsharp: 'x',
  dflat: 'bb',
}

export interface AssembleOptions {
  /** Merge a tied continuation into the note it continues. Default true. */
  mergeTies?: boolean
  /** Keep grace notes in the sequence. Default true — they are fingered too. */
  includeGrace?: boolean
}

export interface Assembled {
  notes: RecognisedNote[]
  key: KeySignature
  barlines: Barline[]
  /** Noteheads found before chords were reduced. */
  noteheadCount: number
  chordCount: number
}

export function assemble(detections: Detection[], staves: Staff[], scale: StaffScale, options: AssembleOptions = {}): Assembled {
  const mergeTies = options.mergeTies ?? true
  const includeGrace = options.includeGrace ?? true
  const S = scale.spaceHeight

  const onStaff = (d: Detection) => staffForY(staves, d.y)

  // ── Clefs: where each staff's music can start ───────────────────────────
  const clefs: ClefRegion[] = staves.map((staff) => {
    const clef = detections
      .filter((d) => d.cls === 'clef' && onStaff(d)?.index === staff.index && d.x < staff.x0 + S * 6)
      .sort((a, b) => a.x - b.x)[0]
    return { staffIndex: staff.index, endX: clef ? clef.x + S * 1.4 : staff.x0 }
  })

  // ── Noteheads ────────────────────────────────────────────────────────────
  const heads: (Notehead & { grace: boolean; score: number })[] = []
  for (const d of detections) {
    if (d.cls !== 'head_filled' && d.cls !== 'head_hollow' && d.cls !== 'head_grace') continue
    if (d.cls === 'head_grace' && !includeGrace) continue
    const staff = onStaff(d)
    if (!staff) continue
    if (d.x < clefs[staff.index].endX) continue
    const exact = relativeAt(staff, d.y)
    const relative = Math.round(exact)
    const residual = Math.abs(d.y - yAtRelative(staff, relative)) / (staff.spaceHeight / 2)
    heads.push({
      x: d.x,
      y: d.y,
      bbox: { x: d.x - S * 0.62, y: d.y - S * 0.46, width: S * 1.24, height: S * 0.92 },
      filled: d.cls !== 'head_hollow',
      staffIndex: staff.index,
      relative,
      // The network's own score, tempered by how well the head sits on a line
      // or space — a misplaced detection is the likeliest pitch error.
      confidence: d.score * Math.max(0.3, 1 - Math.max(0, residual - 0.25)),
      grace: d.cls === 'head_grace',
      score: d.score,
    })
  }
  // Two classes can fire on one head (a grace note read as both); keep the stronger.
  heads.sort((a, b) => b.score - a.score)
  const kept: typeof heads = []
  for (const head of heads) {
    if (kept.some((k) => k.staffIndex === head.staffIndex && Math.abs(k.x - head.x) < S * 0.5 && Math.abs(k.y - head.y) < S * 0.4)) continue
    kept.push(head)
  }
  kept.sort((a, b) => a.staffIndex - b.staffIndex || a.x - b.x || a.y - b.y)

  // ── Chords: keep the top note of noteheads sharing an x ─────────────────
  const monophonic: typeof kept = []
  let chordCount = 0
  for (const head of kept) {
    const last = monophonic[monophonic.length - 1]
    if (last && last.staffIndex === head.staffIndex && Math.abs(last.x - head.x) < S * 0.45) {
      chordCount++
      if (head.relative > last.relative) monophonic[monophonic.length - 1] = head
      continue
    }
    monophonic.push(head)
  }

  // ── Accidentals and barlines ─────────────────────────────────────────────
  const accidentals: AccidentalGlyph[] = []
  for (const d of detections) {
    const kind = ACCIDENTAL_KIND[d.cls]
    if (!kind) continue
    const staff = onStaff(d)
    if (!staff) continue
    accidentals.push({
      x: d.x,
      y: d.y,
      kind,
      uncertain: d.score < 0.5,
      staffIndex: staff.index,
      relative: Math.round(relativeAt(staff, d.y)),
      right: d.x + S * 0.45,
    })
  }
  accidentals.sort((a, b) => a.staffIndex - b.staffIndex || a.x - b.x)

  const barlines: Barline[] = detections
    .filter((d) => d.cls === 'barline')
    .map((d) => ({ x: d.x, staffIndex: onStaff(d)?.index ?? -1 }))
    .filter((b) => b.staffIndex >= 0)
    .sort((a, b) => a.staffIndex - b.staffIndex || a.x - b.x)

  // ── Key signature, read per staff and reconciled ─────────────────────────
  const contentStartX: number[] = []
  const keys: KeySignature[] = []
  for (const staff of staves) {
    const first = monophonic.find((h) => h.staffIndex === staff.index)
    let candidates = accidentals.filter((a) => a.staffIndex === staff.index)
    // An accidental hugging the first note, on its line or space, is that
    // note's own — not the last glyph of the key signature.
    if (first) {
      candidates = candidates.filter((a) => !(a.x < first.x && first.x - a.x < S * 1.9 && Math.abs(a.relative - first.relative) <= 0))
    }
    const { key, endX } = detectKeySignature(candidates, clefs, first?.x ?? null, staff.index)
    keys.push(key)
    contentStartX[staff.index] = Math.max(clefs[staff.index].endX, endX)
  }
  const key = majorityKey(keys)

  // ── Pitches ──────────────────────────────────────────────────────────────
  const shifted = applyOttavas(monophonic, detections, staves, S)
  const notes = derivePitches({ noteheads: shifted, accidentals, barlines, key, scale, contentStartX })
  shifted.forEach((head, i) => {
    notes[i].grace = (head as { grace?: boolean }).grace
    notes[i].octaveShift = (head as { octaveShift?: number }).octaveShift
  })

  // ── Ties ─────────────────────────────────────────────────────────────────
  const tieMarks = detections.filter((d) => d.cls === 'tied_head')
  const out: RecognisedNote[] = []
  shifted.forEach((head, i) => {
    const note = notes[i]
    const tied = tieMarks.some((t) => Math.abs(t.x - head.x) < S * 0.6 && Math.abs(t.y - head.y) < S * 0.5)
    const previous = out[out.length - 1]
    if (tied && previous && previous.note === note.note) {
      note.tied = true
      if (mergeTies) return
    }
    out.push(note)
  })

  return { notes: out, key, barlines, noteheadCount: kept.length, chordCount }
}

/** The key most staves agree on; a single misread staff should not win. */
function majorityKey(keys: KeySignature[]): KeySignature {
  const counts = new Map<string, { key: KeySignature; n: number }>()
  for (const key of keys) {
    const id = key.count === 0 ? '0' : `${key.count}${key.kind}`
    const entry = counts.get(id) ?? { key, n: 0 }
    entry.n++
    counts.set(id, entry)
  }
  let best: { key: KeySignature; n: number } | null = null
  for (const entry of counts.values()) if (!best || entry.n > best.n) best = entry
  return best?.key ?? { kind: '#', count: 0 }
}

/**
 * Raise (or lower) every notehead under an ottava line by an octave.
 *
 * Starts and ends are matched left to right on each staff; a line still open
 * at the end of a staff carries on to the next one, as engraving does at a
 * system break. Below-the-staff lines are 8vb.
 */
function applyOttavas<T extends Notehead>(heads: T[], detections: Detection[], staves: Staff[], S: number): (T & { octaveShift?: number })[] {
  const spans: { staffIndex: number; x0: number; x1: number; shift: number }[] = []
  let open: { shift: number } | null = null
  for (const staff of staves) {
    const marks = detections
      .filter((d) => (d.cls === 'ottava_start' || d.cls === 'ottava_end') && staffForY(staves, d.y)?.index === staff.index)
      .sort((a, b) => a.x - b.x)
    let x0 = open ? staff.x0 : null
    let shift: number = open?.shift ?? 0
    for (const mark of marks) {
      if (mark.cls === 'ottava_start') {
        x0 = mark.x - S * 0.6
        shift = mark.y > staff.lines[4] ? -7 : 7
      } else if (x0 != null) {
        spans.push({ staffIndex: staff.index, x0, x1: mark.x + S * 0.3, shift })
        x0 = null
      }
    }
    if (x0 != null) {
      spans.push({ staffIndex: staff.index, x0, x1: staff.x1 + 1, shift })
      open = { shift }
    } else {
      open = null
    }
  }
  return heads.map((head) => {
    const span = spans.find((s) => s.staffIndex === head.staffIndex && head.x >= s.x0 && head.x <= s.x1)
    return span ? { ...head, relative: head.relative + span.shift, octaveShift: span.shift > 0 ? 1 : -1 } : head
  })
}
