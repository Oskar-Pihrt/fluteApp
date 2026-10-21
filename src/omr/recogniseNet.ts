import { assemble, type AssembleOptions } from './assemble'
import { binarise, LOW_CONTRAST_INK_FRACTION } from './binarise'
import { rotate } from './bitmap'
import { buildDewarp, findTracks } from './dewarp'
import { dropUnledgeredHeads } from './ledgers'
import { estimateSkew } from './deskew'
import { detectSymbols, resampleGray } from './detector'
import type { Net } from './net'
import { normaliseBox, noteWarnings, type RecogniseOptions, type RecogniseOutput } from './recognise'
import { detectStaffLines, estimateScale, groupIntoStaves } from './staves'
import type { Bitmap, OmrProgress, OmrResult, OmrWarning, Staff, StaffScale } from './types'

/**
 * The recogniser, with symbols found by the trained network.
 *
 * Geometry is still measured classically — skew, staff spacing and the staff
 * lines are reliable that way and cheap — but everything that sits on the
 * staff is the network's job. The page is resampled so a staff space is the
 * network's training size before anything else, which also makes every later
 * threshold the same in pixels on every page.
 */

export interface NetRecogniseOptions extends RecogniseOptions, AssembleOptions {
  /** Level warped staves first. Default true; off is for comparing. */
  dewarp?: boolean
}

const STAGE_FRACTIONS: Record<OmrProgress['stage'], number> = {
  binarise: 0.1,
  deskew: 0.15,
  scale: 0.2,
  staves: 0.25,
  symbols: 0.95,
  pitch: 1,
}

