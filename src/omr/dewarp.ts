import { createBitmap } from './bitmap'
import { type Bitmap, INK_THRESHOLD, type StaffScale } from './types'

/**
 * Straightening staves that are not straight.
 *
 * A photographed page is tilted by a perspective that varies across it, and
 * its paper is curled, so a staff line that is horizontal at the left edge can
 * be several staff spaces off by the right. The recogniser's staff finder
 * projects ink onto rows across the *whole* page, which only works when the
 * lines are level — on a photo it finds two staves of fifteen.
 *
 * So lines are found locally instead: the page is cut into narrow vertical
 * strips, each strip's lines are located (they are straight over that little),
 * and the groups of five are linked from strip to strip into tracks. Each track
 * is one staff's centreline, y as a function of x. The page is then resampled so
 * every track becomes level, which hands the rest of the pipeline the flat page
 * it was built for. Pure and DOM-free, like the rest of the recogniser.
 */

/** Strip width in staff spaces: short enough to be straight, long enough to be a profile. */
const STRIP_SPACES = 6
/** A track must span at least this fraction of the page width to count as a staff. */
const MIN_TRACK_SPAN = 0.2

export interface Track {
  /** Strip centres, ascending. */
  xs: number[]
  /** Mean y of the staff's five lines at each strip. */
  ys: number[]
}

export interface Dewarp {
  /** Resample a bitmap of the same size as the one the tracks were found on. */
  apply(bitmap: Bitmap): Bitmap
  /** Where a point of the straightened page sits on the original. */
  toSource(x: number, y: number): { x: number; y: number }
  tracks: Track[]
  /** Largest vertical shift applied, in pixels — how warped the page was. */
  maxShift: number
}

interface Candidate {
  ys: number[]
  center: number
}

/**
 * Rows that look like staff lines within one strip, as ink-weighted centres
 * with their peak heights.
 */
function stripLines(binary: Bitmap, x0: number, x1: number, scale: StaffScale): { y: number; weight: number }[] {
  const { width, height, data } = binary
  const profile = new Int32Array(height)
  let peak = 0
  for (let y = 0; y < height; y++) {
    let count = 0
    const row = y * width
    for (let x = x0; x < x1; x++) if (data[row + x] < INK_THRESHOLD) count++
    profile[y] = count
    if (count > peak) peak = count
  }
  // An empty strip (margin, a gap between systems) has no lines to find.
  if (peak < (x1 - x0) * 0.5) return []

  const threshold = peak * 0.55
  const maxThickness = scale.lineHeight * 3 + 3
  const lines: { y: number; weight: number }[] = []
  let y = 0
  while (y < height) {
    if (profile[y] < threshold) {
      y++
      continue
    }
    let end = y
    let weighted = 0
    let total = 0
    while (end < height && profile[end] >= threshold) {
      weighted += end * profile[end]
      total += profile[end]
      end++
    }
    if (end - y <= maxThickness && total > 0) lines.push({ y: weighted / total, weight: total / (end - y) })
    y = end
  }
  return lines
}

/** Groups of five evenly spaced lines in a strip. */
function stripStaves(lines: { y: number; weight: number }[], S: number): Candidate[] {
  const out: Candidate[] = []
  const minGap = S * 0.75
  const maxGap = S * 1.3
  let i = 0
  while (i + 4 < lines.length) {
    const group = lines.slice(i, i + 5)
    const gaps = [1, 2, 3, 4].map((n) => group[n].y - group[n - 1].y)
    if (gaps.every((gap) => gap >= minGap && gap <= maxGap)) {
      // Of two overlapping windows (a beam or ledger line making a sixth
      // "line"), the real staff has the stronger weakest line.
      const next = lines.slice(i + 1, i + 6)
      if (next.length === 5) {
        const nextGaps = [1, 2, 3, 4].map((n) => next[n].y - next[n - 1].y)
        if (nextGaps.every((gap) => gap >= minGap && gap <= maxGap)) {
          const weakest = (g: { weight: number }[]) => Math.min(...g.map((l) => l.weight))
          if (weakest(next) > weakest(group)) {
            i++
            continue
          }
        }
      }
      const ys = group.map((l) => l.y)
      out.push({ ys, center: ys[2] })
      i += 5
    } else {
      i++
    }
  }
  return out
}

