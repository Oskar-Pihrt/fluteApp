import { noteFrequency } from './lookup'

/**
 * Minimal synth for previewing pitches.
 *
 * A triangle wave with a soft attack is not a flute, and isn't trying to be —
 * it exists so you can confirm by ear that a fingering gives the pitch you
 * expected. Bundling real samples would cost tens of megabytes for a feature
 * that only needs to answer "is this the right note?".
 */

let ctx: AudioContext | null = null

/**
 * Mobile browsers refuse to start an AudioContext outside a user gesture, so
 * creation is deferred to the first play call (which is always a tap).
 */
function audioContext(): AudioContext | null {
  if (ctx) return ctx
  const Ctor = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  ctx = new Ctor()
  return ctx
}

export function playNote(note: string, durationSeconds = 1.1): void {
  const frequency = noteFrequency(note)
  if (frequency == null) return

  const context = audioContext()
  if (!context) return
  // Safari and Android WebViews can hand back a suspended context.
  if (context.state === 'suspended') void context.resume()

  const now = context.currentTime
  const osc = context.createOscillator()
  const gain = context.createGain()

  osc.type = 'triangle'
  osc.frequency.value = frequency

  // Breathy-ish envelope: gentle attack, long decay, no click on release.
  const peak = 0.22
  gain.gain.setValueAtTime(0, now)
  gain.gain.linearRampToValueAtTime(peak, now + 0.06)
  gain.gain.linearRampToValueAtTime(peak * 0.75, now + durationSeconds * 0.5)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds)

  osc.connect(gain).connect(context.destination)
  osc.start(now)
  osc.stop(now + durationSeconds + 0.02)
}

/** Play a sequence of notes back to back — used by the sheet music view. */
export function playSequence(notes: readonly string[], noteSeconds = 0.45): () => void {
  let cancelled = false
  let index = 0

  const step = () => {
    if (cancelled || index >= notes.length) return
    playNote(notes[index], noteSeconds * 0.9)
    index++
    timer = window.setTimeout(step, noteSeconds * 1000)
  }

  let timer = window.setTimeout(step, 0)

  return () => {
    cancelled = true
    window.clearTimeout(timer)
  }
}
