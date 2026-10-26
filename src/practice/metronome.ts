import { audioContext, playClick } from '@/domain/audio'

/** How far ahead clicks are put on the audio clock, and how often the queue is topped up. */
const LOOKAHEAD_S = 0.2
const TICK_MS = 50

export interface Metronome {
  /** Audio-clock time of beat `i` (0 = the first click). */
  beatTime(i: number): number
  /** Beat index nearest to audio-clock time `t`, and how far off it was, in beats (−0.5…0.5). */
  nearestBeat(t: number): { beat: number; offset: number }
  stop(): void
}

/**
 * Clicks scheduled on the audio clock, so the beat stays steady however busy
 * the main thread is. `onBeat` fires (roughly) as each beat sounds, for lights.
 */
export function startMetronome(bpm: number, beatsPerBar = 4, onBeat?: (beat: number) => void): Metronome | null {
  const context = audioContext()
  if (!context) return null
  if (context.state === 'suspended') void context.resume()
  const interval = 60 / bpm
  const start = context.currentTime + 0.1
  let next = 0
  const timers: number[] = []

  const timer = window.setInterval(() => {
    while (start + next * interval < context.currentTime + LOOKAHEAD_S) {
      const when = start + next * interval
      playClick(when, next % beatsPerBar === 0)
      const beat = next
      timers.push(window.setTimeout(() => onBeat?.(beat), Math.max(0, (when - context.currentTime) * 1000)))
      next++
    }
  }, TICK_MS)

  return {
    beatTime: (i) => start + i * interval,
    nearestBeat(t) {
      const exact = (t - start) / interval
      const beat = Math.round(exact)
      return { beat, offset: exact - beat }
    },
    stop() {
      window.clearInterval(timer)
      timers.forEach((t) => window.clearTimeout(t))
    },
  }
}
