import type { Detection } from './detector'
import { staffForY } from './staves'
import { type Bitmap, INK_THRESHOLD, type Staff } from './types'

/**
 * Noteheads that can't be notes: well above or below a staff, yet with no
 * ledger line between them and it.
 *
 * A note two ledger lines or more off the staff always has them drawn — the
 * player needs them to read it. What floats out there without any is
 * something else shaped like a notehead: the note of a metronome mark
 * (♩ = 112), a cue in a text, a stray blob. The network sometimes reads those
 * as notes; this throws them out.
 *
 * The test is the ledger line nearest the staff, just outside the notehead
 * on both sides — the head itself is ink whatever it sits on, its wings are
 * only ink if a line runs through. Lenient on purpose: a half-inked wing on
 * each side, anywhere in the band, is enough, so a faint or broken ledger in a
 * photo still passes.
 */
export function dropUnledgeredHeads(detections: Detection[], staves: Staff[], page: Bitmap): Detection[] {
  return detections.filter((d) => {
    if (d.cls !== 'head_filled' && d.cls !== 'head_hollow') return true
    if (!staffForY(staves, d.y)) return true
    // Between two staves a note may belong to either — a low one hangs from the
    // staff above, a high one rises from the staff below — so it stays if it has
    // ledger lines towards either. Steps are half spaces beyond the outer line:
    // 4 is the second ledger line.
    const upper = [...staves].reverse().find((s) => s.lines[0] <= d.y)
    const lower = staves.find((s) => s.lines[4] >= d.y)
    const candidates: { staff: Staff; side: 'above' | 'below' }[] = []
    if (upper) candidates.push({ staff: upper, side: 'below' })
    if (lower) candidates.push({ staff: lower, side: 'above' })
    return candidates.some(({ staff, side }) => {
      const S = staff.spaceHeight
      const steps = side === 'above' ? (staff.lines[0] - d.y) / (S / 2) : (d.y - staff.lines[4]) / (S / 2)
      if (steps < 3.5) return true
      if (steps > 20) return false
      return hasLedger(page, d.x, side === 'above' ? staff.lines[0] - S : staff.lines[4] + S, S)
    })
  })
}

function hasLedger(page: Bitmap, x: number, y: number, S: number): boolean {
  const inked = (x0: number, x1: number, row: number) => {
    let ink = 0
    let total = 0
    for (let xx = Math.round(x0); xx <= Math.round(x1); xx++) {
      if (xx < 0 || xx >= page.width) continue
      total++
      if (page.data[row * page.width + xx] < INK_THRESHOLD) ink++
    }
    return total ? ink / total : 0
  }
  // Each wing on its own: a ledger drawn a pixel askew still counts. Some
  // engravers stop a ledger barely past the notehead, so the wings start
  // right at its edge.
  const band = Math.max(1, Math.round(S * 0.3))
  let left = false
  let right = false
  for (let row = Math.round(y) - band; row <= Math.round(y) + band; row++) {
    if (row < 0 || row >= page.height) continue
    if (inked(x - S * 0.8, x - S * 0.6, row) >= 0.5) left = true
    if (inked(x + S * 0.6, x + S * 0.8, row) >= 0.5) right = true
    if (left && right) return true
  }
  return false
}
