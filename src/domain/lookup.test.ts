import { describe, expect, it } from 'vitest'
import { FLUTE, TENOR_SAX } from '@/instruments'
import { FLUTE_GRAMMAR } from '@/instruments/flute/fingerings'
import { parseFingeringCode as parse } from './fingering'
import {
  fingeringsForNote,
  nearestFingerings,
  noteFrequency,
  noteRange,
  notesForKeys,
  soundingNote,
} from './lookup'

const C_FOOT = { instrument: FLUTE, config: [] } as const
const B_FOOT = { instrument: FLUTE, config: ['bFoot'] } as const
const SAX = { instrument: TENOR_SAX, config: ['highFSharp'] } as const
const SAX_NO_HIGH_F = { instrument: TENOR_SAX, config: [] } as const

const parseFingeringCode = (code: string) => parse(code, FLUTE_GRAMMAR)

describe('parseFingeringCode', () => {
  it('reads a full fingering', () => {
    expect(parseFingeringCode('T 123 G# | 123 Eb')).toEqual({
      keys: ['THUMB_B', 'L1', 'L2', 'L3', 'L_GSHARP', 'R1', 'R2', 'R3', 'R_EFLAT'],
      vented: [],
    })
  })

  it('reads an all-open fingering', () => {
    expect(parseFingeringCode('- --- | --- Eb')).toEqual({ keys: ['R_EFLAT'], vented: [] })
  })

  it('treats B in the thumb slot as the B-natural lever, not the foot key', () => {
    expect(parseFingeringCode('B 1-- | --- Eb').keys).toEqual(['THUMB_B', 'L1', 'R_EFLAT'])
  })

  it('treats B in the right-hand slot as the low-B foot key', () => {
    expect(parseFingeringCode('T 123 | 123 B').keys).toContain('FOOT_B')
  })

  it('records a 0 position as vented rather than pressed', () => {
    const parsed = parseFingeringCode('T 1-0 | --- Eb')
    expect(parsed.keys).toEqual(['THUMB_B', 'L1', 'R_EFLAT'])
    expect(parsed.vented).toEqual(['L3'])
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

  it('leaves flute pitches alone', () => {
    expect(soundingNote('D5', FLUTE)).toBe('D5')
  })

  it('gives the sounding frequency', () => {
    // Written A5 sounds G4.
    expect(noteFrequency('A5', TENOR_SAX)).toBeCloseTo(391.995, 2)
    expect(noteFrequency('A4', FLUTE)).toBeCloseTo(440, 5)
  })
})
