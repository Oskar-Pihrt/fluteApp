import { describe, expect, it } from 'vitest'
import { Note } from 'tonal'
import { loadInstrument } from '@/instruments'
import { FLUTE_GRAMMAR } from '@/instruments/flute/fingerings'
import { FLUTE_KEY_IDS } from '@/instruments/flute/keys'
import { parseFingeringCode as parse } from './fingering'
import {
  fingeringsForNote,
  nearestFingerings,
  noteFrequency,
  noteRange,
  notesForKeys,
  soundingNote,
  transposeBetween,
} from './lookup'

const FLUTE = await loadInstrument('flute')
const ALTO_SAX = await loadInstrument('altoSax')
const TENOR_SAX = await loadInstrument('tenorSax')

const C_FOOT = { instrument: FLUTE, config: [] } as const
const B_FOOT = { instrument: FLUTE, config: ['bFoot'] } as const
const SAX = { instrument: TENOR_SAX, config: ['highFSharp'] } as const
const SAX_NO_HIGH_F = { instrument: TENOR_SAX, config: [] } as const

const parseFingeringCode = (code: string) => parse(code, FLUTE_GRAMMAR, FLUTE_KEY_IDS)

describe('parseFingeringCode', () => {
  it('reads a full fingering', () => {
    expect(parseFingeringCode('T 123 G# | 123 Eb')).toEqual({
      keys: ['THUMB_B', 'L1', 'L2', 'L3', 'L_GSHARP', 'R1', 'R2', 'R3', 'R_EFLAT'],
      partial: [],
    })
  })

  it('reads an all-open fingering', () => {
    expect(parseFingeringCode('- --- | --- Eb')).toEqual({ keys: ['R_EFLAT'], partial: [] })
  })

  it('treats B in the thumb slot as the B-natural lever, not the foot key', () => {
    expect(parseFingeringCode('B 1-- | --- Eb').keys).toEqual(['THUMB_B', 'L1', 'R_EFLAT'])
  })

  it('treats B in the right-hand slot as the low-B foot key', () => {
    expect(parseFingeringCode('T 123 | 123 B').keys).toContain('FOOT_B')
  })

  it('records a 0 position as partial rather than pressed', () => {
    const parsed = parseFingeringCode('T 1-0 | --- Eb')
    expect(parsed.keys).toEqual(['THUMB_B', 'L1', 'R_EFLAT'])
    expect(parsed.partial).toEqual(['L3'])
  })

  it('rejects a digit in the wrong position', () => {
    expect(() => parseFingeringCode('T 132 | --- Eb')).toThrow(/position/)
  })

  it('rejects an unknown key token', () => {
    expect(() => parseFingeringCode('T 123 | --- Xx')).toThrow(/Unknown key token/)
  })

  it('rejects a code without a hand separator', () => {
    expect(() => parseFingeringCode('T 123 123 Eb')).toThrow(/separator/)
  })

  // A whistle-like grammar: no thumb, four holes under the right hand.
  const HOLES = {
    leftStack: ['H1', 'H2', 'H3'],
    rightStack: ['H4', 'H5', 'H6', 'H7'],
    leftAux: {},
    rightAux: {},
  }
  const ORDER = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'H7']

  it('reads a code with no thumb and a four-hole group', () => {
    expect(parse('12- | 1234', HOLES, ORDER)).toEqual({
      keys: ['H1', 'H2', 'H4', 'H5', 'H6', 'H7'],
      partial: [],
    })
  })

  it('records an h position as a half-covered hole', () => {
    expect(parse('123 | 12h-', HOLES, ORDER)).toEqual({
      keys: ['H1', 'H2', 'H3', 'H4', 'H5'],
      partial: ['H6'],
    })
  })

  it('rejects a group of the wrong length', () => {
    expect(() => parse('123 | 123', HOLES, ORDER)).toThrow(/4 positions/)
  })
})

