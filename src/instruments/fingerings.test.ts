import { describe, expect, it } from 'vitest'
import { Note } from 'tonal'
import { keySetId, keysInGroup } from '@/domain/keys'
import { CATALOG, type InstrumentId, loadInstrument } from '@/instruments'
import SAVED_IDS from './__fixtures__/saved-fingering-ids.json'

/**
 * Guards on the fingering databases. These catch transcription slips — the
 * failure mode that matters most, since a wrong fingering is silently
 * plausible to anyone who can't already play the note.
 */

const INSTRUMENTS = Object.fromEntries(
  await Promise.all((Object.keys(CATALOG) as InstrumentId[]).map(async (id) => [id, await loadInstrument(id)])),
) as Record<InstrumentId, Awaited<ReturnType<typeof loadInstrument>>>

describe.each(Object.values(INSTRUMENTS))('$name fingering database', (instrument) => {
  const [low, high] = instrument.expectedRange.map((n) => Note.midi(n)!)
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

  it('lists every key in its canonical order exactly once', () => {
    expect([...instrument.keyOrder].sort()).toEqual(instrument.keys.map((k) => k.id).sort())
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

describe.each([INSTRUMENTS.altoSax, INSTRUMENTS.tenorSax])('$name specifics', (sax) => {
  it('needs the high F♯ key for F♯6 and nothing else', () => {
    const needing = sax.fingerings.filter((f) => f.requires.includes('highFSharp'))
    expect(needing.map((f) => f.note)).toEqual(['F#6'])
  })
})

describe('saxophone family', () => {
  it('fingers every written note the same on alto and tenor', () => {
    const shape = (f: { note: string; kind: string; keys: readonly string[] }) =>
      `${f.note}:${f.kind}:${[...f.keys].sort().join(',')}`
    expect(INSTRUMENTS.altoSax.fingerings.map(shape)).toEqual(INSTRUMENTS.tenorSax.fingerings.map(shape))
  })

  it('keeps fingering ids unique across instruments', () => {
    const ids = Object.values(INSTRUMENTS).flatMap((i) => i.fingerings.map((f) => f.id))
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('saved sheets', () => {
  // Sheets store `chosenFingeringId`. Ids from before the instrument registry
  // must still resolve, or a player's chosen alternates silently revert.
  it('still recognise every fingering id they could have stored', () => {
    const ids = new Set(Object.values(INSTRUMENTS).flatMap((i) => i.fingerings.map((f) => f.id)))
    expect((SAVED_IDS as string[]).filter((id) => !ids.has(id))).toEqual([])
  })
})
