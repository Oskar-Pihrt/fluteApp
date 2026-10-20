import { describe, expect, it } from 'vitest'
import { DOUBLE_HORN_SPECS, EUPHONIUM_SPECS, HORN_F_SPECS, TROMBONE_SPECS, TRUMPET_SPECS } from './fingerings'
import type { FingeringSpec } from '@/domain/fingering'

/**
 * The brass tables are generated, so these pin the generator to the
 * standard charts every brass player learns.
 */

const primaries = (specs: FingeringSpec[]) =>
  Object.fromEntries(specs.filter((s) => s.kind === 'primary').map((s) => [s.note, s.code]))
const ways = (specs: FingeringSpec[], note: string) => specs.filter((s) => s.note === note).map((s) => s.code)

describe('trumpet', () => {
  it('matches the standard three-valve chart', () => {
    expect(primaries(TRUMPET_SPECS)).toEqual({
      'F#3': '123', G3: '13', 'G#3': '23', A3: '12', 'A#3': '1', B3: '2', C4: '0',
      'C#4': '123', D4: '13', 'D#4': '23', E4: '12', F4: '1', 'F#4': '2', G4: '0',
      'G#4': '23', A4: '12', 'A#4': '1', B4: '2', C5: '0',
      'C#5': '12', D5: '1', 'D#5': '2', E5: '0', F5: '1', 'F#5': '2', G5: '0',
      'G#5': '23', A5: '12', 'A#5': '1', B5: '2', C6: '0',
    })
  })

  it('offers valve 3 for 1 2, and higher-partial alternates', () => {
    expect(ways(TRUMPET_SPECS, 'A4')).toEqual(['12', '3'])
    expect(ways(TRUMPET_SPECS, 'E5')).toEqual(['0', '12', '3'])
  })
})

describe('euphonium', () => {
  it('reaches below F♯3 only with the fourth valve', () => {
    expect(primaries(EUPHONIUM_SPECS)).toMatchObject({ F3: '14', E3: '124', 'D#3': '234', D3: '134', 'C#3': '1234' })
  })

  it('offers the fourth valve as the alternate to 1 3', () => {
    expect(ways(EUPHONIUM_SPECS, 'G3')).toEqual(['13', '4'])
  })
})

describe('horn', () => {
  it('plays the third partial open and fills down to C♯ below it', () => {
    expect(primaries(HORN_F_SPECS)).toMatchObject({ G3: '0', 'F#3': '2', 'C#3': '123', C4: '0', D5: '0', F5: '1' })
  })

  it('matches the published single F horn chart', () => {
    expect(primaries(HORN_F_SPECS)).toMatchObject({
      'G#4': '23', A4: '12', 'A#4': '1', B4: '2', C5: '0', 'C#5': '2', D5: '0', 'D#5': '2', E5: '0',
      'F#5': '2', G5: '0', 'G#5': '23', A5: '12', 'A#5': '1', B5: '2', C6: '0',
    })
  })

  it('uses the B♭ side on the double horn where the chart does, keeping the F side as alternates', () => {
    expect(primaries(DOUBLE_HORN_SPECS)).toMatchObject({ D3: 'T 3', G4: '0', 'G#4': 'T 23', 'C#5': 'T 123' })
    expect(ways(DOUBLE_HORN_SPECS, 'C5')).toEqual(expect.arrayContaining(['T 0', '0']))
  })
})

describe('trombone', () => {
  it('matches the standard slide positions (treble clef B♭)', () => {
    expect(primaries(TROMBONE_SPECS)).toMatchObject({
      C4: 'P1', B3: 'P2', 'A#3': 'P3', A3: 'P4', 'G#3': 'P5', G3: 'P6', 'F#3': 'P7',
      G4: 'P1', F4: 'P3', E4: 'P4', D4: 'P6', 'C#4': 'P7',
    })
  })

  it('reaches the low register with the trigger, down to D but not C♯', () => {
    expect(primaries(TROMBONE_SPECS)).toMatchObject({ F3: 'F P3', D3: 'F P6' })
    expect(ways(TROMBONE_SPECS, 'C#3')).toEqual([])
  })
})
