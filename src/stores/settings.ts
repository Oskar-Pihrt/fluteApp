import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { Requirement } from '@/domain/keys'
import type { InstrumentContext } from '@/domain/lookup'
import { getInstrument, INSTRUMENT_IDS, type InstrumentConfig, type InstrumentId } from '@/instruments'

const STORAGE_KEY = 'fluteapp.settings.v1'

interface PersistedSettings {
  instrument: InstrumentId
  footJoint: 'C' | 'B'
  openHole: boolean
  saxHighFSharp: boolean
  audioEnabled: boolean
}

const DEFAULTS: PersistedSettings = {
  instrument: 'flute',
  footJoint: 'C',
  openHole: false,
  saxHighFSharp: true,
  audioEnabled: true,
}

// Settings saved before the instrument switch have no `instrument` or
// `saxHighFSharp`; merging over the defaults fills them in.
export function parseSettings(raw: string | null): PersistedSettings {
  if (!raw) return { ...DEFAULTS }
  try {
    const merged = { ...DEFAULTS, ...(JSON.parse(raw) as Partial<PersistedSettings>) }
    if (!INSTRUMENT_IDS.includes(merged.instrument)) merged.instrument = DEFAULTS.instrument
    return merged
  } catch {
    return { ...DEFAULTS }
  }
}

function load(): PersistedSettings {
  try {
    return parseSettings(localStorage.getItem(STORAGE_KEY))
  } catch {
    return { ...DEFAULTS }
  }
}

/**
 * Instrument choice, instrument configuration and preferences.
 *
 * Kept in localStorage rather than IndexedDB: it is read synchronously during
 * the first render of every view, and it is a handful of bytes.
 */
export const useSettingsStore = defineStore('settings', () => {
  const initial = load()
  const instrumentId = ref<InstrumentId>(initial.instrument)
  const footJoint = ref<'C' | 'B'>(initial.footJoint)
  const openHole = ref(initial.openHole)
  const saxHighFSharp = ref(initial.saxHighFSharp)
  const audioEnabled = ref(initial.audioEnabled)

  /** The player's setup of a given instrument, whether or not it is active. */
  function configFor(id: InstrumentId): InstrumentConfig {
    const config: Requirement[] = []
    if (id === 'flute') {
      if (footJoint.value === 'B') config.push('bFoot')
      if (openHole.value) config.push('openHole')
    } else if (saxHighFSharp.value) {
      config.push('highFSharp')
    }
    return config
  }

  function contextFor(id: InstrumentId | undefined): InstrumentContext {
    const instrument = getInstrument(id)
    return { instrument, config: configFor(instrument.id) }
  }

  const instrument = computed(() => getInstrument(instrumentId.value))
  /** Everything the lookup functions need for the active instrument. */
  const context = computed(() => contextFor(instrumentId.value))

  watch(
    [instrumentId, footJoint, openHole, saxHighFSharp, audioEnabled],
    () => {
      const payload: PersistedSettings = {
        instrument: instrumentId.value,
        footJoint: footJoint.value,
        openHole: openHole.value,
        saxHighFSharp: saxHighFSharp.value,
        audioEnabled: audioEnabled.value,
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      } catch {
        // Private browsing with storage disabled — settings just won't persist.
      }
    },
    { deep: false },
  )

  return {
    instrumentId,
    instrument,
    context,
    contextFor,
    footJoint,
    openHole,
    saxHighFSharp,
    audioEnabled,
  }
})