describe('notesForKeys', () => {
  it('returns both octaves for a fingering shared between them', () => {
    // E4 and E5 are the same fingering; feature 1 must report both.
    const matches = notesForKeys(['THUMB_B', 'L1', 'L2', 'L3', 'R1', 'R2', 'R_EFLAT'], C_FOOT)
    expect(matches.map((m) => m.note)).toEqual(['E4', 'E5'])
  })

  it('is order-independent', () => {
    const a = notesForKeys(['R_EFLAT', 'L1', 'THUMB_B'], C_FOOT)
    const b = notesForKeys(['THUMB_B', 'L1', 'R_EFLAT'], C_FOOT)
    expect(a.map((m) => m.id)).toEqual(b.map((m) => m.id))
  })

  it('returns nothing for a combination no note uses', () => {
    expect(notesForKeys(['L_GSHARP', 'TRILL_D', 'TRILL_DSHARP'], C_FOOT)).toEqual([])
  })

  it('hides low B on a C-footjoint flute and shows it on a B foot', () => {
    const lowB = ['THUMB_B', 'L1', 'L2', 'L3', 'R1', 'R2', 'R3', 'FOOT_B'] as const
    expect(notesForKeys(lowB, C_FOOT)).toEqual([])
    expect(notesForKeys(lowB, B_FOOT).map((m) => m.note)).toEqual(['B3'])
  })
})

describe('nearestFingerings', () => {
  it('ranks a one-key-off selection first', () => {
    // G4 is "T 123 | --- Eb"; drop the Eb key and G4 should be the top suggestion.
    const suggestions = nearestFingerings(['THUMB_B', 'L1', 'L2', 'L3'], C_FOOT)
    expect(suggestions[0].distance).toBe(1)
    expect(suggestions.map((s) => s.fingering.note)).toContain('G4')
  })

  it('never suggests the exact fingering itself', () => {
    const keys = ['THUMB_B', 'L1', 'L2', 'L3', 'R_EFLAT'] as const
    expect(nearestFingerings(keys, C_FOOT).every((s) => s.distance > 0)).toBe(true)
  })

  it('offers each note at most once', () => {
    const suggestions = nearestFingerings(['THUMB_B', 'L1'], C_FOOT, 6)
    const notes = suggestions.map((s) => s.fingering.note)
    expect(new Set(notes).size).toBe(notes.length)
  })
})

describe('fingeringsForNote', () => {
  it('lists the primary fingering first', () => {
    const options = fingeringsForNote('A#4', C_FOOT)
    expect(options.length).toBeGreaterThan(1)
    expect(options[0].kind).toBe('primary')
  })

  it('accepts a flat spelling of the same pitch', () => {
    expect(fingeringsForNote('Bb4', C_FOOT).map((f) => f.id)).toEqual(
      fingeringsForNote('A#4', C_FOOT).map((f) => f.id),
    )
  })

  it('returns nothing for a pitch outside the flute range', () => {
    expect(fingeringsForNote('C2', C_FOOT)).toEqual([])
  })
})

describe('noteRange', () => {
  it('starts at C4 on a C foot and B3 on a B foot', () => {
    expect(noteRange(C_FOOT)[0].note).toBe('C4')
    expect(noteRange(B_FOOT)[0].note).toBe('B3')
  })

  it('is chromatic and strictly ascending', () => {
    const range = noteRange(B_FOOT)
    for (let i = 1; i < range.length; i++) {
      expect(range[i].midi).toBe(range[i - 1].midi + 1)
    }
  })
})

describe('tenor sax', () => {
  it('reads open keys as written C♯5', () => {
    expect(notesForKeys([], SAX).map((m) => m.note)).toEqual(['C#5'])
  })

  it('adds the octave key an octave up', () => {
    const matches = notesForKeys(['OCTAVE', 'L1', 'L2', 'L3', 'R1', 'R2', 'R3'], SAX)
    expect(matches.map((m) => m.note)).toEqual(['D5'])
  })

  it('offers bis, one-and-one and side fingerings for B♭', () => {
    const options = fingeringsForNote('A#4', SAX)
    expect(options.map((f) => f.kind)).toEqual(['primary', 'alternate', 'alternate'])
    expect(options[0].keys).toEqual(['L1', 'BIS'])
    expect(options.map((f) => f.keys)).toContainEqual(['L1', 'R1'])
    expect(options.map((f) => f.keys)).toContainEqual(['L1', 'SIDE_BB'])
  })

  it('hides F♯6 without a high F♯ key', () => {
    expect(noteRange(SAX).at(-1)!.note).toBe('F#6')
    expect(noteRange(SAX_NO_HIGH_F).at(-1)!.note).toBe('F6')
  })

  it('starts at written B♭3', () => {
    expect(noteRange(SAX)[0].note).toBe('A#3')
  })

  it('does not match flute fingerings', () => {
    expect(notesForKeys(['THUMB_B', 'L1', 'R_EFLAT'], SAX)).toEqual([])
  })
})

