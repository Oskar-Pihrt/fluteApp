import { audioContext } from './audio'
import { RANGE } from './earTraining'

/**
 * Sampled piano for the ear trainer.
 *
 * Unlike the preview synth, ear training needs a real, recognisable timbre —
 * a triangle wave makes every pitch sound alike. The samples are one short
 * render per semitone over the trainer's range (see
 * scripts/render-piano-samples.mjs), about 1 MB in total, so they are fetched
 * and decoded up front and played without any pitch shifting.
 */

const buffers = new Map<number, AudioBuffer>()
let loading: Promise<void> | null = null
const active = new Set<{ source: AudioBufferSourceNode; gain: GainNode }>()

const RELEASE_SECONDS = 0.15
const PEAK = 0.9

function sampleUrl(midi: number): string {
  return `${import.meta.env.BASE_URL}samples/piano/${midi}.m4a`
}

/** Fetch and decode every sample once; later calls share the same promise. */
export function loadPiano(): Promise<void> {
  if (loading) return loading
  const context = audioContext()
  if (!context) return Promise.reject(new Error('Web Audio is not supported'))

  const midis = Array.from({ length: RANGE.high - RANGE.low + 1 }, (_, i) => RANGE.low + i)
  loading = Promise.all(
    midis.map(async (midi) => {
      const response = await fetch(sampleUrl(midi))
      if (!response.ok) throw new Error(`Missing piano sample ${midi}`)
      buffers.set(midi, await context.decodeAudioData(await response.arrayBuffer()))
    }),
  ).then(() => undefined)
  // A failed load (offline before first cache) can be retried.
  loading.catch(() => {
    loading = null
  })
  return loading
}

export function pianoLoaded(): boolean {
  return buffers.size === RANGE.high - RANGE.low + 1
}

/**
 * Play one sample. `when` is seconds from now; `duration` cuts the note short
 * with a quick release, so sequences don't smear into each other.
 */
export function playPiano(midi: number, { when = 0, duration }: { when?: number; duration?: number } = {}): void {
  const context = audioContext()
  const buffer = buffers.get(midi)
  if (!context || !buffer) return
  if (context.state === 'suspended') void context.resume()

  const start = context.currentTime + when
  const source = context.createBufferSource()
  const gain = context.createGain()
  source.buffer = buffer
  gain.gain.setValueAtTime(PEAK, start)
  source.connect(gain).connect(context.destination)
  source.start(start)
  if (duration != null && duration < buffer.duration) {
    gain.gain.setValueAtTime(PEAK, start + duration)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration + RELEASE_SECONDS)
    source.stop(start + duration + RELEASE_SECONDS + 0.02)
  }

  const entry = { source, gain }
  active.add(entry)
  source.onended = () => active.delete(entry)
}

/**
 * Play notes one after another, scheduled on the audio clock so the gaps are
 * exact even when the main thread is busy.
 */
export function playPianoSequence(midis: readonly number[], gapSeconds = 0.9): void {
  midis.forEach((midi, i) => {
    const last = i === midis.length - 1
    playPiano(midi, { when: i * gapSeconds, duration: last ? undefined : gapSeconds })
  })
}

/** Silence everything, with a short fade rather than a click. */
export function stopAllPiano(): void {
  const context = audioContext()
  if (!context) return
  const now = context.currentTime
  for (const { source, gain } of active) {
    gain.gain.cancelScheduledValues(now)
    gain.gain.setValueAtTime(gain.gain.value, now)
    gain.gain.linearRampToValueAtTime(0, now + 0.05)
    try {
      source.stop(now + 0.06)
    } catch {
      // Already stopped.
    }
  }
  active.clear()
}
