/**
 * Shared types for the sheet-music recogniser.
 *
 * The whole recogniser is pure functions over these structures — no DOM, no
 * canvas, no Vue — so every stage runs under Vitest's `node` environment.
 * Canvas only appears at the edges, in the worker and the composable.
 */

/**
 * Single-channel 8-bit image. Grayscale before binarising; strictly `INK` or
 * `PAPER` afterwards.
 */
export interface Bitmap {
  data: Uint8Array
  width: number
  height: number
}

export const INK = 0
export const PAPER = 255
/** Anything darker than this counts as ink in a grayscale bitmap. */
export const INK_THRESHOLD = 128

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

/**
 * The two measurements every downstream threshold is expressed in multiples of.
 * Getting these right is the whole ballgame — see `estimateScale`.
 */
export interface StaffScale {
  /** Thickness of a single staff line, in pixels. */
  lineHeight: number
  /**
   * Staff line *pitch* — centre to centre of adjacent lines, in pixels.
   * Referred to as `S`. Note this is the gap plus one line thickness, not the
   * bare white gap, so that it agrees with `Staff.spaceHeight`, which is
   * measured from detected line centroids.
   */
  spaceHeight: number
}

export interface Staff {
  index: number
  /** The five line y-positions, top to bottom. */
  lines: number[]
  /** Measured gap for this particular staff, which can differ slightly from the page mode. */
  spaceHeight: number
  /** y of the bottom line — the origin for staff positions. */
  bottomLineY: number
  x0: number
  x1: number
}

export interface Notehead {
  /** Centroid in analysed-bitmap pixels. */
  x: number
  y: number
  bbox: Box
  filled: boolean
  staffIndex: number
  /** Diatonic steps above this staff's bottom line. Feeds `staff.ts`'s inverse. */
  relative: number
  /**
   * 0..1. Driven mainly by how close the centroid sits to an exact half-space —
   * a real notehead lands near one, noise does not.
   */
  confidence: number
}

export type PrintedAccidental = '#' | 'b' | 'n' | ''

export interface RecognisedNote {
  /** Scientific pitch, e.g. "F#5" — what `fingeringsForNote` consumes. */
  note: string
  /** Kept so a key-signature correction can re-derive the pitch with no re-scan. */
  relative: number
  staffIndex: number
  measureIndex: number
  /** The accidental printed beside this notehead, if any. */
  accidental: PrintedAccidental
  /** True when the accidental glyph was found but could not be classified. */
  accidentalUncertain: boolean
  /** Normalised 0–1 against the *original* stored image, for the overlay. */
  bbox: Box
  confidence: number
}

export interface KeySignature {
  kind: '#' | 'b'
  /** 0–7. Zero means C major / A minor. */
  count: number
}

export const NO_KEY: KeySignature = { kind: '#', count: 0 }

export type OmrWarningCode =
  | 'too-small'
  | 'no-staves'
  | 'large-skew'
  | 'low-contrast'
  | 'multi-column'
  | 'chord-found'
  | 'out-of-range'
  | 'accidental-unclear'

export interface OmrWarning {
  code: OmrWarningCode
  message: string
  /** Indices into `notes`, when the warning is about specific notes. */
  noteIndices?: number[]
}

export interface OmrResult {
  notes: RecognisedNote[]
  staves: Staff[]
  scale: StaffScale
  keySignature: KeySignature
  /** Skew that was corrected, in degrees. */
  skewDeg: number
  barlineXs: number[]
  warnings: OmrWarning[]
  /** Size of the bitmap the geometry above was measured on. */
  analysedWidth: number
  analysedHeight: number
  timings: Record<string, number>
  /**
   * Measurements from the run, whether or not it produced notes. When a page
   * reads badly these are what identify the stage at fault, so they are recorded
   * on every path including the early bail-outs.
   */
  diagnostics: {
    /** Size of the image as decoded, before any rescaling. */
    sourceWidth: number
    sourceHeight: number
    /** Fraction of pixels that came out as ink after thresholding. */
    inkFraction: number
    /** Resampling applied before analysis: >1 downsampled, <1 upscaled. */
    resample: number
    /** Candidate staff lines found, before grouping into staves of five. */
    staffLineCount: number
    /** Noteheads located, before chords were reduced and pitches derived. */
    noteheadCount: number
  }
}

export type OmrStage = 'binarise' | 'deskew' | 'scale' | 'staves' | 'symbols' | 'pitch'

export interface OmrProgress {
  stage: OmrStage
  /** 0..1 across the whole pipeline, for a progress bar. */
  fraction: number
}

/** Intermediate bitmaps, captured only when the debug overlay asks for them. */
export interface OmrDebug {
  binarised?: Bitmap
  staffRemoved?: Bitmap
  eroded?: Bitmap
}
