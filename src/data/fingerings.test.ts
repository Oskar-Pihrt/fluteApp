import { describe, expect, it } from 'vitest'
import { Note } from 'tonal'
import { FINGERINGS } from './fingerings'
import { EXCLUSIVE_KEY_GROUPS, keySetId, keysInGroup } from '@/domain/keys'

/**
 * Guards on the fingering database itself. These catch transcription slips —
 * the failure mode that matters most, since a wrong fingering is silently
 * plausible to anyone who can't already play the note.
 */

const MIDI_LOW = Note.midi('B3')!
const MIDI_HIGH = Note.midi('C7')!

describe('fingering database', () => {
  it('covers every chromatic note from B3 to C7', () => {
    const covered = new Set(FINGERINGS.map((f) => f.midi))
    const missing: number[] = []
    for (let midi = MIDI_LOW; midi <= MIDI_HIGH; midi++) {
      if (!covered.has(midi)) missing.push(midi)
    }
    expect(missing.map((m) => Note.fromMidiSharps(m))).toEqual([])
  })

  it('gives every note exactly one primary fingering', () => {
    const primaryCounts = new Map<number, number>()
    for (const fingering of FINGERINGS) {
      if (fingering.kind !== 'primary') continue
      primaryCounts.set(fingering.midi, (primaryCounts.get(fingering.midi) ?? 0) + 1)
    }
    const offenders: string[] = []
    for (let midi = MIDI_LOW; midi <= MIDI_HIGH; midi++) {
      const count = primaryCounts.get(midi) ?? 0
      if (count !== 1) offenders.push(`${Note.fromMidiSharps(midi)}: ${count}`)
    }
    expect(offenders).toEqual([])
  })

  it('has no duplicate note + key-set pairs', () => {
    const seen = new Set<string>()
    const duplicates: string[] = []
    for (const fingering of FINGERINGS) {
      const signature = `${fingering.note} ${keySetId(fingering.keys)}`
      if (seen.has(signature)) duplicates.push(signature)
      seen.add(signature)
    }
    expect(duplicates).toEqual([])
  })

  it('flags B-footjoint fingerings consistently', () => {
    for (const fingering of FINGERINGS) {
      const usesBFootKeys = fingering.keys.includes('FOOT_B') || fingering.keys.includes('GIZMO')
      expect(fingering.footJoint === 'B').toBe(usesBFootKeys)
    }
  })

  it('never presses two keys the same finger would have to share', () => {
    for (const fingering of FINGERINGS) {
      for (const group of EXCLUSIVE_KEY_GROUPS) {
        const held = keysInGroup(group).filter((key) => fingering.keys.includes(key))
        expect(held.length, `${fingering.id} holds ${held.join(' + ')}`).toBeLessThanOrEqual(1)
      }
    }
  })
})
