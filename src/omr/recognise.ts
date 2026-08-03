import { Note } from 'tonal'
import { binarise, LOW_CONTRAST_INK_FRACTION } from './binarise'
import { downsample, rotate, toOriginalCoords, upsample } from './bitmap'
import { estimateSkew } from './deskew'
import { detectAccidentals, detectBarlines, detectClefs, detectKeySignature } from './glyphs'
import { detectNoteheads, findChordGroups } from './noteheads'
import { derivePitches } from './pitch'
import { detectStaffLines, estimateScale, groupIntoStaves, removeStaffLines } from './staves'
import {
  type Bitmap,
  type OmrDebug,
  type OmrProgress,
  type OmrResult,
  type OmrWarning,
  type RecognisedNote,
  type Staff,
  type StaffScale,
} from './types'

/**
 * The recognition pipeline.
 *
 * Ordering is forced by dependency, not preference: the scale has to be measured
 * before any size threshold can be applied, staves before lines can be removed,
 * the clef before noteheads (or its bowls read as notes), and noteheads before
 * the key signature (which is everything between the clef and the first note).
 *
 * Every stage that can fail degrades to a warning and an empty-but-valid result
 * rather than throwing, because the caller's fallback is the manual editor and a
 * clear "couldn't read this" beats a crash or a blank screen. Crucially, a bail-out
 * still returns its measurements and whatever intermediate bitmaps were captured —
 * a failure with no diagnostics is the one outcome that cannot be acted on.
 */

/**
 * Below this staff spacing the lines themselves merge and there is genuinely no
 * geometry left to recover. Anything above it is worked with, by rescaling.
 */
const MIN_SPACE_HEIGHT = 4
/**
 * Analysis happens at this staff spacing, in both directions.
 *
 * Large scans are downsampled to it because cost is per-pixel and notehead
 * localisation gains nothing above ~16px — a 3000px page gets several times
 * cheaper for no loss of accuracy. Small pages are *upscaled* to it, which is the
 * more important half: a screen-resolution screenshot of a full page can arrive
 * at a spacing of six pixels, where the staves are perfectly detectable but the
 * erosion element rounds away to nothing.
 */
const TARGET_SPACE_HEIGHT = 16
/** Bounds memory on a pathologically small input. */
const MAX_UPSCALE = 4
const MAX_ANALYSED_PIXELS = 16_000_000

export interface RecogniseOptions {
  onProgress?: (progress: OmrProgress) => void
  /** Capture intermediate bitmaps for the debug overlay. Off by default — it costs memory. */
  debug?: boolean
  /** Flute range, so out-of-range notes can be flagged. Pass from `noteRange()`. */
  playableNotes?: string[]
}

export interface RecogniseOutput {
  result: OmrResult
  debug?: OmrDebug
}

const STAGE_FRACTIONS: Record<string, number> = {
  binarise: 0.2,
  deskew: 0.35,
  scale: 0.45,
  staves: 0.6,
  symbols: 0.85,
  pitch: 1,
}

