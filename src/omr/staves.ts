import { createBitmap, rowInkProfile, verticalRunLengths } from './bitmap'
import { type Bitmap, INK_THRESHOLD, PAPER, type Staff, type StaffScale } from './types'

/**
 * Staff geometry: the scale of the engraving, where the lines are, and how to
 * get rid of them without destroying the symbols sitting on top.
 *
 * Everything downstream is expressed in multiples of `spaceHeight` rather than
 * pixels, so the detector works the same on a 900px screenshot and a 3000px
 * scan. That makes `estimateScale` the most load-bearing function in the
 * recogniser — if it is wrong, nothing after it can be right.
 */

const MAX_LINE_RUN = 40
const MAX_SPACE_RUN = 300

/**
 * Measure line thickness and line spacing from vertical run lengths.
 *
 * In engraved music, staff lines dominate the statistics of vertical black runs
 * (every column crossing a staff hits five of them) and the gaps between them
 * dominate the white runs. So the modes of those two histograms are the two
 * numbers we need, with no need to find the lines first.
 */
export function estimateScale(binary: Bitmap): StaffScale | null {
  const { width, height, data } = binary
  const inkRuns = new Int32Array(MAX_LINE_RUN + 1)
  const spaceRuns = new Int32Array(MAX_SPACE_RUN + 1)

  for (let x = 0; x < width; x++) {
    let y = 0
    while (y < height) {
      const isInk = data[y * width + x] < INK_THRESHOLD
      let end = y
      while (end < height && data[end * width + x] < INK_THRESHOLD === isInk) end++
      const length = end - y

      if (isInk) {
        if (length <= MAX_LINE_RUN) inkRuns[length]++
      } else if (length <= MAX_SPACE_RUN) {
        // Runs longer than the cap are margins and inter-staff gaps, which would
        // only drown out the signal we want.
        spaceRuns[length]++
      }
      y = end
    }
  }

  const lineHeight = modeOf(inkRuns, 1, MAX_LINE_RUN)
  const whiteGap = modeOf(spaceRuns, 3, MAX_SPACE_RUN)
  if (lineHeight == null || whiteGap == null) return null

  // The modal white run is the *gap* between two lines, but every size test
  // downstream wants the line pitch — centre to centre — which is that gap plus
  // one line thickness. `Staff.spaceHeight`, measured from detected line
  // centroids, means pitch too, so converting here keeps the two agreeing.
  const spaceHeight = whiteGap + lineHeight

  // A plausible engraving has lines much thinner than the gaps between them.
  if (spaceHeight < lineHeight * 3) return null

  return { lineHeight, spaceHeight }
}

function modeOf(histogram: Int32Array, from: number, to: number): number | null {
  let best = -1
  let bestCount = 0
  for (let i = from; i <= to; i++) {
    if (histogram[i] > bestCount) {
      bestCount = histogram[i]
      best = i
    }
  }
  // A handful of runs is noise, not a measurement.
  return bestCount < 20 ? null : best
}

/**
 * Rows that look like staff lines, returned as ink-weighted centre positions.
 *
 * A staff line spans nearly the full width of its staff, so it stands far above
 * everything else in the row-ink profile. The threshold is relative to the
 * profile's peak, with one retry at a lower fraction — a faint or partly cropped
 * staff is common enough to be worth handling rather than failing on.
 */
export function detectStaffLines(binary: Bitmap, scale: StaffScale): number[] {
  const profile = rowInkProfile(binary)
  let peak = 0
  for (const v of profile) if (v > peak) peak = v
  if (peak === 0) return []

  const maxThickness = scale.lineHeight * 3 + 2
  for (const fraction of [0.45, 0.3, 0.2]) {
    const lines = bandsAboveThreshold(profile, peak * fraction, maxThickness)
    if (lines.length >= 5) return lines
  }
  return []
}

function bandsAboveThreshold(
  profile: Int32Array,
  threshold: number,
  maxThickness: number,
): number[] {
  const centres: number[] = []
  let y = 0
  while (y < profile.length) {
    if (profile[y] < threshold) {
      y++
      continue
    }
    let end = y
    let weighted = 0
    let total = 0
    while (end < profile.length && profile[end] >= threshold) {
      weighted += end * profile[end]
      total += profile[end]
      end++
    }
    // A band far thicker than a line is a beam, a blot, or a scan edge.
    if (end - y <= maxThickness && total > 0) centres.push(weighted / total)
    y = end
  }
  return centres
}

/**
 * Gather detected lines into staves of exactly five with consistent spacing.
 *
 * A group that isn't five lines is rejected outright rather than guessed at —
 * a wrong staff produces wrong pitches for every note on it, which is worse
 * than reporting nothing and letting the user type.
 */
