import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { FluteConfig } from '@/domain/lookup'

const STORAGE_KEY = 'fluteapp.settings.v1'

interface PersistedSettings {
  footJoint: 'C' | 'B'
  openHole: boolean
  audioEnabled: boolean
}

const DEFAULTS: PersistedSettings = {
  footJoint: 'C',
  openHole: false,
  audioEnabled: true,
}

function load(): PersistedSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<PersistedSettings>) }
  } catch {
    return { ...DEFAULTS }
  }
}

/**
 * Instrument configuration and preferences.
 *
 * Kept in localStorage rather than IndexedDB: it is read synchronously during
 * the first render of every view, and it is a handful of bytes.
 */
export const useSettingsStore = defineStore('settings', () => {
  const initial = load()
  const footJoint = ref<'C' | 'B'>(initial.footJoint)
  const openHole = ref(initial.openHole)
  const audioEnabled = ref(initial.audioEnabled)

  const fluteConfig = computed<FluteConfig>(() => ({
    footJoint: footJoint.value,
    openHole: openHole.value,
  }))

  watch(
    [footJoint, openHole, audioEnabled],
    () => {
      const payload: PersistedSettings = {
        footJoint: footJoint.value,
        openHole: openHole.value,
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

  return { footJoint, openHole, audioEnabled, fluteConfig }
})