export function recogniseWithNet(gray: Bitmap, net: Net, options: NetRecogniseOptions = {}): RecogniseOutput {
  const warnings: OmrWarning[] = []
  const timings: Record<string, number> = {}
  const clock = () => (typeof performance !== 'undefined' ? performance.now() : 0)
  const report = (stage: OmrProgress['stage'], within = 1) => {
    const order: OmrProgress['stage'][] = ['binarise', 'deskew', 'scale', 'staves', 'symbols', 'pitch']
    const previous = order.indexOf(stage) > 0 ? STAGE_FRACTIONS[order[order.indexOf(stage) - 1]] : 0
    options.onProgress?.({ stage, fraction: previous + (STAGE_FRACTIONS[stage] - previous) * within })
  }
  const diagnostics: OmrResult['diagnostics'] = {
    sourceWidth: gray.width,
    sourceHeight: gray.height,
    inkFraction: 0,
    resample: 1,
    staffLineCount: 0,
    noteheadCount: 0,
  }
  const giveUp = (width: number, height: number, scale: StaffScale = { lineHeight: 0, spaceHeight: 0 }): RecogniseOutput => ({
    result: {
      notes: [],
      staves: [],
      scale,
      keySignature: { kind: '#', count: 0 },
      skewDeg: 0,
      barlineXs: [],
      warnings,
      analysedWidth: width,
      analysedHeight: height,
      timings,
      diagnostics,
    },
  })

  if (Math.min(gray.width, gray.height) < 80) {
    warnings.push({ code: 'too-small', message: `That image is only ${gray.width}×${gray.height}. Try a larger scan or screenshot.` })
    return giveUp(gray.width, gray.height)
  }

  // ── Binarise, only to measure ────────────────────────────────────────────
  report('binarise', 0)
  let mark = clock()
  const binary = binarise(gray)
  diagnostics.inkFraction = binary.inkFraction
  timings.binarise = clock() - mark
  if (binary.inkFraction < LOW_CONTRAST_INK_FRACTION) {
    warnings.push({ code: 'low-contrast', message: 'Almost nothing came through. The image may be blank or very faint.' })
    return giveUp(gray.width, gray.height)
  }

  // ── Deskew the grayscale page ────────────────────────────────────────────
  report('deskew', 0)
  mark = clock()
  const skewDeg = estimateSkew(binary.bitmap)
  const straight = skewDeg === 0 ? gray : rotate(gray, -skewDeg)
  const straightBinary = skewDeg === 0 ? binary.bitmap : rotate(binary.bitmap, -skewDeg)
  timings.deskew = clock() - mark
  if (Math.abs(skewDeg) > 4) {
    warnings.push({
      code: 'large-skew',
      message: `The page is tilted by about ${Math.abs(skewDeg).toFixed(1)}°. A straighter scan will read more reliably.`,
    })
  }

  // ── Normalise the staff spacing to the network's ─────────────────────────
  report('scale', 0)
  mark = clock()
  const measured = estimateScale(straightBinary)
  if (!measured || measured.spaceHeight < 4) {
    warnings.push({
      code: measured ? 'too-small' : 'no-staves',
      message: measured
        ? `The staff lines measured only ${measured.spaceHeight}px apart, too close together to read. Try a larger scan or screenshot.`
        : 'No staff lines found. Is this a page of sheet music, and is it the right way up?',
    })
    return giveUp(gray.width, gray.height)
  }
  const target = net.manifest.inputStaffSpace
  const factor = target / measured.spaceHeight
  const resampled = Math.abs(factor - 1) < 0.02 ? straight : resampleGray(straight, factor)
  const resampledBinary = binarise(resampled).bitmap
  const scale: StaffScale = estimateScale(resampledBinary) ?? {
    lineHeight: Math.max(1, Math.round(measured.lineHeight * factor)),
    spaceHeight: target,
  }
  diagnostics.resample = 1 / factor
  timings.scale = clock() - mark

  // A photo's staves are tilted and curled by amounts that differ across the
  // page. Track each staff's lines locally and level them, so everything after
  // this sees the flat page it was built for. A flat scan skips the resampling.
  mark = clock()
  const dewarp =
    options.dewarp === false ? null : buildDewarp(findTracks(resampledBinary, scale), resampled.width, resampled.height, scale.spaceHeight)
  const page = dewarp ? dewarp.apply(resampled) : resampled
  const pageBinary = dewarp ? binarise(page).bitmap : resampledBinary
  timings.dewarp = clock() - mark

  // ── Staves ───────────────────────────────────────────────────────────────
  report('staves', 0)
  mark = clock()
  // The threshold that picks out staff lines is a trade-off: high loses a faint
  // line (and with it a whole staff), low lets noise in. Try each and keep the
  // reading that yields the most complete staves, preferring the stricter one.
  let lineYs: number[] = []
  let staves: Staff[] = []
  for (const fraction of [0.45, 0.3, 0.2]) {
    const ys = detectStaffLines(pageBinary, scale, [fraction])
    const found = groupIntoStaves(ys, scale, pageBinary)
    if (found.length > staves.length) {
      lineYs = ys
      staves = found
    }
  }
  diagnostics.staffLineCount = lineYs.length
  timings.staves = clock() - mark
  if (!staves.length) {
    warnings.push({
      code: 'no-staves',
      message: lineYs.length
        ? `Found ${lineYs.length} staff lines but could not group them into staves of five. The page may be skewed or curved.`
        : 'Could not make out any staff lines. Try a flatter, straighter scan.',
    })
    return giveUp(page.width, page.height, scale)
  }

  // ── Symbols ──────────────────────────────────────────────────────────────
  report('symbols', 0)
  mark = clock()
  // Noteheads off the staff with no ledger lines (a metronome mark's note) are not notes.
  const detections = dropUnledgeredHeads(
    detectSymbols(net, page, { staves, onTile: (done, total) => report('symbols', done / total) }),
    staves,
    pageBinary,
  )
  timings.symbols = clock() - mark

  // ── Pitch ────────────────────────────────────────────────────────────────
  report('pitch', 0)
  mark = clock()
  const assembled = assemble(detections, staves, scale, options)
  diagnostics.noteheadCount = assembled.noteheadCount
  const toImage = (box: { x: number; y: number; width: number; height: number }) => {
    // Back through the straightening first: the box is on the levelled page.
    let bbox = box
    if (dewarp) {
      const centre = dewarp.toSource(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2)
      bbox = { ...bbox, y: centre.y - bbox.height / 2 }
    }
    return normaliseBox(bbox, page, skewDeg, 1 / factor, gray)
  }
  const notes = assembled.notes.map((note) => ({ ...note, bbox: toImage(note.bbox) }))
  diagnostics.ottavas = detections
    .filter((d) => d.cls === 'ottava_start' || d.cls === 'ottava_end')
    .map((d) => {
      const box = toImage({ x: d.x, y: d.y, width: 0, height: 0 })
      return { cls: d.cls, x: box.x, y: box.y }
    })
  const rhythm = assembled.rhythm && {
    measures: assembled.rhythm.measures.map((measure) => ({
      ...measure,
      events: measure.events.map((event) => (event.bbox ? { ...event, bbox: toImage(event.bbox) } : event)),
    })),
  }
  timings.pitch = clock() - mark

  if (!notes.length) {
    warnings.push({
      code: 'no-staves',
      message: `Read ${staves.length} ${staves.length === 1 ? 'staff' : 'staves'} but found no notes on them.`,
    })
  }
  warnings.push(...noteWarnings(notes, assembled.chordCount, options.playableNotes))
  const off = rhythm?.measures.filter((m) => m.fill === 'off').length ?? 0
  if (off) {
    warnings.push({
      code: 'rhythm-unsure',
      message: `${off} ${off === 1 ? 'measure doesn’t' : 'measures don’t'} add up to the time signature — they are tinted in the score. Check their durations.`,
    })
  }
  report('pitch', 1)

  return {
    result: {
      notes,
      staves,
      scale,
      keySignature: assembled.key,
      skewDeg,
      barlineXs: assembled.barlines.map((b) => b.x),
      warnings,
      ...(rhythm ? { rhythm } : {}),
      analysedWidth: page.width,
      analysedHeight: page.height,
      timings,
      diagnostics,
    },
  }
}
