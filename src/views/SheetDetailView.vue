<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import KeyChart from '@/components/KeyChart.vue'
import NoteBadge from '@/components/NoteBadge.vue'
import NotePicker from '@/components/NotePicker.vue'
import OmrDebugView from '@/components/OmrDebugView.vue'
import SheetOverlay from '@/components/SheetOverlay.vue'
import StaffPosition from '@/components/StaffPosition.vue'
import type { Sheet } from '@/data/db'
import { diatonicAtStaffPosition } from '@/domain/staff'
import { lettersAlteredBy } from '@/omr/pitch'
import { useRecogniser } from '@/omr/useRecogniser'
import type { Box, KeySignature, OmrWarning } from '@/omr/types'
import { createBlobUrl, revokeBlobUrl } from '@/data/images'
import { playNote, playSequence } from '@/domain/audio'
import type { Fingering } from '@/domain/fingering'
import { canonicalNote, fingeringsForNote, noteLabel, prettyCode } from '@/domain/lookup'
import { useSettingsStore } from '@/stores/settings'
import { useSheetsStore } from '@/stores/sheets'

/**
 * Feature 3, detail — the uploaded image plus the sequence of notes to play,
 * each with its fingering.
 *
 * Notes are edited in a local draft and written back on save, so tapping
 * through a long piece doesn't hit IndexedDB on every keystroke.
 */

const route = useRoute()
const router = useRouter()
const store = useSheetsStore()
const settings = useSettingsStore()

interface DraftNote {
  note: string
  chosenFingeringId?: string
  /** Where on the page this note was found, normalised 0–1. Detected notes only. */
  bbox?: Box
  source?: 'manual' | 'detected'
  /** Recogniser confidence, 0–1. Transient — not persisted, only used for review. */
  confidence?: number
}

const sheet = ref<Sheet | null>(null)
const imageUrl = ref<string | null>(null)
const draft = ref<DraftNote[]>([])
const savedSnapshot = ref('[]')
const editing = ref(false)
const selectedIndex = ref<number | null>(null)
const saving = ref(false)
const stopPlayback = ref<(() => void) | null>(null)
const zoomed = ref(false)
const renaming = ref(false)
const titleDraft = ref('')
const composerDraft = ref('')

// ── Automatic detection ────────────────────────────────────────────────────
const recogniser = useRecogniser()
/** Warnings from the last run, shown until dismissed. */
const detectionWarnings = ref<OmrWarning[]>([])
const showDebug = ref(false)
/** The stage inspector is a development tool; it never ships to a real user. */
const isDev = import.meta.env.DEV
/** Key signature override — changing it re-derives pitches with no re-scan. */
const keyOverride = ref<KeySignature | null>(null)
/** Staff positions of the last detection, needed to re-derive on a key change. */
const detectedRelatives = ref<number[]>([])

const dirty = computed(() => JSON.stringify(stripTransient(draft.value)) !== savedSnapshot.value)

/**
 * The draft as it will be persisted — `confidence` is review-only and dropped.
 *
 * `bbox` is rebuilt field by field rather than passed through. The draft is a
 * deep-reactive ref, so a nested object is a Vue Proxy, and IndexedDB's
 * structured clone rejects those outright with `DataCloneError` — the whole save
 * fails. A shallow spread hid this while notes held only primitives; the moment
 * one gained a nested object it broke. Keep this plain.
 */
function stripTransient(notes: DraftNote[]) {
  return notes.map(({ note, chosenFingeringId, bbox, source }) => ({
    note,
    chosenFingeringId,
    bbox: bbox
      ? { x: bbox.x, y: bbox.y, width: bbox.width, height: bbox.height }
      : undefined,
    source,
  }))
}

async function load() {
  const id = String(route.params.id)
  const found = await store.get(id)
  if (!found) {
    await router.replace({ name: 'sheets' })
    return
  }
  sheet.value = found
  revokeBlobUrl(imageUrl.value)
  imageUrl.value = createBlobUrl(found.image)

  const notes = await store.notesFor(id)
  draft.value = notes.map(({ note, chosenFingeringId, bbox, source }) => ({
    note,
    chosenFingeringId,
    bbox,
    source,
  }))
  savedSnapshot.value = JSON.stringify(stripTransient(draft.value))
  detectionWarnings.value = []
  detectedRelatives.value = []
  keyOverride.value = null
}

onMounted(load)
watch(() => route.params.id, load)

