import type { Instrument } from '@/instruments/types'
import { canonicalNote } from './lookup'

/**
 * Pitch detection for practice: what note is the player sounding right now?
 *
 * YIN (de Cheveigné & Kawahara, 2002), written out rather than pulled in as a
 * dependency — it is short, and a flute's near-sine tone is exactly the case
 * where simpler autocorrelation picks the wrong octave. Everything here is pure
 * so it can be tested on synthetic buffers; the microphone plumbing lives in
 * `src/practice/useMicrophone.ts`.
 */

export interface PitchReading {
  hz: number
  /** 1 − YIN's aperiodicity at the chosen lag: near 1 for a clean tone. */
  clarity: number
}

/** Below this RMS the buffer is treated as silence. */
const SILENCE_RMS = 0.01
/** YIN's absolute threshold on the cumulative-mean-normalised difference. */
const THRESHOLD = 0.15
/** Lowest and highest pitch searched for — a tuba's pedal to a piccolo's top. */
const MIN_HZ = 40
const MAX_HZ = 4500

export function detectPitch(samples: Float32Array, sampleRate: number): PitchReading | null {
  let sum = 0
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
  if (Math.sqrt(sum / samples.length) < SILENCE_RMS) return null

  const maxLag = Math.min(Math.floor(sampleRate / MIN_HZ), Math.floor(samples.length / 2))
  const minLag = Math.max(2, Math.floor(sampleRate / MAX_HZ))
  const window = samples.length - maxLag
  if (window <= 0 || maxLag <= minLag) return null

  // Difference function, then its cumulative-mean normalisation.
  const d = new Float32Array(maxLag + 1)
  for (let lag = 1; lag <= maxLag; lag++) {
    let acc = 0
    for (let i = 0; i < window; i++) {
      const delta = samples[i] - samples[i + lag]
      acc += delta * delta
    }
    d[lag] = acc
  }
  const cmnd = new Float32Array(maxLag + 1)
  cmnd[0] = 1
  let running = 0
  for (let lag = 1; lag <= maxLag; lag++) {
    running += d[lag]
    cmnd[lag] = running === 0 ? 1 : (d[lag] * lag) / running
  }

  // First dip under the threshold, followed down to its local minimum.
  let lag = -1
  for (let t = minLag; t <= maxLag; t++) {
    if (cmnd[t] < THRESHOLD) {
      while (t + 1 <= maxLag && cmnd[t + 1] < cmnd[t]) t++
      lag = t
      break
    }
  }
  if (lag < 0) return null

  // Parabolic interpolation for sub-sample accuracy (a few cents matter here).
  let refined = lag
  if (lag > 1 && lag < maxLag) {
    const a = cmnd[lag - 1]
    const b = cmnd[lag]
    const c = cmnd[lag + 1]
    const denominator = a - 2 * b + c
    if (denominator !== 0) refined = lag + (a - c) / (2 * denominator)
  }

  return { hz: sampleRate / refined, clarity: Math.max(0, 1 - cmnd[lag]) }
}

export interface HeardNote {
  /** Written pitch on the instrument, sharp spelling: "F#5". */
  note: string
  midi: number
  /** How far off the written note, −50…+50. */
  cents: number
}

/** A sounding frequency as the note the player reads, with its tuning offset. */
export function hzToWritten(hz: number, instrument: Instrument): HeardNote {
  const sounding = 69 + 12 * Math.log2(hz / 440)
  const nearest = Math.round(sounding)
  const midi = nearest - instrument.transposeSemitones
  return { note: canonicalNote(midi), midi, cents: Math.round((sounding - nearest) * 100) }
}

/**
 * Turns a stream of frame-by-frame readings into "the player is holding this
 * note". A note counts once it has been heard for `holdMs` without a break, so
 * a slide through neighbouring pitches or a cracked attack doesn't register.
 */
export class NoteStabiliser {
  private candidate: number | null = null
  private since = 0
  private readonly holdMs: number

  constructor(holdMs = 150) {
    this.holdMs = holdMs
  }

  /** Feed one reading (or null for silence); returns the steady MIDI note, if any. */
  push(midi: number | null, nowMs: number): number | null {
    if (midi !== this.candidate) {
      this.candidate = midi
      this.since = nowMs
      return null
    }
    if (midi == null) return null
    return nowMs - this.since >= this.holdMs ? midi : null
  }

  reset() {
    this.candidate = null
    this.since = 0
  }
}
