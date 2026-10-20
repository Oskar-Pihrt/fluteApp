import { shallowReactive } from 'vue'
import { Note } from 'tonal'
import { resolveFingering } from '@/domain/fingering'
import { CATALOG } from './catalog'
import type { DataModuleId, Instrument, InstrumentData, InstrumentId, InstrumentMeta } from './types'

/**
 * The instrument registry. An instrument's description (`CATALOG`) is always
 * at hand; its keys, chart and fingerings are a separate chunk per data
 * module, fetched the first time it is needed. The installed app precaches
 * only the shell, so a player downloads the instruments they picked and
 * nothing else — see `vite.config.ts`.
 *
 * Anything that needs a full `Instrument` calls `loadInstrument` first; after
 * that `getInstrument` hands it back synchronously.
 */

interface LoadedModule {
  data: InstrumentData
  /** The chunk's URL — see `platform/instrumentCache.ts`. */
  url: string
}

/**
 * How each data module is loaded, and the chunk it lives in — named after its
 * folder (`vite.config.ts`). Variants of one family (baroque and German
 * recorders) share a chunk.
 */
const DATA_MODULES: Record<DataModuleId, { chunk: string; load: () => Promise<LoadedModule> }> = {
  flute: { chunk: 'flute', load: () => import('./flute/data').then((m) => ({ data: m.FLUTE_DATA, url: m.MODULE_URL })) },
  saxophone: {
    chunk: 'saxophone',
    load: () => import('./saxophone/data').then((m) => ({ data: m.SAX_DATA, url: m.MODULE_URL })),
  },
  clarinetBoehm: {
    chunk: 'clarinetBoehm',
    load: () => import('./clarinetBoehm/data').then((m) => ({ data: m.CLARINET_BOEHM_DATA, url: m.MODULE_URL })),
  },
  clarinetOehler: {
    chunk: 'clarinetOehler',
    load: () =>
      import('./clarinetOehler/data').then((m) => ({ data: m.CLARINET_OEHLER_DATA, url: m.MODULE_URL })),
  },
  oboe: { chunk: 'oboe', load: () => import('./oboe/data').then((m) => ({ data: m.OBOE_DATA, url: m.MODULE_URL })) },
  recorderBaroque: {
    chunk: 'recorder',
    load: () => import('./recorder/data').then((m) => ({ data: m.RECORDER_BAROQUE_DATA, url: m.MODULE_URL })),
  },
  recorderGerman: {
    chunk: 'recorder',
    load: () => import('./recorder/data').then((m) => ({ data: m.RECORDER_GERMAN_DATA, url: m.MODULE_URL })),
  },
  whistle: {
    chunk: 'whistle',
    load: () => import('./whistle/data').then((m) => ({ data: m.WHISTLE_DATA, url: m.MODULE_URL })),
  },
  trumpet: { chunk: 'brass', load: () => import('./brass/data').then((m) => ({ data: m.TRUMPET_DATA, url: m.MODULE_URL })) },
  euphonium: {
    chunk: 'brass',
    load: () => import('./brass/data').then((m) => ({ data: m.EUPHONIUM_DATA, url: m.MODULE_URL })),
  },
  hornF: { chunk: 'brass', load: () => import('./brass/data').then((m) => ({ data: m.HORN_F_DATA, url: m.MODULE_URL })) },
  hornDouble: {
    chunk: 'brass',
    load: () => import('./brass/data').then((m) => ({ data: m.DOUBLE_HORN_DATA, url: m.MODULE_URL })),
  },
  ocarina: {
    chunk: 'ocarina',
    load: () => import('./ocarina/data').then((m) => ({ data: m.OCARINA_DATA, url: m.MODULE_URL })),
  },
  trombone: {
    chunk: 'brass',
    load: () => import('./brass/data').then((m) => ({ data: m.TROMBONE_DATA, url: m.MODULE_URL })),
  },
}

