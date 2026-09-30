<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { createBlobUrl, revokeBlobUrl } from '@/data/images'
import { INSTRUMENTS } from '@/instruments'
import { useSettingsStore } from '@/stores/settings'
import { useSheetsStore } from '@/stores/sheets'

/** Feature 3, library — the grid of saved sheet music. */

const router = useRouter()
const store = useSheetsStore()
const settings = useSettingsStore()

/** A sheet belongs to the instrument it was made for; older sheets are flute. */
const visible = computed(() =>
  store.sheets.filter((sheet) => (sheet.instrument ?? 'flute') === settings.instrumentId),
)
const hiddenCount = computed(() => store.sheets.length - visible.value.length)
const otherInstrument = computed(() =>
  INSTRUMENTS[settings.instrumentId === 'flute' ? 'tenorSax' : 'flute'],
)

const fileInput = ref<HTMLInputElement | null>(null)
const busy = ref(false)
const error = ref<string | null>(null)

/** Thumbnail object URLs, rebuilt whenever the list changes and revoked on teardown. */
const thumbnails = ref<Record<string, string>>({})

function releaseThumbnails() {
  for (const url of Object.values(thumbnails.value)) revokeBlobUrl(url)
  thumbnails.value = {}
}

watch(
  () => store.sheets,
  (sheets) => {
    releaseThumbnails()
    const next: Record<string, string> = {}
    for (const sheet of sheets) next[sheet.id] = createBlobUrl(sheet.thumbnail)
    thumbnails.value = next
  },
  { immediate: true, deep: false },
)

onMounted(() => void store.loadAll())
onUnmounted(releaseThumbnails)

async function onPick(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  busy.value = true
  error.value = null
  try {
    const title = file.name.replace(/\.[^.]+$/, '')
    const id = await store.create(file, title, settings.instrumentId)
    await router.push({ name: 'sheet', params: { id } })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not add that image.'
  } finally {
    busy.value = false
  }
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex items-start justify-between gap-4">
      <div>
        <h1 class="text-xl">Sheet music</h1>
        <p class="mt-1 text-sm text-ink-400">Upload a photo or scan, then note down what to play.</p>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-lg bg-accent-400 px-3.5 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-accent-300 disabled:opacity-50"
        :disabled="busy"
        @click="fileInput?.click()"
      >
        {{ busy ? 'Adding…' : 'Add sheet' }}
      </button>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        class="hidden"
        @change="onPick"
      />
    </header>

    <p
      v-if="error"
      class="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
    >
      {{ error }}
    </p>

    <p
      v-if="!store.loading && !visible.length"
      class="rounded-xl border border-dashed border-ink-700 px-4 py-10 text-center text-sm text-ink-400"
    >
      Nothing saved for the {{ settings.instrument.noun }} yet.
      <br />
      Add a photo of a piece you're learning and build up its fingerings note by note.
    </p>

    <ul v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <li v-for="sheet in visible" :key="sheet.id">
        <RouterLink
          :to="{ name: 'sheet', params: { id: sheet.id } }"
          class="block overflow-hidden rounded-xl border border-ink-700 bg-ink-900 transition-colors hover:border-accent-400"
        >
          <img
            v-if="thumbnails[sheet.id]"
            :src="thumbnails[sheet.id]"
            :alt="`Sheet music for ${sheet.title}`"
            class="aspect-4/3 w-full bg-ink-50 object-cover"
          />
          <div class="space-y-0.5 px-3 py-2.5">
            <p class="truncate text-sm font-medium text-ink-50">{{ sheet.title }}</p>
            <p class="truncate text-[11px] text-ink-400">
              {{ sheet.composer || formatDate(sheet.updatedAt) }}
            </p>
          </div>
        </RouterLink>
      </li>
    </ul>

    <p v-if="hiddenCount" class="text-center text-xs text-ink-400">
      {{ hiddenCount }} {{ hiddenCount === 1 ? 'sheet' : 'sheets' }} for the
      {{ otherInstrument.noun }} hidden — switch instrument to see
      {{ hiddenCount === 1 ? 'it' : 'them' }}.
    </p>
  </div>
</template>