export function recognise(gray: Bitmap, options: RecogniseOptions = {}): RecogniseOutput {
  const warnings: OmrWarning[] = []
  const timings: Record<string, number> = {}
  const debug: OmrDebug = {}
  const wantDebug = options.debug === true

  // Filled in as the run progresses, so a bail-out reports what it got to.
  const diagnostics: OmrResult['diagnostics'] = {
    sourceWidth: gray.width,
    sourceHeight: gray.height,
    inkFraction: 0,
    resample: 1,
    staffLineCount: 0,
    noteheadCount: 0,
  }

  const report = (stage: keyof typeof STAGE_FRACTIONS) =>
    options.onProgress?.({ stage: stage as OmrProgress['stage'], fraction: STAGE_FRACTIONS[stage] })

  const clock = () => (typeof performance !== 'undefined' ? performance.now() : 0)

  /** Bail out with everything measured so far, including the debug bitmaps. */
  const giveUp = (width: number, height: number): RecogniseOutput => ({
    result: {
      notes: [],
      staves: [],
      scale: { lineHeight: 0, spaceHeight: 0 },
      keySignature: { kind: '#', count: 0 },
      skewDeg: 0,
      barlineXs: [],
      warnings,
      analysedWidth: width,
      analysedHeight: height,
      timings,
      diagnostics,
    },
    debug: wantDebug ? debug : undefined,
  })

  if (Math.min(gray.width, gray.height) < 80) {
    warnings.push({
      code: 'too-small',
      message: `That image is only ${gray.width}×${gray.height}. Try a larger scan or screenshot.`,
    })
    return giveUp(gray.width, gray.height)
  }

  // ── Binarise ─────────────────────────────────────────────────────────────
  report('binarise')
  let mark = clock()
  const binarised = binarise(gray)
  timings.binarise = clock() - mark
  diagnostics.inkFraction = binarised.inkFraction
  if (wantDebug) debug.binarised = binarised.bitmap

  if (binarised.inkFraction < LOW_CONTRAST_INK_FRACTION) {
    warnings.push({
      code: 'low-contrast',
      message: 'Almost nothing came through. The image may be blank or very faint.',
    })
    return giveUp(gray.width, gray.height)
  }

  // ── Deskew ───────────────────────────────────────────────────────────────
  report('deskew')
  mark = clock()
  const skewDeg = estimateSkew(binarised.bitmap)
  let working = skewDeg === 0 ? binarised.bitmap : rotate(binarised.bitmap, -skewDeg)
  timings.deskew = clock() - mark
  if (Math.abs(skewDeg) > 4) {
    warnings.push({
      code: 'large-skew',
      message: `The page is tilted by about ${Math.abs(skewDeg).toFixed(1)}°. A straighter scan will read more reliably.`,
    })
  }

  // ── Scale, and rescale to a workable one ─────────────────────────────────
  report('scale')
  mark = clock()
  let scale = estimateScale(working)
  if (!scale || scale.spaceHeight < MIN_SPACE_HEIGHT) {
    warnings.push({
      code: scale ? 'too-small' : 'no-staves',
      message: scale
        ? `The staff lines measured only ${scale.spaceHeight}px apart, too close together to read. Try a larger scan or screenshot.`
        : 'No staff lines found. Is this a page of sheet music, and is it the right way up?',
    })
    timings.scale = clock() - mark
    return giveUp(working.width, working.height)
  }

  // Bring the page to a workable staff spacing, shrinking or enlarging as needed.
  // `scaleToOriginal` converts analysed coordinates back to the stored image, so
  // it is the factor for a downsample and its reciprocal for an upscale.
  let scaleToOriginal = 1
  const shrink = Math.floor(scale.spaceHeight / TARGET_SPACE_HEIGHT)
  const grow = Math.ceil(TARGET_SPACE_HEIGHT / scale.spaceHeight)

  if (shrink >= 2) {
    working = downsample(working, shrink)
    scaleToOriginal = shrink
    scale = rescaled(working, scale, 1 / shrink)
  } else if (grow >= 2) {
    const factor = Math.min(
      grow,
      MAX_UPSCALE,
      Math.max(1, Math.floor(Math.sqrt(MAX_ANALYSED_PIXELS / (working.width * working.height)))),
    )
    if (factor >= 2) {
      working = upsample(working, factor)
      scaleToOriginal = 1 / factor
      scale = rescaled(working, scale, factor)
    }
  }
  diagnostics.resample = scaleToOriginal
  timings.scale = clock() - mark

  // ── Staves ───────────────────────────────────────────────────────────────
  report('staves')
  mark = clock()
  const lineYs = detectStaffLines(working, scale)
  diagnostics.staffLineCount = lineYs.length
  const staves = groupIntoStaves(lineYs, scale, working)
  timings.staves = clock() - mark

  if (!staves.length) {
    warnings.push({
      code: 'no-staves',
      message: lineYs.length
        ? `Found ${lineYs.length} staff lines but could not group them into staves of five. The page may be skewed or curved.`
        : 'Could not make out any staff lines. Try a flatter, straighter scan.',
    })
    return giveUp(working.width, working.height)
  }
  if (hasVerticalOverlap(staves)) {
    warnings.push({
      code: 'multi-column',
      message: 'This looks like a multi-column layout. Note order may be wrong — check it.',
    })
  }

  const staffRemoved = removeStaffLines(working, staves, scale)
  if (wantDebug) debug.staffRemoved = staffRemoved

  // ── Symbols ──────────────────────────────────────────────────────────────
  report('symbols')
  mark = clock()
  const clefs = detectClefs(staffRemoved, staves, scale)
  const clefEnd = staves.map(
    (staff) => clefs.find((clef) => clef.staffIndex === staff.index)?.endX ?? staff.x0,
  )
  const barlines = detectBarlines(staffRemoved, staves, scale)
  const accidentals = detectAccidentals(staffRemoved, staves, scale)

  // First pass past the clef, to find where the music actually starts.
  const firstPass = detectNoteheads(staffRemoved, staves, scale, { contentStartX: clefEnd })
  const onFirstStaff = firstPass.noteheads.filter((note) => note.staffIndex === 0)
  const firstNoteX = onFirstStaff.length ? Math.min(...onFirstStaff.map((note) => note.x)) : null

  const { key, endX: keyEndX } = detectKeySignature(accidentals, clefs, firstNoteX, 0)
  // Key-signature accidentals sit past the clef, so the content boundary moves
  // right; re-run detection so none of them can be mistaken for notes.
  const contentStartX = staves.map((staff, index) =>
    staff.index === 0 ? Math.max(clefEnd[index], keyEndX) : clefEnd[index],
  )
  const detection = detectNoteheads(staffRemoved, staves, scale, { contentStartX })
  if (wantDebug) debug.eroded = detection.eroded
  diagnostics.noteheadCount = detection.noteheads.length
  timings.symbols = clock() - mark

  const chords = findChordGroups(detection.noteheads, scale.spaceHeight)
  // Flute music is monophonic, so keep the top note of any stack and say so.
  const dropped = new Set(chords.flatMap((group) => group.slice(1)))
  const monophonic = detection.noteheads.filter((notehead) => !dropped.has(notehead))

  // ── Pitch ────────────────────────────────────────────────────────────────
  report('pitch')
  mark = clock()
  const notes = derivePitches({
    noteheads: monophonic,
    accidentals,
    barlines,
    key,
    scale,
    contentStartX,
  })

  // Report geometry in the original image's coordinate space, normalised, so the
  // overlay lines up with the untouched image the user is looking at.
  const withBoxes: RecognisedNote[] = notes.map((note) => ({
    ...note,
    bbox: normaliseBox(note.bbox, working, skewDeg, scaleToOriginal, gray),
  }))
  timings.pitch = clock() - mark

  if (!withBoxes.length) {
    warnings.push({
      code: 'no-staves',
      message: `Read ${staves.length} ${staves.length === 1 ? 'staff' : 'staves'} but found no noteheads on them. Turn on the detection stages to see what it saw.`,
    })
  }

  if (chords.length) {
    warnings.push({
      code: 'chord-found',
      message: `Found ${chords.length} stacked ${chords.length === 1 ? 'notehead' : 'noteheads'}. Kept the top note of each — check those.`,
    })
  }

  const uncertain = withBoxes
    .map((note, index) => ({ note, index }))
    .filter(({ note }) => note.accidentalUncertain)
    .map(({ index }) => index)
  if (uncertain.length) {
    warnings.push({
      code: 'accidental-unclear',
      message: `Could not read ${uncertain.length} ${uncertain.length === 1 ? 'accidental' : 'accidentals'} for certain.`,
      noteIndices: uncertain,
    })
  }

  if (options.playableNotes?.length) {
    const playable = new Set(options.playableNotes.map((note) => Note.midi(note)))
    const outOfRange = withBoxes
      .map((note, index) => ({ midi: Note.midi(note.note), index }))
      .filter(({ midi }) => midi != null && !playable.has(midi))
      .map(({ index }) => index)
    if (outOfRange.length) {
      warnings.push({
        code: 'out-of-range',
        message: `${outOfRange.length} ${outOfRange.length === 1 ? 'note is' : 'notes are'} outside the flute's range — probably an octave misread.`,
        noteIndices: outOfRange,
      })
    }
  }

  return {
    result: {
      notes: withBoxes,
      staves,
      scale,
      keySignature: key,
      skewDeg,
      barlineXs: barlines.map((barline) => barline.x),
      warnings,
      analysedWidth: working.width,
      analysedHeight: working.height,
      timings,
      diagnostics,
    },
    debug: wantDebug ? debug : undefined,
  }
}

