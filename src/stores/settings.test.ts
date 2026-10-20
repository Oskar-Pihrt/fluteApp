import { describe, expect, it } from 'vitest'
import { defaultConfig, parseSettings } from './settings'

describe('parseSettings', () => {
  it('starts a new player on the flute, not yet onboarded', () => {
    expect(parseSettings(null)).toEqual({
      instrument: 'flute',
      visibleInstruments: ['flute'],
      onboarded: false,
      config: {},
      audioEnabled: true,
    })
  })

  it('reads settings saved before the instrument switch as flute, with its setup', () => {
    const old = JSON.stringify({ footJoint: 'B', openHole: true, audioEnabled: false })
    expect(parseSettings(old)).toMatchObject({
      instrument: 'flute',
      onboarded: true,
      audioEnabled: false,
      config: { flute: ['bFoot', 'openHole'] },
    })
  })

  it('gives players from before the instrument choice the three instruments they had', () => {
    const old = JSON.stringify({ instrument: 'tenorSax', footJoint: 'C', saxHighFSharp: false })
    expect(parseSettings(old)).toMatchObject({
      instrument: 'tenorSax',
      visibleInstruments: ['flute', 'altoSax', 'tenorSax'],
      onboarded: true,
      config: { flute: [], altoSax: [], tenorSax: [] },
    })
  })

  it('falls back to flute for an unknown instrument', () => {
    expect(parseSettings(JSON.stringify({ instrument: 'kazoo' })).instrument).toBe('flute')
  })

  it('keeps the alto sax', () => {
    expect(parseSettings(JSON.stringify({ instrument: 'altoSax' })).instrument).toBe('altoSax')
  })

  it('drops unknown instruments from the switch and keeps catalog order', () => {
    const saved = JSON.stringify({ instrument: 'tenorSax', visibleInstruments: ['tenorSax', 'kazoo', 'flute'] })
    expect(parseSettings(saved).visibleInstruments).toEqual(['flute', 'tenorSax'])
  })

  it('never leaves the switch empty, and keeps the active instrument in it', () => {
    expect(parseSettings(JSON.stringify({ instrument: 'altoSax', visibleInstruments: [] }))).toMatchObject({
      instrument: 'altoSax',
      visibleInstruments: ['altoSax'],
    })
    expect(
      parseSettings(JSON.stringify({ instrument: 'altoSax', visibleInstruments: ['tenorSax'] })).instrument,
    ).toBe('tenorSax')
  })

  it('survives corrupt storage', () => {
    expect(parseSettings('{nope').instrument).toBe('flute')
    expect(parseSettings('null').instrument).toBe('flute')
    expect(parseSettings(null).instrument).toBe('flute')
  })
})

describe('defaultConfig', () => {
  it('starts the flute on a C foot without open holes, and the sax with high F♯', () => {
    expect(defaultConfig('flute')).toEqual([])
    expect(defaultConfig('altoSax')).toEqual(['highFSharp'])
  })
})
