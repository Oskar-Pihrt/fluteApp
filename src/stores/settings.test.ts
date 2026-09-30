import { describe, expect, it } from 'vitest'
import { parseSettings } from './settings'

describe('parseSettings', () => {
  it('reads settings saved before the instrument switch as flute', () => {
    const old = JSON.stringify({ footJoint: 'B', openHole: true, audioEnabled: false })
    expect(parseSettings(old)).toMatchObject({
      instrument: 'flute',
      footJoint: 'B',
      openHole: true,
      audioEnabled: false,
      saxHighFSharp: true,
    })
  })

  it('falls back to flute for an unknown instrument', () => {
    expect(parseSettings(JSON.stringify({ instrument: 'kazoo' })).instrument).toBe('flute')
  })

  it('survives corrupt storage', () => {
    expect(parseSettings('{nope').instrument).toBe('flute')
    expect(parseSettings(null).instrument).toBe('flute')
  })
})
