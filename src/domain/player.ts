import type { Instrument } from '@/instruments/types'
import type { Score } from '@/score/model'
import { timeAt } from '@/score/ops'
import { buildTimeline } from '@/score/timeline'
import { audioContext, playClick, playNote, type Voice } from './audio'

/**
 * Plays a score in tempo: notes scheduled on the audio clock (so timing
 * doesn't drift with the main thread), an optional metronome and count-in,
 * and a callback as each event starts, for the cursor.
 */

export interface PlayOptions {
  tempo: number
  metronome: boolean
  /** A measure of clicks before the music. */
  countIn: boolean
  /** Start at this event instead of the beginning. */
  startId?: string | null
  /** Called with each event's id as it starts, and with null at the end. */
  onEvent: (id: string | null) => void
}

export function playScore(score: Score, instrument: Instrument, options: PlayOptions): () => void {
  const context = audioContext()
  if (!context) {
    options.onEvent(null)
    return () => {}
  }
  if (context.state === 'suspended') void context.resume()

  const timeline = buildTimeline(score, options.tempo, options.startId)
  const voices: Voice[] = []
  const timers: number[] = []
  // A little headroom so the first note isn't scheduled in the past.
  let start = context.currentTime + 0.12

  if (options.countIn) {
    const signature = timeAt(score, 0)
    const beat = (60 / options.tempo) * (4 / signature.beatType)
    for (let i = 0; i < signature.beats; i++) {
      const voice = playClick(start + i * beat, i === 0)
      if (voice) voices.push(voice)
    }
    start += signature.beats * beat
  }

  if (options.metronome) {
    for (const beat of timeline.beats) {
      const voice = playClick(start + beat.time, beat.accent)
      if (voice) voices.push(voice)
    }
  }

  for (const event of timeline.events) {
    if (event.pitch && event.attack) {
      // Slightly detached, so repeated notes are heard as separate.
      const voice = playNote(event.pitch, instrument, Math.max(0.08, event.duration * 0.92), start + event.start)
      if (voice) voices.push(voice)
    }
    const delay = (start + event.start - context.currentTime) * 1000
    timers.push(window.setTimeout(() => options.onEvent(event.id), Math.max(0, delay)))
  }
  timers.push(
    window.setTimeout(() => options.onEvent(null), Math.max(0, (start + timeline.length - context.currentTime) * 1000)),
  )

  return () => {
    timers.forEach((timer) => window.clearTimeout(timer))
    voices.forEach((voice) => voice.stop())
    options.onEvent(null)
  }
}
