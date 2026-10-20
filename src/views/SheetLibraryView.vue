<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import BottomSheet from '@/components/BottomSheet.vue'
import { createBlobUrl, revokeBlobUrl } from '@/data/images'
import { transposeScore } from '@/score/ops'
import { type MusicXmlPart, parseMusicXml, readMxl } from '@/domain/musicxml'
import { CATALOG, type InstrumentId } from '@/instruments'
import { useSettingsStore } from '@/stores/settings'
import { type SheetSummary, sheetInstrument, useSheetsStore } from '@/stores/sheets'

/**
 * Feature 3, library — the grid of saved sheet music, one instrument at a
 * time, filtered by what each piece holds.
 */

const router = useRouter()
const store = useSheetsStore()
const settings = useSettingsStore()

/**
 * The instruments there are sheets for, plus the selected one — a tab each.
 * A sheet belongs to the instrument it was made for; older sheets are flute.
 */
const instrumentTabs = computed(() => {
  const counts = new Map<InstrumentId, number>([[settings.instrumentId, 0]])
  for (const sheet of store.sheets) {
    const id = sheetInstrument(sheet)
    counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  return (Object.keys(CATALOG) as InstrumentId[])
    .filter((id) => counts.has(id))
    .map((id) => ({ id, count: counts.get(id)!, name: CATALOG[id].name }))
})
const switchFailed = ref(false)

/** What each sheet holds, for the label on its card and the filters. */
const summaries = ref<Record<string, SheetSummary>>({})
watch(
  () => store.sheets,
  async () => (summaries.value = await store.summaries()),
  { immediate: true },
)

type Filter = 'all' | 'rhythm' | 'pitches' | 'photo'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'rhythm', label: 'With rhythm' },
  { id: 'pitches', label: 'Pitches only' },
  { id: 'photo', label: 'Photo only' },
]
const filter = ref<Filter>('all')
const searching = ref(false)
const query = ref('')

function kindOf(id: string): Exclude<Filter, 'all'> {
  const summary = summaries.value[id]
  if (!summary?.notes) return 'photo'
  return summary.mode
}

const LABEL: Record<Exclude<Filter, 'all'>, string> = { rhythm: 'Rhythm', pitches: 'Pitches', photo: 'Photo only' }

const forInstrument = computed(() =>
  store.sheets.filter((sheet) => sheetInstrument(sheet) === settings.instrumentId),
)
/** Filters with nothing behind them are left out, rather than shown empty. */
const filters = computed(() =>
  FILTERS.filter((f) => f.id === 'all' || f.id === filter.value || forInstrument.value.some((s) => kindOf(s.id) === f.id)),
)
const visible = computed(() => {
  const words = query.value.trim().toLowerCase()
  return forInstrument.value.filter(
    (sheet) =>
      (filter.value === 'all' || kindOf(sheet.id) === filter.value) &&
      (!words || `${sheet.title} ${sheet.composer}`.toLowerCase().includes(words)),
  )
})

/** The add-a-piece sheet, and its file pickers. */
const adding = ref(false)
const cameraInput = ref<HTMLInputElement | null>(null)

function pick(input: HTMLInputElement | null) {
  adding.value = false
  input?.click()
}

