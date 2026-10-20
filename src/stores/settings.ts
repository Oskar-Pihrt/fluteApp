import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import type { Requirement } from '@/domain/keys'
import type { InstrumentContext } from '@/domain/lookup'
import {
  CATALOG,
  getInstrument,
  getMeta,
  type InstrumentConfig,
  type InstrumentId,
  type InstrumentOption,
  isInstrumentId,
  loadInstrument,
} from '@/instruments'

// Named before the app became TimbreMap; kept so saved settings carry over.
const STORAGE_KEY = 'fluteapp.settings.v1'

export interface PersistedSettings {
  instrument: InstrumentId
  /** Instruments in the switch, in catalog order. Never empty. */
  visibleInstruments: InstrumentId[]
  /** False until the player has picked their instruments on first launch. */
  onboarded: boolean
  /** The optional hardware the player has, per instrument; missing means the defaults. */
  config: Partial<Record<InstrumentId, Requirement[]>>
  audioEnabled: boolean
}

/** The instruments the app had before the player could choose them. */
const LEGACY_INSTRUMENTS: InstrumentId[] = ['flute', 'altoSax', 'tenorSax']

const DEFAULTS: PersistedSettings = {
  instrument: 'flute',
  visibleInstruments: ['flute'],
  onboarded: false,
  config: {},
  audioEnabled: true,
}

/** The requirements a player starts with for an instrument. */
export function defaultConfig(id: InstrumentId): Requirement[] {
  return getMeta(id).options.flatMap((option) => {
    if (option.kind === 'toggle') return option.default ? [option.requirement] : []
    const requirement = option.choices[option.default]?.requirement
    return requirement ? [requirement] : []
  })
}

/** Settings as saved before players chose instruments and options were per instrument. */
interface LegacySettings {
  footJoint?: 'C' | 'B'
  openHole?: boolean
  saxHighFSharp?: boolean
}

function migrateLegacyConfig(legacy: LegacySettings): PersistedSettings['config'] {
  const config: PersistedSettings['config'] = {}
  if (legacy.footJoint !== undefined || legacy.openHole !== undefined) {
    config.flute = [
      ...(legacy.footJoint === 'B' ? ['bFoot' as const] : []),
      ...(legacy.openHole ? ['openHole' as const] : []),
    ]
  }
  if (legacy.saxHighFSharp !== undefined) {
    const sax: Requirement[] = legacy.saxHighFSharp ? ['highFSharp'] : []
    config.altoSax = sax
    config.tenorSax = [...sax]
  }
  return config
}

function catalogOrder(ids: readonly InstrumentId[]): InstrumentId[] {
  const wanted = new Set(ids)
  return (Object.keys(CATALOG) as InstrumentId[]).filter((id) => wanted.has(id))
}

/**
 * Saved settings over the defaults. Anything saved by an older version — no
 * instrument list, flat footjoint/sax fields — is translated, and whoever had
 * settings before onboarding existed is treated as onboarded with the three
 * instruments the app used to show.
 */
export function parseSettings(raw: string | null): PersistedSettings {
  if (!raw) return structuredClone(DEFAULTS)
  let saved: Partial<PersistedSettings> & LegacySettings
  try {
    saved = JSON.parse(raw)
    if (!saved || typeof saved !== 'object') throw new Error('not an object')
  } catch {
    return structuredClone(DEFAULTS)
  }

  const visible = Array.isArray(saved.visibleInstruments)
    ? catalogOrder(saved.visibleInstruments.filter(isInstrumentId))
    : [...LEGACY_INSTRUMENTS]
  const config: PersistedSettings['config'] = {
    ...migrateLegacyConfig(saved),
    ...(saved.config && typeof saved.config === 'object' ? saved.config : {}),
  }
  for (const id of Object.keys(config)) {
    if (!isInstrumentId(id)) delete config[id as InstrumentId]
  }

  let instrument = isInstrumentId(saved.instrument) ? saved.instrument : DEFAULTS.instrument
  if (!visible.length) visible.push(instrument)
  if (!visible.includes(instrument)) instrument = visible[0]

  return {
    instrument,
    visibleInstruments: visible,
    onboarded: saved.onboarded ?? true,
    config,
    audioEnabled: saved.audioEnabled ?? DEFAULTS.audioEnabled,
  }
}