/** Every evenly spaced window of five lines in a strip, overlapping ones included. */
function allWindows(lines: { y: number; weight: number }[], S: number): Candidate[] {
  const out: Candidate[] = []
  for (let i = 0; i + 4 < lines.length; i++) {
    const group = lines.slice(i, i + 5)
    const ok = [1, 2, 3, 4].every((n) => {
      const gap = group[n].y - group[n - 1].y
      return gap >= S * 0.75 && gap <= S * 1.3
    })
    if (ok) out.push({ ys: group.map((l) => l.y), center: group[2].y })
  }
  return out
}

/** Link the per-strip staves into tracks, left to right. */
export function findTracks(binary: Bitmap, scale: StaffScale): Track[] {
  const S = scale.spaceHeight
  const strip = Math.max(16, Math.round(S * STRIP_SPACES))
  const tracks: (Track & { lastStrip: number })[] = []

  const strips = Math.floor(binary.width / strip)
  /** Where a track should be at a given x: its last point, carried along its recent slope. */
  const predict = (track: Track & { lastStrip: number }, x: number) => {
    const n = track.xs.length
    const last = track.ys[n - 1]
    if (n < 2) return last
    const back = Math.min(n - 1, 3)
    const slope = (last - track.ys[n - 1 - back]) / (track.xs[n - 1] - track.xs[n - 1 - back])
    return last + slope * (x - track.xs[n - 1])
  }

  for (let s = 0; s < strips; s++) {
    const x0 = s * strip
    const x1 = x0 + strip
    const cx = x0 + strip / 2
    const lines = stripLines(binary, x0, x1, scale)
    const greedy = stripStaves(lines, S)
    const all = allWindows(lines, S)
    // Windows within four staff spaces of each other share lines: taking one rules the others out.
    const consumed = new Set<Candidate>()
    const overlaps = (a: Candidate, b: Candidate) => Math.abs(a.center - b.center) < S * 4.3

    // Tracks pick the window that best continues them — not just the one a
    // context-free grouping happened to choose, which a beam or ledger line can
    // slide off by a whole line.
    const order = tracks
      .map((track, index) => ({ track, index }))
      .filter(({ track }) => s - track.lastStrip <= 3)
      .sort((a, b) => b.track.lastStrip - a.track.lastStrip)
    for (const { track } of order) {
      const gap = s - track.lastStrip
      const expected = predict(track, cx)
      let best: Candidate | null = null
      let bestDistance = S * (0.45 + 0.15 * gap)
      for (const window of all) {
        if (consumed.has(window)) continue
        const distance = Math.abs(window.center - expected)
        if (distance < bestDistance) {
          bestDistance = distance
          best = window
        }
      }
      if (best) {
        for (const window of all) if (overlaps(window, best)) consumed.add(window)
        track.xs.push(cx)
        track.ys.push(best.center)
        track.lastStrip = s
      }
    }
    for (const staff of greedy) {
      if (all.some((w) => consumed.has(w) && overlaps(w, staff))) continue
      tracks.push({ xs: [cx], ys: [staff.center], lastStrip: s })
    }
  }
  return tracks
    .filter((track) => track.xs.length >= 3 && track.xs[track.xs.length - 1] - track.xs[0] >= binary.width * MIN_TRACK_SPAN)
    .map(({ xs, ys }) => ({ xs, ys }))
    .sort((a, b) => a.ys.reduce((p, q) => p + q, 0) / a.ys.length - b.ys.reduce((p, q) => p + q, 0) / b.ys.length)
}

/** y of a track at column x, interpolated, held level beyond its ends. */
function trackY(track: Track, x: number): number {
  const { xs, ys } = track
  if (x <= xs[0]) return ys[0]
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1]
  let lo = 0
  let hi = xs.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (xs[mid] <= x) lo = mid
    else hi = mid
  }
  const t = (x - xs[lo]) / (xs[hi] - xs[lo])
  return ys[lo] + (ys[hi] - ys[lo]) * t
}

/**
 * Build the straightening for these tracks, or null when the page is already
 * flat enough that resampling it would only blur it.
 */