onUnmounted(() => {
  revokeBlobUrl(imageUrl.value)
  stopPlayback.value?.()
})

/** Fingerings for the whole sequence, resolved once per draft change. */
const resolved = computed(() =>
  draft.value.map((entry) => {
    const options = fingeringsForNote(entry.note, settings.fluteConfig)
    const chosen =
      options.find((option) => option.id === entry.chosenFingeringId) ?? options[0] ?? null
    return { ...entry, options, chosen }
  }),
)

const selected = computed(() =>
  selectedIndex.value === null ? null : (resolved.value[selectedIndex.value] ?? null),
)

function addNote(note: string) {
  draft.value.push({ note })
  selectedIndex.value = draft.value.length - 1
  if (settings.audioEnabled) playNote(note, 0.4)
}

/**
 * Run automatic detection and load the result into the draft as suggestions.
 *
 * Nothing is saved: the result lands in the same unsaved draft the manual picker
 * writes to, so reviewing, correcting and saving all work exactly as before. If
 * detection fails or finds nothing, the manual editor is untouched and still the
 * way through.
 */
async function detect() {
  if (!sheet.value) return
  if (draft.value.length && !window.confirm('Replace the notes already entered with detected ones?')) {
    return
  }

  const outcome = await recogniser.run(sheet.value.image, { debug: showDebug.value })
  if (!outcome) return

  detectionWarnings.value = outcome.warnings
  keyOverride.value = outcome.keySignature
  detectedRelatives.value = outcome.notes.map((note) => note.relative)

  draft.value = outcome.notes.map((note) => ({
    note: note.note,
    bbox: note.bbox,
    source: 'detected' as const,
    confidence: note.confidence,
  }))
  selectedIndex.value = draft.value.length ? 0 : null
  editing.value = false
}

/**
 * Re-spell every detected note under a different key signature.
 *
 * Pitches are derived from staff positions rather than stored outright, so
 * correcting a misread key is instant and needs no second pass over the image.
 */
function applyKey(key: KeySignature) {
  keyOverride.value = key
  const altered = lettersAlteredBy(key)

  draft.value = draft.value.map((entry, index) => {
    const relative = detectedRelatives.value[index]
    if (relative == null) return entry
    const { letter, octave } = diatonicAtStaffPosition(relative)
    const accidental = altered.get(letter) ?? ''
    return { ...entry, note: `${letter}${accidental}${octave}` }
  })
}

const KEY_CHOICES: { label: string; key: KeySignature }[] = [
  { label: '♮', key: { kind: '#', count: 0 } },
  { label: '1♯', key: { kind: '#', count: 1 } },
  { label: '2♯', key: { kind: '#', count: 2 } },
  { label: '3♯', key: { kind: '#', count: 3 } },
  { label: '4♯', key: { kind: '#', count: 4 } },
  { label: '1♭', key: { kind: 'b', count: 1 } },
  { label: '2♭', key: { kind: 'b', count: 2 } },
  { label: '3♭', key: { kind: 'b', count: 3 } },
  { label: '4♭', key: { kind: 'b', count: 4 } },
]

function isCurrentKey(key: KeySignature): boolean {
  const current = keyOverride.value
  if (!current) return false
  if (current.count === 0 && key.count === 0) return true
  return current.kind === key.kind && current.count === key.count
}

/** Notes worth checking: low confidence, or called out by a warning. */
const flaggedIndices = computed(() => {
  const flagged = new Set<number>()
  for (const warning of detectionWarnings.value) {
    for (const index of warning.noteIndices ?? []) flagged.add(index)
  }
  draft.value.forEach((entry, index) => {
    if (entry.confidence != null && entry.confidence < 0.45) flagged.add(index)
  })
  return [...flagged]
})

const hasDetected = computed(() => draft.value.some((entry) => entry.source === 'detected'))

function removeAt(index: number) {
  draft.value.splice(index, 1)
  if (selectedIndex.value !== null && selectedIndex.value >= draft.value.length) {
    selectedIndex.value = draft.value.length ? draft.value.length - 1 : null
  }
}

function chooseFingering(index: number, fingering: Fingering) {
  const options = resolved.value[index].options
  // Storing the id only when it differs from the default keeps backups small
  // and lets the primary fingering follow future data corrections.
  draft.value[index] = {
    note: draft.value[index].note,
    chosenFingeringId: fingering.id === options[0]?.id ? undefined : fingering.id,
  }
}