/** The chunk an instrument's data is downloaded in. */
export function chunkOf(id: InstrumentId): string {
  return DATA_MODULES[getMeta(id).dataModule].chunk
}

export type LoadStatus = 'loading' | 'ready' | 'error'

const modules = new Map<DataModuleId, Promise<LoadedModule>>()
const loaded = shallowReactive(new Map<InstrumentId, Instrument>())
/** Per-instrument download state, for the picker. Missing means never asked for. */
export const loadStatus = shallowReactive(new Map<InstrumentId, LoadStatus>())

export function getMeta(id: InstrumentId): InstrumentMeta {
  return CATALOG[id]
}

/**
 * An instrument from its description and its family's shared data, trimmed to
 * the keys it has (`omitKeys`) and the notes it plays (`writtenRange`).
 */
function build(meta: InstrumentMeta, data: InstrumentData): Instrument {
  const { specs, parse, ...rest } = data
  const omit = new Set(meta.omitKeys ?? [])
  const [low, high] = (meta.writtenRange ?? []).map((note) => Note.midi(note)!)
  const shift = meta.fingeringShift ?? 0
  const fingerings = specs
    .map((spec) => (shift ? { ...spec, note: Note.fromMidiSharps(Note.midi(spec.note)! + shift) } : spec))
    .map((spec, i) =>
      resolveFingering(spec, i, {
        id: meta.id,
        parse,
        keys: data.keys,
        idPrefix: meta.idPrefix,
        partialRequires: data.partialRequires,
      }),
    )
    .filter(
      (f) =>
        !f.keys.some((key) => omit.has(key)) &&
        !f.partial.some((key) => omit.has(key)) &&
        (low === undefined || (f.midi >= low && f.midi <= high)),
    )
  return {
    ...meta,
    ...rest,
    keys: data.keys.filter((key) => !omit.has(key.id)),
    keyOrder: data.keyOrder.filter((id) => !omit.has(id)),
    chart: omit.size
      ? {
          ...data.chart,
          drawings: Object.fromEntries(Object.entries(data.chart.drawings).filter(([id]) => !omit.has(id))),
        }
      : data.chart,
    fingerings,
  }
}

function loadModule(id: DataModuleId): Promise<LoadedModule> {
  let pending = modules.get(id)
  if (!pending) {
    pending = DATA_MODULES[id].load()
    // A failed fetch (offline, first use) must not stick: try again next time.
    pending.catch(() => modules.delete(id))
    modules.set(id, pending)
  }
  return pending
}

/** Fetch (or reuse) an instrument's data. Rejects when it can't be downloaded. */
export async function loadInstrument(id: InstrumentId): Promise<Instrument> {
  const done = loaded.get(id)
  if (done) return done
  const meta = getMeta(id)
  loadStatus.set(id, 'loading')
  try {
    const instrument = build(meta, (await loadModule(meta.dataModule)).data)
    loaded.set(id, instrument)
    loadStatus.set(id, 'ready')
    return instrument
  } catch (cause) {
    loadStatus.set(id, 'error')
    throw cause
  }
}

/** URL of each chunk this version of the app loaded, by chunk name. */
export async function loadedChunkUrls(): Promise<Map<string, string>> {
  const urls = new Map<string, string>()
  for (const [id, pending] of modules) {
    try {
      urls.set(DATA_MODULES[id].chunk, (await pending).url)
    } catch {
      // Not downloaded; nothing to keep.
    }
  }
  return urls
}

export function isLoaded(id: InstrumentId): boolean {
  return loaded.has(id)
}

/** A loaded instrument. Throws if `loadInstrument` hasn't finished for it. */
export function getInstrument(id: InstrumentId): Instrument {
  const instrument = loaded.get(id)
  if (!instrument) throw new Error(`Instrument "${id}" is used before it was loaded`)
  return instrument
}

export { CATALOG, CATALOG_GROUPS, isInstrumentId } from './catalog'
export * from './types'