/**
 * The scale of a resampled bitmap. Re-measured from the pixels where possible,
 * since resampling rounds; falls back to arithmetic if the measurement fails.
 */
function rescaled(working: Bitmap, previous: StaffScale, ratio: number): StaffScale {
  const measured = estimateScale(working)
  if (measured && measured.spaceHeight >= MIN_SPACE_HEIGHT) return measured
  return {
    lineHeight: Math.max(1, Math.round(previous.lineHeight * ratio)),
    spaceHeight: Math.max(MIN_SPACE_HEIGHT, previous.spaceHeight * ratio),
  }
}

/** Two staves overlapping vertically implies side-by-side columns, not a system. */
function hasVerticalOverlap(staves: Staff[]): boolean {
  for (let i = 1; i < staves.length; i++) {
    const previous = staves[i - 1]
    const current = staves[i]
    if (current.lines[0] < previous.lines[4] - previous.spaceHeight * 2) return true
  }
  return false
}

/**
 * Analysed-bitmap box → normalised 0–1 box on the original image.
 *
 * The corners are transformed individually and re-bounded, since undoing the
 * deskew rotates the box and an axis-aligned result has to enclose it.
 */
function normaliseBox(
  box: RecognisedNote['bbox'],
  analysed: Bitmap,
  skewDeg: number,
  scaleToOriginal: number,
  original: Bitmap,
): RecognisedNote['bbox'] {
  const corners = [
    [box.x, box.y],
    [box.x + box.width, box.y],
    [box.x, box.y + box.height],
    [box.x + box.width, box.y + box.height],
  ].map(([x, y]) => toOriginalCoords(x, y, analysed, skewDeg, scaleToOriginal))

  const xs = corners.map((corner) => corner.x)
  const ys = corners.map((corner) => corner.y)
  const minX = Math.min(...xs)
  const minY = Math.min(...ys)

  return {
    x: minX / original.width,
    y: minY / original.height,
    width: (Math.max(...xs) - minX) / original.width,
    height: (Math.max(...ys) - minY) / original.height,
  }
}
