import { describe, expect, it } from 'vitest'
import { noteRange } from '@/domain/lookup'
import { FLUTE } from '@/instruments'
import { recognise } from './recognise'
import { renderScore, type SyntheticNote } from './testing/render'
import { lettersAlteredBy } from './pitch'

const PLAYABLE = noteRange({ instrument: FLUTE, config: ['bFoot'] }).map((entry) => entry.note)

const SPACE = 18
const TOP = 90

/** One staff, notes at the given x positions, optional key signature and barlines. */
function page(
  notes: SyntheticNote[],
  extras: {
    keySignature?: { kind: '#' | 'b'; count: number }
    barlines?: number[]
  } = {},
) {
  const width = 140 + notes.length * 70 + (extras.keySignature?.count ?? 0) * 20
  return renderScore({
    width,
    height: 300,
    staves: [{ top: TOP, spaceHeight: SPACE, x0: 20, x1: width - 20 }],
    keySignature: extras.keySignature ? { ...extras.keySignature, staffIndex: 0 } : undefined,
    barlines: extras.barlines?.map((x) => ({ x, staffIndex: 0 })),
    notes,
  })
}

function read(bitmap: ReturnType<typeof page>) {
  return recognise(bitmap, { playableNotes: PLAYABLE }).result
}

/** Notes laid out left to right starting well clear of the clef. */
function sequence(relatives: number[], accidentals: (SyntheticNote['accidental'] | undefined)[] = []) {
  return relatives.map((relative, i) => ({
    x: 170 + i * 70,
    staffIndex: 0,
    relative,
    accidental: accidentals[i],
  }))
}

describe('lettersAlteredBy', () => {
  it('follows the conventional order of sharps', () => {
    expect([...lettersAlteredBy({ kind: '#', count: 3 }).keys()]).toEqual(['F', 'C', 'G'])
  })

  it('follows the conventional order of flats', () => {
    expect([...lettersAlteredBy({ kind: 'b', count: 2 }).keys()]).toEqual(['B', 'E'])
  })

  it('alters nothing in C major', () => {
    expect(lettersAlteredBy({ kind: '#', count: 0 }).size).toBe(0)
  })
})

describe('accidentals and key signatures', () => {
  it('applies a printed sharp to its own note', () => {
    // relative 2 = G4, sharpened.
    const result = read(page(sequence([2], ['#'])))
    expect(result.notes.map((n) => n.note)).toEqual(['G#4'])
  })

  it('applies a printed flat to its own note', () => {
    // relative 4 = B4, flattened.
    const result = read(page(sequence([4], ['b'])))
    expect(result.notes.map((n) => n.note)).toEqual(['Bb4'])
  })

  it('carries a printed accidental across later notes in the same measure', () => {
    // G#4, then G4 written plain — still sharp, by convention.
    const result = read(page(sequence([2, 4, 2], ['#'])))
    expect(result.notes.map((n) => n.note)).toEqual(['G#4', 'B4', 'G#4'])
  })

  it('resets accidentals after a barline', () => {
    // G#4 | G4 — the barline cancels the sharp.
    const notes = sequence([2, 2])
    notes[0].accidental = '#'
    const barX = (notes[0].x + notes[1].x) / 2
    const result = read(page(notes, { barlines: [barX] }))
    expect(result.notes.map((n) => n.note)).toEqual(['G#4', 'G4'])
  })

  it('applies a key signature to every octave of the letter', () => {
    // One sharp (F#). relative 1 = F4, relative 8 = F5 — both sharp.
    const result = read(page(sequence([1, 8]), { keySignature: { kind: '#', count: 1 } }))
    expect(result.keySignature).toEqual({ kind: '#', count: 1 })
    expect(result.notes.map((n) => n.note)).toEqual(['F#4', 'F#5'])
  })

  it('reads a flat key signature', () => {
    // One flat (Bb). relative 4 = B4.
    const result = read(page(sequence([4, 2]), { keySignature: { kind: 'b', count: 1 } }))
    expect(result.keySignature).toEqual({ kind: 'b', count: 1 })
    expect(result.notes.map((n) => n.note)).toEqual(['Bb4', 'G4'])
  })

  it('does not mistake key-signature accidentals for notes', () => {
    const result = read(page(sequence([2, 4]), { keySignature: { kind: '#', count: 3 } }))
    expect(result.notes.length).toBe(2)
  })

  it('leaves letters the key does not alter alone', () => {
    // Two sharps (F#, C#). relative 2 = G4 — untouched.
    const result = read(page(sequence([2]), { keySignature: { kind: '#', count: 2 } }))
    expect(result.notes.map((n) => n.note)).toEqual(['G4'])
  })

  it('numbers measures from the barlines', () => {
    const notes = sequence([2, 4, 6])
    const result = read(page(notes, { barlines: [(notes[0].x + notes[1].x) / 2] }))
    expect(result.notes[0].measureIndex).toBe(0)
    expect(result.notes[1].measureIndex).toBe(1)
    expect(result.notes[2].measureIndex).toBe(1)
  })

  it('reports the printed accidental separately from the resulting pitch', () => {
    // With a key signature, the pitch is altered but nothing was printed.
    const result = read(page(sequence([1]), { keySignature: { kind: '#', count: 1 } }))
    expect(result.notes[0].note).toBe('F#4')
    expect(result.notes[0].accidental).toBe('')
  })
})

describe('out-of-range reporting', () => {
  it('flags notes below the flute range instead of accepting them silently', () => {
    // relative -8 is E3, a fifth below the flute's lowest note.
    const result = read(page(sequence([-8])))
    const warning = result.warnings.find((w) => w.code === 'out-of-range')
    expect(warning).toBeDefined()
    expect(warning!.noteIndices).toEqual([0])
  })

  it('does not flag notes inside the range', () => {
    const result = read(page(sequence([0, 4, 8])))
    expect(result.warnings.find((w) => w.code === 'out-of-range')).toBeUndefined()
  })
})