async function save() {
  if (!sheet.value) return
  saving.value = true
  try {
    await store.replaceNotes(
      sheet.value.id,
      stripTransient(draft.value).map((entry, index) => ({ ...entry, index })),
    )
    savedSnapshot.value = JSON.stringify(stripTransient(draft.value))
    editing.value = false
  } finally {
    saving.value = false
  }
}

function discard() {
  draft.value = JSON.parse(savedSnapshot.value) as DraftNote[]
  editing.value = false
  selectedIndex.value = null
}

function togglePlayback() {
  if (stopPlayback.value) {
    stopPlayback.value()
    stopPlayback.value = null
    return
  }
  if (!draft.value.length) return
  stopPlayback.value = playSequence(draft.value.map((entry) => entry.note))
}

function startRename() {
  if (!sheet.value) return
  titleDraft.value = sheet.value.title
  composerDraft.value = sheet.value.composer
  renaming.value = true
}

async function saveRename() {
  if (!sheet.value) return
  await store.updateMeta(sheet.value.id, {
    title: titleDraft.value.trim() || sheet.value.title,
    composer: composerDraft.value,
  })
  sheet.value = (await store.get(sheet.value.id)) ?? sheet.value
  renaming.value = false
}

async function deleteSheet() {
  if (!sheet.value) return
  if (!window.confirm(`Delete "${sheet.value.title}" and its notes? This cannot be undone.`)) return
  await store.remove(sheet.value.id)
  await router.replace({ name: 'sheets' })
}
</script>

