import { describe, expect, it } from 'vitest'
import { SCALE_TYPES, scaleNotes } from './scales'

const type = (id: string) => SCALE_TYPES.find((t) => t.id === id)!
const range = Array.from({ length: 25 }, (_, i) => 60 + i) // C4..C6

describe('scaleNotes', () => {
  it('lists C major across the range, tonics marked', () => {
    const notes = scaleNotes('C', type('major'), range)
    expect(notes.map((n) => n.note)).toEqual(['C4', 'D4', 'E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5', 'G5', 'A5', 'B5', 'C6'])
    expect(notes.filter((n) => n.isTonic).map((n) => n.midi)).toEqual([60, 72, 84])
  })

  it('spells flat keys with flats', () => {
    expect(scaleNotes('Db', type('major'), range).slice(0, 3).map((n) => n.note)).toEqual(['C4', 'Db4', 'Eb4'])
  })

  it('keeps the octave number with the letter', () => {
    const notes = scaleNotes('Gb', type('major'), [59, 60, 61])
    expect(notes.find((n) => n.midi === 59)?.note).toBe('Cb4')
  })

  it('avoids double accidentals', () => {
    const names = scaleNotes('Eb', type('blues'), range).map((n) => n.note)
    expect(names.some((n) => /bb|##/.test(n.slice(1)))).toBe(false)
    expect(names).toContain('A4')
  })

  it('has twelve notes per octave when chromatic', () => {
    expect(scaleNotes('C', type('chromatic'), range)).toHaveLength(25)
  })
})