describe('transposition', () => {
  it('sounds a major ninth below written on tenor sax', () => {
    expect(soundingNote('D5', TENOR_SAX)).toBe('C4')
    expect(soundingNote('C#5', TENOR_SAX)).toBe('B3')
  })

  it('sounds a major sixth below written on alto sax', () => {
    expect(soundingNote('C5', ALTO_SAX)).toBe('Eb4')
    expect(soundingNote('A4', ALTO_SAX)).toBe('C4')
  })

  it('leaves flute pitches alone', () => {
    expect(soundingNote('D5', FLUTE)).toBe('D5')
  })

  it('gives the sounding frequency', () => {
    // Written A5 sounds G4.
    expect(noteFrequency('A5', TENOR_SAX)).toBeCloseTo(391.995, 2)
    expect(noteFrequency('A4', FLUTE)).toBeCloseTo(440, 5)
  })
})

describe('transposeBetween', () => {
  it('writes a flute part for alto at the same sounding pitch', () => {
    expect(transposeBetween('C5', FLUTE, ALTO_SAX)).toBe('A5')
    expect(transposeBetween('F#4', FLUTE, ALTO_SAX)).toBe('D#5')
  })

  it('writes a flute part for tenor a ninth up', () => {
    expect(transposeBetween('C5', FLUTE, TENOR_SAX)).toBe('D6')
  })

  it('moves between saxophones by a fourth', () => {
    expect(transposeBetween('D5', ALTO_SAX, TENOR_SAX)).toBe('G5')
    expect(transposeBetween('G5', TENOR_SAX, ALTO_SAX)).toBe('D5')
  })

  it('round-trips', () => {
    for (const note of ['C5', 'F#4', 'Bb4', 'E5']) {
      const there = transposeBetween(note, FLUTE, ALTO_SAX)!
      expect(Note.midi(transposeBetween(there, ALTO_SAX, FLUTE)!)).toBe(Note.midi(note))
    }
  })

  it('simplifies double accidentals and E♯-style spellings', () => {
    expect(transposeBetween('G#4', FLUTE, ALTO_SAX)).toBe('F5')
    expect(transposeBetween('A#4', FLUTE, ALTO_SAX)).toBe('G5')
  })

  it('leaves a note alone between same-pitch instruments', () => {
    expect(transposeBetween('C5', FLUTE, FLUTE)).toBe('C5')
  })
})

const RECORDER = { instrument: await loadInstrument('recorderSopranoBaroque'), config: [] } as const
const ALTO_RECORDER = { instrument: await loadInstrument('recorderAltoBaroque'), config: [] } as const

describe('half-covered holes', () => {
  it('tells a pinched thumb from an open one', () => {
    const hand = ['L1', 'L2']
    expect(notesForKeys(hand, RECORDER).map((f) => f.note)).toEqual(['C#5'])
    expect(notesForKeys(hand, RECORDER, ['THUMB']).map((f) => f.note)).toEqual(['A5'])
  })

  it('tells the small hole of a double hole from the whole of it', () => {
    const fingers = ['THUMB', 'L1', 'L2', 'L3', 'R4', 'R5', 'R6']
    expect(notesForKeys(fingers, RECORDER, ['R7']).map((f) => f.note)).toEqual(['C#4'])
    expect(notesForKeys(fingers, RECORDER).map((f) => f.note)).toEqual(['D4'])
  })

  it('plays an F recorder’s fingering a fourth higher', () => {
    expect(notesForKeys(['THUMB', 'L1', 'L2', 'L3'], ALTO_RECORDER).map((f) => f.note)).toEqual(['C5'])
  })
})
