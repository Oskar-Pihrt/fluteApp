import { describe, expect, it } from 'vitest'
import { Note } from 'tonal'
import { keySetId, keysInGroup } from '@/domain/keys'
import { type Instrument, INSTRUMENTS } from '@/instruments'

/**
 * Guards on the fingering databases. These catch transcription slips — the
 * failure mode that matters most, since a wrong fingering is silently
 * plausible to anyone who can't already play the note.
 */

/** Written range each instrument's data is meant to cover. */
const RANGES: Record<Instrument['id'], [string, string]> = {
  flute: ['B3', 'C7'],
  tenorSax: ['A#3', 'F#6'],
}

describe.each(Object.values(INSTRUMENTS))('$name fingering database', (instrument) => {
  const [low, high] = RANGES[instrument.id].map((n) => Note.midi(n)!)
  const fingerings = instrument.fingerings

  it('covers every chromatic note in its range', () => {
    const covered = new Set(fingerings.map((f) => f.midi))
    const missing: number[] = []
    for (let midi = low; midi <= high; midi++) {
      if (!covered.has(midi)) missing.push(midi)
    }
    expect(missing.map((m) => Note.fromMidiSharps(m))).toEqual([])
  })

  it('has nothing outside its range', () => {
    expect(fingerings.filter((f) => f.midi < low || f.midi > high).map((f) => f.id)).toEqual([])
  })

  it('gives every note exactly one primary fingering', () => {
    const primaryCounts = new Map<number, number>()
    for (const fingering of fingerings) {
      if (fingering.kind !== 'primary') continue
      primaryCounts.set(fingering.midi, (primaryCounts.get(fingering.midi) ?? 0) + 1)
    }
    const offenders: string[] = []
    for (let midi = low; midi <= high; midi++) {
      const count = primaryCounts.get(midi) ?? 0
      if (count !== 1) offenders.push(`${Note.fromMidiSharps(midi)}: ${count}`)
    }
    expect(offenders).toEqual([])
  })

  it('has no duplicate note + key-set pairs', () => {
    const seen = new Set<string>()
    const duplicates: string[] = []
    for (const fingering of fingerings) {
      const signature = `${fingering.note} ${keySetId(fingering.keys)}`
      if (seen.has(signature)) duplicates.push(signature)
      seen.add(signature)
    }
    expect(duplicates).toEqual([])
  })

  it('has unique ids', () => {
    const ids = fingerings.map((f) => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('only uses keys the instrument has, and records requirements for the optional ones', () => {
    const byId = new Map(instrument.keys.map((k) => [k.id, k]))
    for (const fingering of fingerings) {
      for (const id of fingering.keys) {
        const key = byId.get(id)
        expect(key, `${fingering.id} uses unknown key ${id}`).toBeDefined()
        if (key?.requires) expect(fingering.requires).toContain(key.requires)
      }
    }
  })

  it('never presses two keys the same finger would have to share', () => {
    for (const fingering of fingerings) {
      for (const group of instrument.exclusiveGroups) {
        const held = keysInGroup(instrument.keys, group).filter((key) =>
          fingering.keys.includes(key),
        )
        expect(held.length, `${fingering.id} holds ${held.join(' + ')}`).toBeLessThanOrEqual(1)
      }
    }
  })

  it('draws every key', () => {
    const undrawn = instrument.keys.filter((k) => !instrument.chart.drawings[k.id]).map((k) => k.id)
    expect(undrawn).toEqual([])
  })
})

describe('flute specifics', () => {
  it('flags B-footjoint fingerings consistently', () => {
    for (const fingering of INSTRUMENTS.flute.fingerings) {
      const usesBFootKeys = fingering.keys.includes('FOOT_B') || fingering.keys.includes('GIZMO')
      expect(fingering.requires.includes('bFoot')).toBe(usesBFootKeys)
    }
  })
})

describe('tenor sax specifics', () => {
  it('needs the high F♯ key for F♯6 and nothing else', () => {
    const needing = INSTRUMENTS.tenorSax.fingerings.filter((f) => f.requires.includes('highFSharp'))
    expect(needing.map((f) => f.note)).toEqual(['F#6'])
  })
})
