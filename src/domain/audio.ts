import type { Instrument, InstrumentFamily } from '@/instruments/types'
import { noteFrequency } from './lookup'

/**
 * Minimal synth for previewing pitches.
 *
 * A triangle wave with a soft attack is not a flute, and a filtered sawtooth
 * is not a saxophone — they exist so you can confirm by ear that a fingering
 * gives the pitch you expected, and hear which instrument is active. Notes are
 * written pitch; they are played at the instrument's sounding pitch. Bundling real samples would cost tens of megabytes for a feature
 * that only needs to answer "is this the right note?".
 */

/** Which of the two synth voices each family gets. */
const TIMBRE: Record<InstrumentFamily, 'reedy' | 'pure'> = {
  flute: 'pure',
  sax: 'reedy',
  clarinet: 'reedy',
  oboe: 'reedy',
  recorder: 'pure',
  whistle: 'pure',
  brass: 'reedy',
  ocarina: 'pure',
}

let ctx: AudioContext | null = null

/**
 * Mobile browsers refuse to start an AudioContext outside a user gesture, so
 * creation is deferred to the first play call (which is always a tap).
 */
export function audioContext(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  ctx = new Ctor()
  return ctx
}

/** A scheduled sound that can be cut short. */
export interface Voice {
  stop(): void
}

/**
 * Play a written note at the instrument's sounding pitch, now or at `when`
 * (seconds on the audio clock — see `audioContext().currentTime`).
 */
export function playNote(note: string, instrument: Instrument, durationSeconds = 1.1, when?: number): Voice | null {
  const frequency = noteFrequency(note, instrument)
  if (frequency == null) return null

  const context = audioContext()
  if (!context) return null
  // Safari and Android WebViews can hand back a suspended context.
  if (context.state === 'suspended') void context.resume()

  const now = Math.max(when ?? 0, context.currentTime)
  const osc = context.createOscillator()
  const gain = context.createGain()

  osc.frequency.value = frequency
  // Reedier tone for reeds and brass: harmonic-rich sawtooth, tamed by a
  // lowpass. Flutes and their kin get a plain triangle.
  let source: AudioNode = osc
  if (TIMBRE[instrument.family] === 'reedy') {
    osc.type = 'sawtooth'
    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = Math.min(frequency * 4, 2400)
    source = osc.connect(filter)
  } else {
    osc.type = 'triangle'
  }

  // Breathy-ish envelope: gentle attack, long decay, no click on release.
  const peak = 0.22
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(peak, now + 0.06)
  gain.gain.linearRampToValueAtTime(peak * 0.75, now + durationSeconds * 0.5)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds)

  source.connect(gain).connect(context.destination)
  osc.start(now)
  osc.stop(now + durationSeconds + 0.02)
  return {
    stop() {
      try {
        osc.stop()
      } catch {
        // Already stopped.
      }
      gain.disconnect()
    },
  }
}

/** A metronome click: a short, high blip, higher on the first beat of a measure. */
export function playClick(when: number, accent: boolean): Voice | null {
  const context = audioContext()
  if (!context) return null
  const osc = context.createOscillator()
  const gain = context.createGain()
  osc.type = 'square'
  osc.frequency.value = accent ? 1760 : 1320
  gain.gain.setValueAtTime(0, when)
  gain.gain.linearRampToValueAtTime(accent ? 0.16 : 0.1, when + 0.002)
  gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.04)
  osc.connect(gain).connect(context.destination)
  osc.start(when)
  osc.stop(when + 0.05)
  return {
    stop() {
      try {
        osc.stop()
      } catch {
        // Already stopped.
      }
      gain.disconnect()
    },
  }
}
