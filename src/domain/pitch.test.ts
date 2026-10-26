import { describe, expect, it } from 'vitest'
import type { Instrument } from '@/instruments/types'
import { detectPitch, hzToWritten, NoteStabiliser } from './pitch'

const RATE = 44100

function tone(hz: number, shape: 'sine' | 'saw' = 'sine', length = 4096, amplitude = 0.5): Float32Array {
  const out = new Float32Array(length)
  for (let i = 0; i < length; i++) {
    const phase = (i * hz) / RATE
    out[i] = amplitude * (shape === 'sine' ? Math.sin(2 * Math.PI * phase) : 2 * (phase - Math.floor(phase + 0.5)))
  }
  return out
}

const cents = (a: number, b: number) => 1200 * Math.log2(a / b)

/** Only `transposeSemitones` matters to the conversion. */
const instrument = (transposeSemitones: number) => ({ transposeSemitones }) as Instrument

describe('detectPitch', () => {
  it.each([
    ['flute low C', 261.63, 'sine'],
    ['flute A4', 440, 'sine'],
    ['flute high C', 2093, 'sine'],
    ['tenor sax low', 103.83, 'saw'],
    ['alto sax middle', 311.13, 'saw'],
  ] as const)('finds %s within 5 cents', (_name, hz, shape) => {
    const reading = detectPitch(tone(hz, shape), RATE)
    expect(reading).not.toBeNull()
    expect(Math.abs(cents(reading!.hz, hz))).toBeLessThan(5)
    expect(reading!.clarity).toBeGreaterThan(0.8)
  })

  it('reports silence as nothing', () => {
    expect(detectPitch(new Float32Array(4096), RATE)).toBeNull()
    expect(detectPitch(tone(440, 'sine', 4096, 0.001), RATE)).toBeNull()
  })

  it('reports noise as nothing', () => {
    let seed = 7
    const noise = new Float32Array(4096).map(() => {
      seed = (seed * 16807) % 2147483647
      return (seed / 2147483647 - 0.5) * 0.8
    })
    expect(detectPitch(noise, RATE)).toBeNull()
  })
})

describe('hzToWritten', () => {
  it('names concert pitch on a C instrument', () => {
    expect(hzToWritten(440, instrument(0))).toEqual({ note: 'A4', midi: 69, cents: 0 })
  })

  it('applies the transposition of an E♭ alto sax', () => {
    // Concert C5 is written A5 on an alto (sounds a major sixth lower).
    expect(hzToWritten(523.25, instrument(-9)).note).toBe('A5')
  })

  it('applies the transposition of a B♭ tenor sax', () => {
    // Concert B♭3 is written C5 on a tenor (sounds a major ninth lower).
    expect(hzToWritten(233.08, instrument(-14)).note).toBe('C5')
  })

  it('reports the tuning offset in cents', () => {
    const sharp = 440 * 2 ** (12 / 1200)
    expect(hzToWritten(sharp, instrument(0))).toMatchObject({ note: 'A4', cents: 12 })
    const flat = 440 * 2 ** (-30 / 1200)
    expect(hzToWritten(flat, instrument(0))).toMatchObject({ note: 'A4', cents: -30 })
  })
})

describe('NoteStabiliser', () => {
  it('confirms a note only after it is held', () => {
    const s = new NoteStabiliser(150)
    expect(s.push(69, 0)).toBeNull()
    expect(s.push(69, 100)).toBeNull()
    expect(s.push(69, 160)).toBe(69)
  })

  it('restarts the clock when the note changes or drops out', () => {
    const s = new NoteStabiliser(150)
    s.push(69, 0)
    expect(s.push(70, 120)).toBeNull()
    expect(s.push(70, 200)).toBeNull()
    expect(s.push(null, 280)).toBeNull()
    expect(s.push(70, 300)).toBeNull()
    expect(s.push(70, 460)).toBe(70)
  })
})
