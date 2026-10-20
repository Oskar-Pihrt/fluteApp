<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { createBlobUrl, revokeBlobUrl } from '@/data/images'
import { transposeScore } from '@/score/ops'
import { type MusicXmlPart, parseMusicXml, readMxl } from '@/domain/musicxml'
import { CATALOG, type InstrumentId } from '@/instruments'
import { useSettingsStore } from '@/stores/settings'
import { sheetInstrument, useSheetsStore } from '@/stores/sheets'

/** Feature 3, library — the grid of saved sheet music. */

const router = useRouter()
const store = useSheetsStore()
const settings = useSettingsStore()

/** A sheet belongs to the instrument it was made for; older sheets are flute. */
const visible = computed(() =>
  store.sheets.filter((sheet) => sheetInstrument(sheet) === settings.instrumentId),
)
/**
 * Sheets made for other instruments, counted per instrument — each a button
 * that switches there, adding the instrument to the switch if needed.
 */
const hidden = computed(() => {
  const counts = new Map<InstrumentId, number>()
  for (const sheet of store.sheets) {
    const id = sheetInstrument(sheet)
    if (id !== settings.instrumentId) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return (Object.keys(CATALOG) as InstrumentId[])
    .filter((id) => counts.has(id))
    .map((id) => ({ id, count: counts.get(id)!, name: CATALOG[id].name }))
})
const switchFailed = ref(false)

async function showSheetsFor(id: InstrumentId) {
  switchFailed.value = false
  try {
    await settings.selectInstrument(id)
    await settings.setVisible(id, true)
  } catch {
    switchFailed.value = true
  }
}

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

const xmlInput = ref<HTMLInputElement | null>(null)

/** The part to import: the only one, one named for the instrument, or the player's pick. */
function choosePart(parts: MusicXmlPart[]): MusicXmlPart | null {
  if (parts.length === 1) return parts[0]
  const words = settings.instrument.musicXmlNames
  const named = parts.filter((part) => words.some((word) => part.name.toLowerCase().includes(word.toLowerCase())))
  if (named.length === 1) return named[0]
  const list = parts.map((part, i) => `${i + 1}. ${part.name} (${part.notes.length} notes)`).join('\n')
  const answer = window.prompt(`Which part do you play?\n\n${list}`, '1')
  const index = Number(answer) - 1
  return parts[index] ?? null
}

/** A plain card standing in for the scan, since an imported score has no picture. */
async function placeholderImage(title: string, subtitle: string): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width = 1200
  canvas.height = 900
  const context = canvas.getContext('2d')!
  context.fillStyle = '#f4f1ea'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.strokeStyle = '#2a2a2a'
  context.lineWidth = 3
  for (let staff = 0; staff < 4; staff++) {
    for (let line = 0; line < 5; line++) {
      const y = 380 + staff * 120 + line * 14
      context.beginPath()
      context.moveTo(100, y)
      context.lineTo(1100, y)
      context.stroke()
    }
  }
  context.fillStyle = '#1a1a1a'
  context.font = '600 64px serif'
  context.textAlign = 'center'
  context.fillText(title.slice(0, 32), 600, 180, 1000)
  context.font = '36px serif'
  context.fillText(subtitle, 600, 260, 1000)
  return new Promise((resolve, reject) => canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Canvas failed'))), 'image/png'))
}

/**
 * Import a MusicXML or compressed .mxl file: exact notes and rhythm, no detection. The
 * part is rewritten into the selected instrument's written pitch, so a flute
 * part imported on the alto sax comes out ready to finger.
 */
async function onPickXml(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  busy.value = true
  error.value = null
  try {
    const xml = /\.mxl$/i.test(file.name) ? await readMxl(await file.arrayBuffer()) : await file.text()
    const score = parseMusicXml(xml)
    if (!score.parts.length) throw new Error('That score has no notes in it.')
    const part = choosePart(score.parts)
    if (!part) return
    // Part's written pitch → sounding → this instrument's written pitch.
    const shift = part.transposeSemitones - settings.instrument.transposeSemitones
    const title = score.title || file.name.replace(/\.[^.]+$/, '')
    const image = await placeholderImage(title, `${part.name} · imported from MusicXML`)
    // The whole part — rhythm, measures, repeats — not just its pitches.
    const id = await store.create(image, title, settings.instrumentId, score.composer, transposeScore(part.score, shift))
    await router.push({ name: 'sheet', params: { id } })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not import that file.'
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
        <button
          type="button"
          class="mt-1 text-xs font-medium text-accent-400 transition-colors hover:text-accent-300 disabled:opacity-50"
          :disabled="busy"
          @click="xmlInput?.click()"
        >
          Have it as MusicXML? Import the exact notes →
        </button>
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
      <input
        ref="xmlInput"
        type="file"
        accept=".musicxml,.xml,.mxl,application/vnd.recordare.musicxml+xml,application/vnd.recordare.musicxml"
        class="hidden"
        @change="onPickXml"
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

    <div v-if="hidden.length" class="space-y-2 text-center">
      <p class="text-xs text-ink-400">Sheets for your other instruments:</p>
      <div class="flex flex-wrap justify-center gap-2">
        <button
          v-for="entry in hidden"
          :key="entry.id"
          type="button"
          class="rounded-lg border border-ink-700 px-3 py-1.5 text-xs text-ink-200 transition-colors hover:border-ink-400"
          @click="showSheetsFor(entry.id)"
        >
          {{ entry.name }} · {{ entry.count }}
        </button>
      </div>
      <p v-if="switchFailed" role="alert" class="text-xs text-red-300">
        Couldn’t download that instrument — you seem to be offline.
      </p>
    </div>
  </div>
</template>
