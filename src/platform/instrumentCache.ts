import { watch } from 'vue'
import { chunkOf, loadedChunkUrls, loadInstrument } from '@/instruments'
import type { useSettingsStore } from '@/stores/settings'

/**
 * The installed app precaches only its shell. Each instrument's data is a
 * separate `instrument-<family>-<hash>.js` chunk that the service worker caches
 * the first time it is fetched (`vite.config.ts`). This keeps that cache in
 * step with the player's choice: every chosen instrument is fetched — so it
 * works offline from then on, including after an app update renames its
 * chunk — and chunks nobody chose any more, or from an older version, are
 * dropped.
 */

/** Must match `runtimeCaching[].options.cacheName` in `vite.config.ts`. */
export const INSTRUMENT_CACHE = 'timbremap-instruments'

const CHUNK = /\/instrument-([A-Za-z0-9]+)-[^/]*\.js$/

export function keepInstrumentsCached(settings: ReturnType<typeof useSettingsStore>) {
  async function sync() {
    const visible = [...settings.visibleInstruments]
    await Promise.allSettled(visible.map((id) => loadInstrument(id)))
    await pruneInstrumentCache(new Set(visible.map(chunkOf)))
  }
  watch(() => [...settings.visibleInstruments], sync, { immediate: true })
  // Anything chosen while offline downloads as soon as the connection is back.
  window.addEventListener('online', () => void sync())
}

async function pruneInstrumentCache(keep: ReadonlySet<string>) {
  if (typeof caches === 'undefined') return
  try {
    if (!(await caches.has(INSTRUMENT_CACHE))) return
    const cache = await caches.open(INSTRUMENT_CACHE)
    const current = await loadedChunkUrls()
    for (const request of await cache.keys()) {
      const module = CHUNK.exec(new URL(request.url).pathname)?.[1]
      if (!module) continue
      const currentUrl = current.get(module)
      const stale = currentUrl !== undefined && currentUrl !== request.url
      if (!keep.has(module) || stale) await cache.delete(request)
    }
  } catch {
    // Cache Storage unavailable (private mode, insecure origin): nothing to tidy.
  }
}