function load(): PersistedSettings {
  try {
    return parseSettings(localStorage.getItem(STORAGE_KEY))
  } catch {
    return structuredClone(DEFAULTS)
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
  const visibleInstruments = ref<InstrumentId[]>(initial.visibleInstruments)
  const onboarded = ref(initial.onboarded)
  const config = ref<PersistedSettings['config']>(initial.config)
  const audioEnabled = ref(initial.audioEnabled)

  /** The player's setup of a given instrument, whether or not it is active. */
  function configFor(id: InstrumentId): InstrumentConfig {
    return config.value[id] ?? defaultConfig(id)
  }

  function hasRequirement(id: InstrumentId, requirement: Requirement): boolean {
    return configFor(id).includes(requirement)
  }

  /** Turn one piece of optional hardware on or off. */
  function setRequirement(id: InstrumentId, requirement: Requirement, on: boolean) {
    const current = configFor(id).filter((r) => r !== requirement)
    config.value = { ...config.value, [id]: on ? [...current, requirement] : current }
  }

  /** Pick one build from a `choice` option, e.g. the B footjoint. */
  function setChoice(id: InstrumentId, option: InstrumentOption, index: number) {
    if (option.kind !== 'choice') return
    const others = new Set(option.choices.map((c) => c.requirement).filter(Boolean))
    const current = configFor(id).filter((r) => !others.has(r))
    const picked = option.choices[index]?.requirement
    config.value = { ...config.value, [id]: picked ? [...current, picked] : current }
  }

  function choiceIndex(id: InstrumentId, option: InstrumentOption): number {
    if (option.kind !== 'choice') return -1
    const held = configFor(id)
    const found = option.choices.findIndex((c) => c.requirement && held.includes(c.requirement))
    return found === -1 ? option.choices.findIndex((c) => !c.requirement) : found
  }

  /** "C foot · Open hole (French) off" — the player's setup in one line. */
  function setupSummary(id: InstrumentId): string {
    return getMeta(id)
      .options.map((option) =>
        option.kind === 'choice'
          ? option.choices[choiceIndex(id, option)]?.label
          : `${option.label} ${hasRequirement(id, option.requirement) ? 'on' : 'off'}`,
      )
      .filter(Boolean)
      .join(' · ')
  }

  /** Requires `id` to be loaded — see `loadInstrument`. */
  function contextFor(id: InstrumentId | undefined): InstrumentContext {
    const instrument = getInstrument(id ?? 'flute')
    return { instrument, config: configFor(instrument.id) }
  }

  /**
   * The active instrument. Always loaded: the app waits for it before
   * mounting, and `selectInstrument` waits before switching.
   */
  const instrument = computed(() => getInstrument(instrumentId.value))
  /** Everything the lookup functions need for the active instrument. */
  const context = computed(() => contextFor(instrumentId.value))

  /** Switch the whole app to an instrument, downloading it first if needed. */
  async function selectInstrument(id: InstrumentId) {
    await loadInstrument(id)
    instrumentId.value = id
  }

  /**
   * Add an instrument to the switch or take it out. The last one can't be
   * removed; removing the active one switches to the first that is left.
   */
  async function setVisible(id: InstrumentId, on: boolean) {
    if (on) {
      if (!visibleInstruments.value.includes(id)) {
        visibleInstruments.value = catalogOrder([...visibleInstruments.value, id])
      }
      return
    }
    const remaining = visibleInstruments.value.filter((other) => other !== id)
    if (!remaining.length) return
    if (instrumentId.value === id) await selectInstrument(remaining[0])
    visibleInstruments.value = remaining
  }

  /**
   * Load the active instrument before the app mounts. Offline, with the
   * active one never downloaded, fall back to any other chosen instrument
   * that is available. False when none is.
   */
  async function restoreInstrument(): Promise<boolean> {
    const candidates = [instrumentId.value, ...visibleInstruments.value.filter((id) => id !== instrumentId.value)]
    for (const id of candidates) {
      try {
        await selectInstrument(id)
        return true
      } catch {
        // Try the next one.
      }
    }
    return false
  }

  watch(
    [instrumentId, visibleInstruments, onboarded, config, audioEnabled],
    () => {
      const payload: PersistedSettings = {
        instrument: instrumentId.value,
        visibleInstruments: visibleInstruments.value,
        onboarded: onboarded.value,
        config: config.value,
        audioEnabled: audioEnabled.value,
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(payload))
      } catch {
        // Private browsing with storage disabled — settings just won't persist.
      }
    },
    { deep: true },
  )

  return {
    instrumentId,
    instrument,
    context,
    contextFor,
    configFor,
    hasRequirement,
    setRequirement,
    setChoice,
    choiceIndex,
    setupSummary,
    selectInstrument,
    restoreInstrument,
    visibleInstruments,
    setVisible,
    onboarded,
    audioEnabled,
  }
})
