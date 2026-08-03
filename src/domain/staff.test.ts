import { describe, expect, it } from 'vitest'
import { Note } from 'tonal'
import { diatonicAtStaffPosition, staffPosition } from './staff'
import { noteRange } from './lookup'

describe('staffPosition', () => {
  it('places E4 on the bottom line', () => {
    expect(staffPosition('E4')).toMatchObject({ relative: 0, onLine: true, ledgerBelow: 0, ledgerAbove: 0 })
  })

  it('places F5 on the top line', () => {
    expect(staffPosition('F5')).toMatchObject({ relative: 8, onLine: true, ledgerBelow: 0, ledgerAbove: 0 })
  })

  it('does not move a note for its spelling — F#5 and F5 share a height', () => {
    expect(staffPosition('F#5')!.relative).toBe(staffPosition('F5')!.relative)
    expect(staffPosition('F#5')!.accidental).toBe('#')
    expect(staffPosition('F5')!.accidental).toBe('')
  })

  it('gives middle C one ledger line, sitting on it', () => {
    expect(staffPosition('C4')).toMatchObject({ relative: -2, onLine: true, ledgerBelow: 1 })
  })

  it('needs no ledger line for the space just below the staff', () => {
    expect(staffPosition('D4')).toMatchObject({ relative: -1, onLine: false, ledgerBelow: 0 })
  })

  it('still needs the nearest ledger line for a note past it, in the space beyond', () => {
    // B3 is one step below middle C: the C4 ledger line is drawn, B3 hangs below it.
    expect(staffPosition('B3')).toMatchObject({ relative: -3, onLine: false, ledgerBelow: 1 })
  })

  it('needs no ledger line for the space just above the staff', () => {
    expect(staffPosition('G5')).toMatchObject({ relative: 9, onLine: false, ledgerAbove: 0 })
  })

  it('gives A5 one ledger line above the staff', () => {
    expect(staffPosition('A5')).toMatchObject({ relative: 10, onLine: true, ledgerAbove: 1 })
  })

  it('accumulates ledger lines further out', () => {
    expect(staffPosition('C7')).toMatchObject({ relative: 19, ledgerAbove: Math.floor((19 - 8) / 2) })
  })

  it('returns null for an unparseable note', () => {
    expect(staffPosition('not-a-note')).toBeNull()
  })
})

describe('diatonicAtStaffPosition', () => {
  it('puts the bottom line at E4 and the top line at F5', () => {
    expect(diatonicAtStaffPosition(0)).toEqual({ letter: 'E', octave: 4 })
    expect(diatonicAtStaffPosition(8)).toEqual({ letter: 'F', octave: 5 })
  })

  it('gives middle C for the first ledger line below', () => {
    expect(diatonicAtStaffPosition(-2)).toEqual({ letter: 'C', octave: 4 })
  })

  it('crosses the octave boundary at C, not at A', () => {
    // B3 then C4: the octave number must increment between them.
    expect(diatonicAtStaffPosition(-3)).toEqual({ letter: 'B', octave: 3 })
    expect(diatonicAtStaffPosition(-2)).toEqual({ letter: 'C', octave: 4 })
  })

  it('round-trips against staffPosition for every note in the flute range', () => {
    // The cheap guard against a sign or offset error between the two directions.
    for (const { note } of noteRange({ footJoint: 'B', openHole: true })) {
      const position = staffPosition(note)!
      const back = diatonicAtStaffPosition(position.relative)
      const parsed = Note.get(note)
      expect(`${back.letter}${back.octave}`).toBe(`${parsed.letter}${parsed.oct}`)
    }
  })

  it('ignores spelling — a sharp and its natural share a staff position', () => {
    expect(diatonicAtStaffPosition(staffPosition('F#5')!.relative)).toEqual(
      diatonicAtStaffPosition(staffPosition('F5')!.relative),
    )
  })
})