export function groupIntoStaves(lineYs: number[], scale: StaffScale, binary: Bitmap): Staff[] {
  const sorted = [...lineYs].sort((a, b) => a - b)
  const staves: Staff[] = []
  const minGap = scale.spaceHeight * 0.7
  const maxGap = scale.spaceHeight * 1.35

  let i = 0
  while (i + 4 < sorted.length) {
    const group = sorted.slice(i, i + 5)
    const gaps = [1, 2, 3, 4].map((n) => group[n] - group[n - 1])
    const consistent = gaps.every((gap) => gap >= minGap && gap <= maxGap)

    if (consistent) {
      const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length
      const extent = staffExtent(binary, group, scale.lineHeight)
      staves.push({
        index: staves.length,
        lines: group,
        spaceHeight: mean,
        bottomLineY: group[4],
        x0: extent.x0,
        x1: extent.x1,
      })
      i += 5
    } else {
      i += 1
    }
  }
  return staves
}

/**
 * Horizontal extent of a staff, taken as the median first and last inked column
 * across its five lines — median so one stray mark in the margin can't stretch
 * the staff across the page.
 */
function staffExtent(binary: Bitmap, lineYs: number[], lineHeight: number): { x0: number; x1: number } {
  const firsts: number[] = []
  const lasts: number[] = []
  const tolerance = Math.max(1, Math.round(lineHeight))

  for (const lineY of lineYs) {
    const yFrom = Math.max(0, Math.round(lineY - tolerance))
    const yTo = Math.min(binary.height - 1, Math.round(lineY + tolerance))
    let first = -1
    let last = -1
    for (let x = 0; x < binary.width; x++) {
      let inked = false
      for (let y = yFrom; y <= yTo; y++) {
        if (binary.data[y * binary.width + x] < INK_THRESHOLD) {
          inked = true
          break
        }
      }
      if (inked) {
        if (first === -1) first = x
        last = x
      }
    }
    if (first !== -1) {
      firsts.push(first)
      lasts.push(last)
    }
  }

  if (!firsts.length) return { x0: 0, x1: binary.width - 1 }
  return { x0: median(firsts), x1: median(lasts) }
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[sorted.length >> 1]
}

/**
 * Erase staff lines while leaving the symbols intact.
 *
 * The trick is the vertical run length: a pixel belonging only to a staff line
 * sits in a run about as tall as the line is thick, whereas a pixel in a
 * notehead or stem sits in a much taller run. So erase short runs on a line and
 * leave long ones — no shape analysis needed, and notes crossing a line survive.
 */
export function removeStaffLines(binary: Bitmap, staves: Staff[], scale: StaffScale): Bitmap {
  const out = createBitmap(binary.width, binary.height, 0)
  out.data.set(binary.data)
  if (!staves.length) return out

  const runs = verticalRunLengths(binary)
  const maxRun = Math.max(2, scale.lineHeight * 2)
  const tolerance = Math.max(1, Math.round(scale.lineHeight * 1.5))

  for (const staff of staves) {
    const xFrom = Math.max(0, Math.floor(staff.x0))
    const xTo = Math.min(binary.width - 1, Math.ceil(staff.x1))

    for (const lineY of staff.lines) {
      const yFrom = Math.max(0, Math.round(lineY - tolerance))
      const yTo = Math.min(binary.height - 1, Math.round(lineY + tolerance))
      for (let y = yFrom; y <= yTo; y++) {
        const row = y * binary.width
        for (let x = xFrom; x <= xTo; x++) {
          const index = row + x
          if (binary.data[index] < INK_THRESHOLD && runs[index] <= maxRun) {
            out.data[index] = PAPER
          }
        }
      }
    }
  }
  return out
}

/** Staff position of a y coordinate, in diatonic steps above the bottom line. */
export function relativeAt(staff: Staff, y: number): number {
  return (staff.bottomLineY - y) / (staff.spaceHeight / 2)
}

/** y coordinate of an exact staff position — the inverse of `relativeAt`. */
export function yAtRelative(staff: Staff, relative: number): number {
  return staff.bottomLineY - (relative * staff.spaceHeight) / 2
}

/** The staff a y coordinate most plausibly belongs to, or null if none is close. */
export function staffForY(staves: Staff[], y: number): Staff | null {
  let best: Staff | null = null
  let bestDistance = Infinity
  for (const staff of staves) {
    const centre = (staff.lines[0] + staff.lines[4]) / 2
    const distance = Math.abs(y - centre)
    if (distance < bestDistance) {
      bestDistance = distance
      best = staff
    }
  }
  // Beyond about two staff-heights away it belongs to nothing — a page number,
  // a title, or a stray mark.
  if (best && bestDistance > best.spaceHeight * 8) return null
  return best
}