<template>
  <div v-if="sheet" class="space-y-5">
    <RouterLink
      :to="{ name: 'sheets' }"
      class="inline-flex items-center gap-1 text-xs font-medium text-ink-400 hover:text-ink-200"
    >
      <span aria-hidden="true">←</span> Sheet music
    </RouterLink>

    <header v-if="!renaming" class="flex items-start justify-between gap-4">
      <button type="button" class="min-w-0 text-left" @click="startRename">
        <h1 class="truncate text-xl">{{ sheet.title }}</h1>
        <p class="mt-0.5 truncate text-sm text-ink-400">
          {{ sheet.composer || 'Tap to add a title or composer' }}
        </p>
      </button>
      <button
        type="button"
        class="shrink-0 rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-medium text-ink-400 transition-colors hover:border-red-500/60 hover:text-red-300"
        @click="deleteSheet"
      >
        Delete
      </button>
    </header>

    <form v-else class="space-y-2" @submit.prevent="saveRename">
      <input
        v-model="titleDraft"
        type="text"
        placeholder="Title"
        aria-label="Title"
        class="w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-600 focus:border-brass-400 focus:outline-none"
      />
      <input
        v-model="composerDraft"
        type="text"
        placeholder="Composer"
        aria-label="Composer"
        class="w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-600 focus:border-brass-400 focus:outline-none"
      />
      <div class="flex gap-2">
        <button
          type="submit"
          class="rounded-lg bg-brass-400 px-4 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-brass-300"
        >
          Save
        </button>
        <button
          type="button"
          class="rounded-lg border border-ink-600 px-4 py-2 text-sm font-medium text-ink-200 transition-colors hover:border-ink-400"
          @click="renaming = false"
        >
          Cancel
        </button>
      </div>
    </form>

    <!-- The scan itself, with detected notes boxed over it. Tap the image to
         switch between fit-to-width and full size; tap a box to jump to that
         note in the strip below. -->
    <div v-if="imageUrl" class="relative overflow-auto rounded-xl border border-ink-700 bg-ink-50">
      <button
        type="button"
        class="block w-full"
        :aria-label="zoomed ? 'Fit image to width' : 'Zoom image'"
        @click="zoomed = !zoomed"
      >
        <img
          :src="imageUrl"
          :alt="`Sheet music for ${sheet.title}`"
          class="block"
          :class="zoomed ? 'w-auto max-w-none' : 'w-full'"
          :style="zoomed ? { height: '70svh' } : undefined"
        />
      </button>
      <SheetOverlay
        v-if="hasDetected"
        :boxes="draft.map((entry) => entry.bbox)"
        :selected-index="selectedIndex"
        :flagged="flaggedIndices"
        @select="selectedIndex = $event"
      />
    </div>

    <!-- Detection: progress, then anything the recogniser wants to warn about. -->
    <section v-if="recogniser.running.value" class="space-y-2 rounded-xl border border-ink-700 bg-ink-900 p-4">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm text-ink-200">{{ recogniser.stageLabel() }}…</p>
        <button
          type="button"
          class="shrink-0 text-xs font-medium text-ink-400 transition-colors hover:text-ink-200"
          @click="recogniser.cancel()"
        >
          Cancel
        </button>
      </div>
      <div class="h-1.5 overflow-hidden rounded-full bg-ink-800">
        <div
          class="h-full rounded-full bg-brass-400 transition-[width] duration-300"
          :style="{ width: `${Math.round((recogniser.progress.value?.fraction ?? 0) * 100)}%` }"
        />
      </div>
    </section>

    <p
      v-if="recogniser.error.value"
      class="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
    >
      {{ recogniser.error.value }} You can still enter the notes by hand.
    </p>

    <section v-if="detectionWarnings.length" class="space-y-2">
      <div
        v-for="warning in detectionWarnings"
        :key="warning.code"
        class="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3"
      >
        <p class="flex-1 text-xs leading-relaxed text-amber-100">{{ warning.message }}</p>
        <button
          type="button"
          class="shrink-0 text-[11px] font-medium text-amber-200/70 transition-colors hover:text-amber-100"
          @click="detectionWarnings = detectionWarnings.filter((w) => w !== warning)"
        >
          Dismiss
        </button>
      </div>
    </section>

    <!-- Dev-only: see what the recogniser saw. Invaluable when a scan reads
         badly, and the only way to tell which stage went wrong. -->
    <div v-if="isDev" class="flex items-center gap-2">
      <label class="flex cursor-pointer items-center gap-2 text-xs text-ink-400">
        <input v-model="showDebug" type="checkbox" class="h-3.5 w-3.5 accent-brass-400" />
        Show detection stages on next run
      </label>
    </div>
    <OmrDebugView
      v-if="isDev && recogniser.debug.value"
      :binarised="recogniser.debug.value.binarised"
      :staff-removed="recogniser.debug.value.staffRemoved"
      :eroded="recogniser.debug.value.eroded"
    />

    <!-- Key signature. Detection reads it, but it is the single most useful
         thing to be able to correct: one tap re-spells the whole piece. -->
    <section
      v-if="hasDetected && keyOverride"
      class="space-y-2 rounded-xl border border-ink-700 bg-ink-900 p-3"
    >
      <p class="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
        Key signature — tap to correct
      </p>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="choice in KEY_CHOICES"
          :key="choice.label"
          type="button"
          class="h-8 min-w-9 rounded-lg border px-2 text-sm font-semibold transition-colors"
          :class="
            isCurrentKey(choice.key)
              ? 'border-brass-400 bg-brass-400 text-ink-950'
              : 'border-ink-600 text-ink-200 hover:border-brass-400'
          "
          @click="applyKey(choice.key)"
        >
          {{ choice.label }}
        </button>
      </div>
    </section>

    <!-- Note sequence -->
    <section class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <h2 class="text-xs font-semibold uppercase tracking-wider text-ink-400">
          {{ draft.length }} {{ draft.length === 1 ? 'note' : 'notes' }}
        </h2>
        <div class="flex gap-2">
          <button
            v-if="draft.length && settings.audioEnabled"
            type="button"
            class="rounded-lg border border-ink-600 px-3 py-1.5 text-xs font-medium text-ink-200 transition-colors hover:border-brass-400"
            @click="togglePlayback"
          >
            {{ stopPlayback ? 'Stop' : 'Play through' }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-ink-600 px-3 py-1.5 text-xs font-medium text-ink-200 transition-colors hover:border-brass-400 disabled:opacity-50"
            :disabled="recogniser.running.value"
            @click="detect"
          >
            Detect notes
          </button>
          <button
            type="button"
            class="rounded-lg border border-ink-600 px-3 py-1.5 text-xs font-medium text-ink-200 transition-colors hover:border-brass-400"
            @click="editing = !editing"
          >
            {{ editing ? 'Done adding' : draft.length ? 'Add notes' : 'Note it down' }}
          </button>
        </div>
      </div>

      <div
        v-if="!draft.length && !editing"
        class="space-y-2 rounded-xl border border-dashed border-ink-700 px-4 py-8 text-center"
      >
        <p class="text-sm text-ink-400">
          Tap <strong class="text-ink-200">Detect notes</strong> to read them off the page
          automatically, or <strong class="text-ink-200">Note it down</strong> to enter them
          yourself.
        </p>
        <p class="text-xs text-ink-600">
          Detection works best on a flat scan or screenshot. Check what it finds — it is a
          head start, not the last word.
        </p>
      </div>

      <!-- Sequence strip -->
      <ol v-if="draft.length" class="flex flex-wrap gap-1.5">
        <li v-for="(entry, index) in resolved" :key="index">
          <button
            type="button"
            class="flex min-w-11 flex-col items-center rounded-lg border px-2 py-1.5 transition-colors"
            :class="
              selectedIndex === index
                ? 'border-brass-400 bg-ink-800'
                : 'border-ink-700 bg-ink-900 hover:border-ink-400'
            "
            @click="selectedIndex = selectedIndex === index ? null : index"
          >
            <NoteBadge :note="entry.note" size="sm" />
            <span v-if="!entry.chosen" class="text-[10px] text-amber-300">?</span>
            <!-- A dot marks a note the recogniser was unsure about, so attention
                 goes where it is actually needed rather than note by note. -->
            <span
              v-else-if="flaggedIndices.includes(index)"
              class="text-[10px] leading-none text-amber-300"
              :aria-label="`${entry.note} needs checking`"
              >•</span
            >
          </button>
        </li>
      </ol>

    </section>

    <!-- Detail for the selected note. Deliberately above the keypad: while
         transcribing, the fingering you just entered must stay in view without
         scrolling past the buttons you are tapping. -->
    <section
      v-if="selected"
      class="space-y-3 rounded-xl border border-ink-700 bg-ink-900 p-4"
      :aria-label="`Fingering for ${selected.note}`"
    >
      <div class="flex items-center gap-3">
        <StaffPosition :note="selected.note" size="sm" class="shrink-0" />
        <NoteBadge :note="selected.note" size="md" />
        <span class="text-xs text-ink-400">note {{ (selectedIndex ?? 0) + 1 }}</span>
        <button
          type="button"
          class="ml-auto text-xs font-medium text-ink-400 transition-colors hover:text-red-300"
          @click="removeAt(selectedIndex!)"
        >
          Remove
        </button>
      </div>

      <div v-if="selected.chosen" class="flex gap-4">
        <KeyChart
          :keys="selected.chosen.keys"
          :vented="selected.chosen.vented"
          size="md"
          class="shrink-0"
        />
        <div class="min-w-0 flex-1 space-y-2">
          <p class="font-mono text-xs break-words text-ink-200">
            {{ prettyCode(selected.chosen.code) }}
          </p>
          <p v-if="selected.chosen.comment" class="text-xs leading-relaxed text-ink-400">
            {{ selected.chosen.comment }}
          </p>

          <!-- Alternates, so an awkward passage can use a different fingering. -->
          <div v-if="selected.options.length > 1" class="space-y-1.5 pt-1">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              Use instead
            </p>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="option in selected.options"
                :key="option.id"
                type="button"
                class="rounded-md border px-2 py-1 text-[11px] font-medium transition-colors"
                :class="
                  option.id === selected.chosen.id
                    ? 'border-brass-400 bg-brass-400 text-ink-950'
                    : 'border-ink-600 text-ink-200 hover:border-brass-400'
                "
                @click="chooseFingering(selectedIndex!, option)"
              >
                {{ option.kind }}
              </button>
            </div>
          </div>

          <RouterLink
            :to="{ name: 'note', params: { note: canonicalNote(selected.chosen.midi) } }"
            class="inline-block pt-1 text-xs font-medium text-brass-400 hover:text-brass-300"
          >
            Open in note library →
          </RouterLink>
        </div>
      </div>

      <p v-else class="text-sm text-amber-200">
        No fingering on record for {{ noteLabel(selected.note) }} with your instrument setup.
      </p>
    </section>

    <NotePicker v-if="editing" @add="addNote" />

    <div v-if="dirty" class="sticky bottom-24 flex gap-2 md:bottom-4">
      <button
        type="button"
        class="flex-1 rounded-lg bg-brass-400 px-4 py-2.5 text-sm font-semibold text-ink-950 shadow-lg shadow-ink-950/50 transition-colors hover:bg-brass-300 disabled:opacity-50"
        :disabled="saving"
        @click="save"
      >
        {{ saving ? 'Saving…' : 'Save notes' }}
      </button>
      <button
        type="button"
        class="rounded-lg border border-ink-600 bg-ink-900 px-4 py-2.5 text-sm font-medium text-ink-200 shadow-lg shadow-ink-950/50 transition-colors hover:border-ink-400"
        @click="discard"
      >
        Discard
      </button>
    </div>
  </div>
</template>
