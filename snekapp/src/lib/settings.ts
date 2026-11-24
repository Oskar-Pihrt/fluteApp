import { reactive, watch } from 'vue'

export interface Settings {
  /** Reminders switched on (native app only). */
  notify: boolean
  /** Time of day reminders arrive, "HH:MM". */
  time: string
}

const KEY = 'snekapp.settings'

function load(): Settings {
  const defaults: Settings = { notify: false, time: '09:00' }
  try {
    return { ...defaults, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return defaults
  }
}

export const settings = reactive<Settings>(load())

watch(settings, (s) => {
  try { localStorage.setItem(KEY, JSON.stringify(s)) } catch { /* storage unavailable */ }
})