export function buildDewarp(tracks: Track[], width: number, height: number, S: number): Dewarp | null {
  if (!tracks.length) return null

  // Where each staff should end up: its mean height, so the page keeps its layout.
  const refs = tracks.map((t) => t.ys.reduce((a, b) => a + b, 0) / t.ys.length)
  const spans = tracks.map((t) => [t.xs[0] - S * 3, t.xs[t.xs.length - 1] + S * 3])
  const reach = tracks.map((_, k) => {
    // Each staff owns the page around it, up to a limit, so notes and ledger
    // lines move with their staff but neighbouring staves never overlap.
    const above = k > 0 ? (refs[k] - refs[k - 1]) * 0.45 : S * 6
    const below = k < tracks.length - 1 ? (refs[k + 1] - refs[k]) * 0.45 : S * 6
    return Math.min(S * 6, above, below)
  })

  let maxShift = 0
  for (let k = 0; k < tracks.length; k++) {
    for (let i = 0; i < tracks[k].ys.length; i++) maxShift = Math.max(maxShift, Math.abs(tracks[k].ys[i] - refs[k]))
  }
  // Within a fifth of a staff space everywhere is straight enough.
  if (maxShift < S * 0.2) return null

  /** Piecewise-linear destination→source y map for one column. */
  function column(x: number): { dst: number[]; src: number[] } {
    const dst: number[] = [0]
    const src: number[] = [0]
    let firstShift = 0
    let lastShift = 0
    let seen = false
    for (let k = 0; k < tracks.length; k++) {
      if (x < spans[k][0] || x > spans[k][1]) continue
      const c = trackY(tracks[k], x)
      const shift = c - refs[k] // source y = dest y + shift near this staff
      if (!seen) {
        firstShift = shift
        seen = true
      }
      lastShift = shift
      const r = reach[k]
      // Points on either side of the staff, in destination space, with the staff's own shift.
      for (const [d, s] of [[refs[k] - r, refs[k] - r + shift], [refs[k] + r, refs[k] + r + shift]]) {
        // Keep the map monotone where a large shift would fold it back.
        if (d > dst[dst.length - 1] && s > src[src.length - 1]) {
          dst.push(d)
          src.push(s)
        }
      }
    }
    if (!seen) return { dst: [0, height - 1], src: [0, height - 1] }
    // Before the first and after the last staff the page is carried along rigidly.
    dst[0] = 0
    src[0] = firstShift
    dst.push(height - 1)
    src.push(height - 1 + lastShift)
    return { dst, src }
  }

  const sample = (map: { dst: number[]; src: number[] }, yd: number): number => {
    let i = 1
    while (i < map.dst.length - 1 && map.dst[i] < yd) i++
    const d0 = map.dst[i - 1]
    const d1 = map.dst[i]
    const t = d1 > d0 ? (yd - d0) / (d1 - d0) : 0
    return map.src[i - 1] + (map.src[i] - map.src[i - 1]) * t
  }

  return {
    tracks,
    maxShift,
    toSource(x, y) {
      return { x, y: sample(column(Math.round(Math.min(width - 1, Math.max(0, x)))), y) }
    },
    apply(bitmap) {
      const out = createBitmap(bitmap.width, bitmap.height, 255)
      for (let x = 0; x < bitmap.width; x++) {
        const map = column(x)
        let i = 1
        for (let y = 0; y < bitmap.height; y++) {
          while (i < map.dst.length - 1 && map.dst[i] < y) i++
          const d0 = map.dst[i - 1]
          const d1 = map.dst[i]
          const t = d1 > d0 ? (y - d0) / (d1 - d0) : 0
          const sy = map.src[i - 1] + (map.src[i] - map.src[i - 1]) * t
          const y0 = Math.floor(sy)
          if (y0 < 0 || y0 >= bitmap.height - 1) {
            if (y0 === bitmap.height - 1 && sy - y0 < 1e-6) out.data[y * bitmap.width + x] = bitmap.data[y0 * bitmap.width + x]
            continue
          }
          const f = sy - y0
          const a = bitmap.data[y0 * bitmap.width + x]
          const b = bitmap.data[(y0 + 1) * bitmap.width + x]
          out.data[y * bitmap.width + x] = Math.round(a + (b - a) * f)
        }
      }
      return out
    },
  }
}