const addOptions: { title: string; sub: string; icon: string; run: () => void; primary?: boolean }[] = [
  {
    title: 'Take a photo',
    sub: 'Lay the page flat and fill the frame. The notes can be read automatically.',
    icon: 'M3 8h4l2-3h6l2 3h4v12H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    run: () => pick(cameraInput.value),
    primary: true,
  },
  {
    title: 'Choose an image',
    sub: 'A scan or screenshot already on this device.',
    icon: 'M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6',
    run: () => pick(fileInput.value),
  },
  {
    title: 'Import MusicXML',
    sub: 'From MuseScore, Sibelius, Finale or Dorico — exact notes and rhythm.',
    icon: 'M5 3h9l5 5v13H5zM14 3v5h5M9 14l3 3 3-3M12 10v7',
    run: () => pick(xmlInput.value),
  },
  { title: 'Start blank', sub: 'Type the notes in yourself.', icon: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4', run: () => void startBlank() },
]

/** A piece with no picture, to type in from scratch: straight into the editor. */
async function startBlank() {
  adding.value = false
  busy.value = true
  error.value = null
  try {
    const image = await placeholderImage('Untitled', 'Typed in')
    const id = await store.create(image, 'Untitled', settings.instrumentId)
    await router.push({ name: 'sheet', params: { id }, query: { edit: '1' } })
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not start a new piece.'
  } finally {
    busy.value = false
  }
}

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
  <div class="space-y-4">
    <header class="flex items-center justify-between gap-3">
      <h1 class="text-2xl">Sheets</h1>
      <div class="flex gap-2">
        <button
          type="button"
          class="flex h-11 w-11 items-center justify-center border transition-colors"
          :class="searching ? 'border-accent-400 text-accent-300' : 'border-ink-700 text-ink-200 hover:border-ink-400'"
          aria-label="Search"
          :aria-pressed="searching"
          @click="searching = !searching; query = ''"
        >
          <svg viewBox="0 0 24 24" class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-4-4" />
          </svg>
        </button>
        <button
          type="button"
          class="flex h-11 w-11 items-center justify-center bg-accent-400 text-ink-950 transition-colors hover:bg-accent-300 disabled:opacity-50"
          :aria-label="busy ? 'Adding…' : 'Add sheet'"
          :disabled="busy"
          @click="adding = true"
        >
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>
      <input ref="cameraInput" type="file" accept="image/*" capture="environment" class="hidden" @change="onPick" />
      <input ref="fileInput" type="file" accept="image/*" class="hidden" @change="onPick" />
      <input
        ref="xmlInput"
        type="file"
        accept=".musicxml,.xml,.mxl,application/vnd.recordare.musicxml+xml,application/vnd.recordare.musicxml"
        class="hidden"
        @change="onPickXml"
      />
    </header>

    <label v-if="searching" class="flex h-11 items-center gap-2.5 border border-ink-700 bg-ink-900 px-3">
      <span class="sr-only">Search sheets</span>
      <input
        v-model="query"
        type="search"
        placeholder="Title or composer"
        class="min-w-0 flex-1 bg-transparent text-sm text-ink-50 placeholder:text-ink-600 focus:outline-none"
        autofocus
      />
    </label>

    <!-- One tab per instrument there is music for. Picking one switches the
         whole app to it, adding it to the switch if needed. -->
    <div
      v-if="instrumentTabs.length > 1"
      role="tablist"
      aria-label="Instrument"
      class="tabs flex overflow-x-auto border border-ink-700"
    >
      <button
        v-for="(tab, i) in instrumentTabs"
        :key="tab.id"
        type="button"
        role="tab"
        :aria-selected="tab.id === settings.instrumentId"
        class="h-10 min-w-24 flex-1 shrink-0 px-3 text-[13px] whitespace-nowrap transition-colors"
        :class="[
          i ? 'border-l border-ink-700' : '',
          tab.id === settings.instrumentId ? 'bg-ink-800 font-semibold text-ink-50' : 'text-ink-400 hover:text-ink-200',
        ]"
        @click="tab.id !== settings.instrumentId && showSheetsFor(tab.id)"
      >
        {{ tab.name }} <span class="font-normal text-ink-400">{{ tab.count }}</span>
      </button>
    </div>
    <p v-if="switchFailed" role="alert" class="text-xs text-red-300">
      Couldn’t download that instrument — you seem to be offline.
    </p>

    <div v-if="filters.length > 2 || filter !== 'all'" class="tabs -mx-4 flex gap-2 overflow-x-auto px-4" aria-label="Show">
      <button
        v-for="f in filters"
        :key="f.id"
        type="button"
        class="h-8 shrink-0 border px-3 text-xs font-semibold transition-colors"
        :class="filter === f.id ? 'border-accent-400 bg-accent-400 text-ink-950' : 'border-ink-700 text-ink-200 hover:border-ink-400'"
        :aria-pressed="filter === f.id"
        @click="filter = f.id"
      >
        {{ f.label }}
      </button>
    </div>

    <p v-if="error" class="border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
      {{ error }}
    </p>

    <div
      v-if="!store.loading && !forInstrument.length"
      class="space-y-4 border border-dashed border-ink-700 px-4 py-10 text-center"
    >
      <p class="text-sm text-ink-400">
        Nothing saved for the {{ settings.instrument.noun }} yet.
        <br />
        Add a photo of a piece you’re learning and get the fingering for every note.
      </p>
      <button
        type="button"
        class="h-11 bg-accent-400 px-5 text-sm font-semibold text-ink-950 hover:bg-accent-300"
        @click="adding = true"
      >
        Add a piece
      </button>
    </div>
    <p v-else-if="!store.loading && !visible.length" class="py-10 text-center text-sm text-ink-400">
      No pieces match.
    </p>

    <ul v-else class="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <li v-for="sheet in visible" :key="sheet.id">
        <RouterLink
          :to="{ name: 'sheet', params: { id: sheet.id } }"
          class="block border border-ink-800 bg-ink-900 transition-colors hover:border-accent-400"
        >
          <span class="relative block">
            <img
              v-if="thumbnails[sheet.id]"
              :src="thumbnails[sheet.id]"
              alt=""
              class="block aspect-4/3 w-full bg-ink-50 object-cover"
            />
            <span
              class="absolute bottom-1.5 left-1.5 bg-ink-950 px-1.5 py-0.5 text-[10px] font-semibold"
              :class="kindOf(sheet.id) === 'rhythm' ? 'text-accent-300' : 'text-ink-400'"
            >
              {{ LABEL[kindOf(sheet.id)] }}
            </span>
          </span>
          <span class="block px-2.5 pt-2 pb-2.5">
            <span class="block truncate text-sm font-semibold text-ink-50">{{ sheet.title }}</span>
            <span class="mt-0.5 block truncate text-[11px] text-ink-400">
              {{ sheet.composer || formatDate(sheet.updatedAt) }}
            </span>
          </span>
        </RouterLink>
      </li>
    </ul>

    <BottomSheet :open="adding" label="Add a piece" @close="adding = false">
      <div class="space-y-1.5 px-4">
        <div class="flex items-baseline justify-between pb-2">
          <h2 class="text-xl">Add a piece</h2>
          <span class="text-xs text-ink-400">for {{ settings.instrument.name }}</span>
        </div>
        <button
          v-for="option in addOptions"
          :key="option.title"
          type="button"
          class="flex w-full items-center gap-3.5 border px-3 py-2.5 text-left transition-colors"
          :class="option.primary ? 'border-accent-400 bg-ink-800' : 'border-ink-700 hover:border-ink-400'"
          @click="option.run()"
        >
          <span class="flex h-11 w-11 shrink-0 items-center justify-center border border-ink-700 bg-ink-950 text-accent-400">
            <svg viewBox="0 0 24 24" class="h-[22px] w-[22px]" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path :d="option.icon" />
            </svg>
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-[15px] font-semibold text-ink-50">{{ option.title }}</span>
            <span class="block text-xs leading-snug text-ink-400">{{ option.sub }}</span>
          </span>
        </button>
      </div>
    </BottomSheet>
  </div>
</template>

<style scoped>
.tabs {
  scrollbar-width: none;
}
.tabs::-webkit-scrollbar {
  display: none;
}
</style>
