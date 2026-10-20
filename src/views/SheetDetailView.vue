<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import InstrumentMenu from '@/components/InstrumentMenu.vue'
import KeyChart from '@/components/KeyChart.vue'
import NoteBadge from '@/components/NoteBadge.vue'
import NotePicker from '@/components/NotePicker.vue'
import OmrDebugView from '@/components/OmrDebugView.vue'
import ScoreView from '@/components/ScoreView.vue'
import SheetOverlay from '@/components/SheetOverlay.vue'
import StaffPosition from '@/components/StaffPosition.vue'
import type { Sheet } from '@/data/db'
import { diatonicAtStaffPosition } from '@/domain/staff'
import { lettersAlteredBy } from '@/omr/pitch'
import { useRecogniser } from '@/omr/useRecogniser'
import type { KeySignature, OmrWarning } from '@/omr/types'
import { createBlobUrl, revokeBlobUrl } from '@/data/images'
import { playNote, playSequence } from '@/domain/audio'
import { type Fingering, prettyCode } from '@/domain/fingering'
import { canonicalNote, fingeringsForNote, noteLabel, noteRange, transposeBetween } from '@/domain/lookup'
import { CATALOG, type InstrumentId, loadInstrument } from '@/instruments'
import { Note } from 'tonal'
import { useSettingsStore } from '@/stores/settings'
import { sheetInstrument, useSheetsStore } from '@/stores/sheets'
import { emptyScore, eventId, type NoteEvent, type Score, toPlain } from '@/score/model'
import {
  fromSequence,
  notesOf,
  type SequenceItem,
  toPitchesMode,
  toRhythmMode,
  toSequence,
} from '@/score/ops'

/**
 * Feature 3, detail — the sheet as engraved music (or the photo it came
 * from), every note with its fingering.
 *
 * Notes are edited in a local draft and written back on save, so tapping
 * through a long piece doesn't hit IndexedDB on every keystroke.
 */

const route = useRoute()
const router = useRouter()
const store = useSheetsStore()
const settings = useSettingsStore()

const sheet = ref<Sheet | null>(null)

/**
 * The sheet's own instrument, not the globally selected one: its notes are in
 * that instrument's written pitch, so its fingerings, range and playback must
 * follow it even when the switch is set to something else.
 */
const context = computed(() => settings.contextFor(sheet.value ? sheetInstrument(sheet.value) : undefined))
/** Set when the sheet's instrument couldn't be downloaded (offline, never used). */
const instrumentMissing = ref<InstrumentId | null>(null)

/** Instruments the part can be rewritten for: the player's, plus its own. */
const convertOptions = computed(() => {
  const own = sheet.value ? sheetInstrument(sheet.value) : settings.instrumentId
  const wanted = new Set<InstrumentId>([...settings.visibleInstruments, own])
  return (Object.keys(CATALOG) as InstrumentId[]).filter((id) => wanted.has(id))
})

const imageUrl = ref<string | null>(null)
/**
 * The draft score. Edits replace it wholesale (every score operation returns
 * a new one), so `savedSnapshot` comparison is all dirtiness needs.
 */
const score = ref<Score>(emptyScore())
const savedSnapshot = ref('')
const editing = ref(false)
const selectedId = ref<string | null>(null)
const saving = ref(false)
const stopPlayback = ref<(() => void) | null>(null)
const zoomed = ref(false)
const renaming = ref(false)
const titleDraft = ref('')
const composerDraft = ref('')
const descriptionDraft = ref('')
/** What the page shows: the engraved score, or the photo it came from. */
const view = ref<'score' | 'photo'>('score')

// ── Automatic detection ────────────────────────────────────────────────────
const recogniser = useRecogniser()
/** Warnings from the last run, shown until dismissed. */
const detectionWarnings = ref<OmrWarning[]>([])
/** Ids of the detected notes each warning's `noteIndices` points at. */
const detectedIds = ref<string[]>([])
const showDebug = ref(false)
/** The stage inspector is a development tool; it never ships to a real user. */
const isDev = import.meta.env.DEV
/** Key signature override — changing it re-derives pitches with no re-scan. */
const keyOverride = ref<KeySignature | null>(null)
/** Staff positions of detected notes, by event id, needed to re-derive on a key change. */
const detectedRelatives = ref(new Map<string, number>())

const dirty = computed(() => JSON.stringify(toPlain(score.value)) !== savedSnapshot.value)

/** The score in reading order — what selection, the overlay and the quick fixes index. */
const items = computed(() => toSequence(score.value))
const selectedIndex = computed(() =>
  selectedId.value === null ? null : items.value.findIndex((item) => item.event.id === selectedId.value),
)

/** Replace the draft's reading-order list; measures and their attributes follow. */
function commit(next: SequenceItem[]) {
  score.value = fromSequence(next, score.value)
}

/** Change one event in place. */
function updateAt(index: number, change: (event: NoteEvent) => NoteEvent) {
  const next = [...items.value]
  const item = next[index]
  if (!item || item.event.kind !== 'note') return
  next[index] = { ...item, event: change(item.event) }
  commit(next)
}

async function load() {
  const id = String(route.params.id)
  const found = await store.get(id)
  if (!found) {
    await router.replace({ name: 'sheets' })
    return
  }
  // Its notes only make sense with its instrument's fingerings.
  try {
    await loadInstrument(sheetInstrument(found))
    instrumentMissing.value = null
  } catch {
    instrumentMissing.value = sheetInstrument(found)
    sheet.value = null
    return
  }
  sheet.value = found
  revokeBlobUrl(imageUrl.value)
  imageUrl.value = createBlobUrl(found.image)

  score.value = await store.scoreFor(id)
  savedSnapshot.value = JSON.stringify(toPlain(score.value))
  view.value = notesOf(score.value).length ? 'score' : 'photo'
  detectionWarnings.value = []
  detectedIds.value = []
  detectedRelatives.value = new Map()
  keyOverride.value = null
  selectedId.value = null
}

onMounted(load)
watch(() => route.params.id, load)

onUnmounted(() => {
  revokeBlobUrl(imageUrl.value)
  stopPlayback.value?.()
})

/** Fingerings for every note, resolved once per draft change. */
const resolved = computed(() =>
  items.value.map((item) => {
    if (item.event.kind !== 'note') return { ...item, note: null, options: [], chosen: null }
    const note = item.event
    const options = fingeringsForNote(note.pitch, context.value)
    const chosen = options.find((option) => option.id === note.chosenFingeringId) ?? options[0] ?? null
    return { ...item, note, options, chosen }
  }),
)

const selected = computed(() => {
  const index = selectedIndex.value
  if (index === null || index < 0) return null
  const entry = resolved.value[index]
  return entry?.note ? { ...entry, note: entry.note, pitch: entry.note.pitch } : null
})

const noteCount = computed(() => notesOf(score.value).length)

/** Where a new note starts: a quarter in rhythm mode, nothing in pitches mode. */
function newNote(pitch: string): NoteEvent {
  return {
    kind: 'note',
    id: eventId(),
    pitch,
    source: 'manual',
    ...(score.value.mode === 'rhythm' ? { duration: { type: 'quarter' as const, dots: 0 } } : {}),
  }
}

function addNote(pitch: string) {
  const note = newNote(pitch)
  commit([...items.value, { event: note, barAfter: false }])
  selectedId.value = note.id
  if (settings.audioEnabled) playNote(pitch, context.value.instrument, 0.4)
}

/**
 * Run automatic detection and load the result into the draft as suggestions.
 *
 * Nothing is saved: the result lands in the same unsaved draft the manual picker
 * writes to, so reviewing, correcting and saving all work exactly as before. If
 * detection fails or finds nothing, the manual editor is untouched and still the
 * way through. Detection reads pitches, so the result is a pitches-mode score,
 * its measures where the page's barlines are.
 */
async function detect() {
  if (!sheet.value) return
  if (noteCount.value && !window.confirm('Replace the notes already entered with detected ones?')) {
    return
  }

  const outcome = await recogniser.run(sheet.value.image, {
    debug: showDebug.value,
    context: context.value,
  })
  if (!outcome) return

  detectionWarnings.value = outcome.warnings
  keyOverride.value = outcome.keySignature
  const events = outcome.notes.map(
    (note): NoteEvent => ({
      kind: 'note',
      id: eventId(),
      pitch: note.note,
      bbox: note.bbox,
      source: 'detected',
      confidence: note.confidence,
    }),
  )
  detectedIds.value = events.map((e) => e.id)
  detectedRelatives.value = new Map(events.map((e, i) => [e.id, outcome.notes[i].relative]))
  const fifths = outcome.keySignature.kind === '#' ? outcome.keySignature.count : -outcome.keySignature.count
  const detected: Score = { mode: 'pitches', clef: 'treble', measures: [{ id: eventId(), events: [], keyFifths: fifths }] }
  score.value = fromSequence(
    events.map((event, i) => ({
      event,
      barAfter: outcome.notes[i + 1] !== undefined && outcome.notes[i + 1].measureIndex !== outcome.notes[i].measureIndex,
    })),
    detected,
  )
  selectedId.value = events[0]?.id ?? null
  editing.value = false
  view.value = 'score'
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
  commit(
    items.value.map((item) => {
      const relative = detectedRelatives.value.get(item.event.id)
      if (relative == null || item.event.kind !== 'note') return item
      const { letter, octave } = diatonicAtStaffPosition(relative)
      return { ...item, event: { ...item.event, pitch: `${letter}${altered.get(letter) ?? ''}${octave}` } }
    }),
  )
  const fifths = key.kind === '#' ? key.count : -key.count
  score.value = {
    ...score.value,
    measures: score.value.measures.map((m, i) => (i === 0 ? { ...m, keyFifths: fifths } : m)),
  }
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
const flaggedIds = computed(() => {
  const flagged = new Set<string>()
  for (const warning of detectionWarnings.value) {
    for (const index of warning.noteIndices ?? []) {
      const id = detectedIds.value[index]
      if (id) flagged.add(id)
    }
  }
  for (const note of notesOf(score.value)) {
    if (note.confidence != null && note.confidence < 0.45) flagged.add(note.id)
  }
  return [...flagged]
})

const hasDetected = computed(() => notesOf(score.value).some((note) => note.source === 'detected'))

function removeAt(index: number) {
  const next = [...items.value]
  // A barline after the removed note stays where it was, after the note before.
  if (next[index].barAfter && index > 0) next[index - 1] = { ...next[index - 1], barAfter: true }
  next.splice(index, 1)
  commit(next)
  selectedId.value = next[Math.min(index, next.length - 1)]?.event.id ?? null
}

/**
 * Quick corrections for the commonest misreads: a semitone (a missed or
 * misread accidental) and a staff step (a notehead read a line too high or
 * low). The fingering choice is reset — it belonged to the old pitch.
 */
function shiftSemitone(index: number, delta: number) {
  updateAt(index, (note) => {
    const midi = Note.midi(note.pitch)
    if (midi == null) return note
    // An octave moves the note seven staff steps; keep that if the key is re-applied.
    const relative = detectedRelatives.value.get(note.id)
    if (Math.abs(delta) === 12 && relative != null) detectedRelatives.value.set(note.id, relative + Math.sign(delta) * 7)
    return { ...note, pitch: canonicalNote(midi + delta), chosenFingeringId: undefined }
  })
  const event = items.value[index]?.event
  if (settings.audioEnabled && event?.kind === 'note') playNote(event.pitch, context.value.instrument, 0.4)
}

function shiftStep(index: number, delta: number) {
  updateAt(index, (note) => {
    const parsed = Note.get(note.pitch)
    if (parsed.empty || parsed.oct == null) return note
    const diatonic = parsed.oct * 7 + parsed.step + delta
    const letter = 'CDEFGAB'[((diatonic % 7) + 7) % 7]
    const octave = Math.floor(diatonic / 7)
    // The new line or space takes the key signature's accidental, if one is known.
    const accidental = keyOverride.value ? (lettersAlteredBy(keyOverride.value).get(letter) ?? '') : ''
    const relative = detectedRelatives.value.get(note.id)
    if (relative != null) detectedRelatives.value.set(note.id, relative + delta)
    return { ...note, pitch: `${letter}${accidental}${octave}`, chosenFingeringId: undefined }
  })
  const event = items.value[index]?.event
  if (settings.audioEnabled && event?.kind === 'note') playNote(event.pitch, context.value.instrument, 0.4)
}

/**
 * Move the whole piece an octave. Handy when a part is written an octave away
 * from where the instrument reads it, or detection got the clef's octave wrong.
 */
function shiftAllOctaves(delta: number) {
  commit(
    items.value.map((item) => {
      if (item.event.kind !== 'note') return item
      const midi = Note.midi(item.event.pitch)
      if (midi == null) return item
      const relative = detectedRelatives.value.get(item.event.id)
      if (relative != null) detectedRelatives.value.set(item.event.id, relative + delta * 7)
      return { ...item, event: { ...item.event, pitch: canonicalNote(midi + delta * 12), chosenFingeringId: undefined } }
    }),
  )
}

/** Empty the draft. Nothing is lost until saved — Discard brings it back. */
function clearAll() {
  if (!noteCount.value) return
  if (!window.confirm(`Remove all ${noteCount.value} notes? You can still discard before saving.`)) return
  stopPlayback.value?.()
  stopPlayback.value = null
  score.value = emptyScore(score.value.mode)
  detectedRelatives.value = new Map()
  detectionWarnings.value = []
  selectedId.value = null
}

/** Add or remove the barline after a note. */
function toggleBar(index: number) {
  const next = [...items.value]
  if (!next[index]) return
  next[index] = { ...next[index], barAfter: !next[index].barAfter }
  commit(next)
}

/** A copy of the selected note right after it, to fix a note detection missed. */
function insertAfter(index: number) {
  const item = items.value[index]
  if (!item || item.event.kind !== 'note') return
  const copy: NoteEvent = { ...newNote(item.event.pitch), ...(item.event.duration ? { duration: item.event.duration } : {}) }
  const next = [...items.value]
  // The copy takes over the barline, so it lands in the same measure.
  next.splice(index, 1, { ...item, barAfter: false }, { event: copy, barAfter: item.barAfter })
  commit(next)
  const relative = detectedRelatives.value.get(item.event.id)
  if (relative != null) detectedRelatives.value.set(copy.id, relative)
  selectedId.value = copy.id
}

function chooseFingering(index: number, fingering: Fingering) {
  const options = resolved.value[index].options
  // Storing the id only when it differs from the default keeps backups small
  // and lets the primary fingering follow future data corrections.
  updateAt(index, (note) => ({
    ...note,
    chosenFingeringId: fingering.id === options[0]?.id ? undefined : fingering.id,
  }))
}

/** Pitches only, or with rhythm. Durations are kept while hidden. */
function setMode(mode: Score['mode']) {
  if (mode === score.value.mode) return
  score.value = mode === 'rhythm' ? toRhythmMode(score.value) : toPitchesMode(score.value)
}

async function save() {
  if (!sheet.value) return
  saving.value = true
  try {
    await store.saveScore(sheet.value.id, score.value)
    savedSnapshot.value = JSON.stringify(toPlain(score.value))
    editing.value = false
  } finally {
    saving.value = false
  }
}

function discard() {
  score.value = JSON.parse(savedSnapshot.value) as Score
  editing.value = false
  selectedId.value = null
}

function togglePlayback() {
  if (stopPlayback.value) {
    stopPlayback.value()
    stopPlayback.value = null
    return
  }
  if (!noteCount.value) return
  stopPlayback.value = playSequence(
    notesOf(score.value).map((note) => note.pitch),
    context.value.instrument,
  )
}

function startRename() {
  if (!sheet.value) return
  titleDraft.value = sheet.value.title
  composerDraft.value = sheet.value.composer
  descriptionDraft.value = sheet.value.description ?? ''
  renaming.value = true
}

async function saveRename() {
  if (!sheet.value) return
  await store.updateMeta(sheet.value.id, {
    title: titleDraft.value.trim() || sheet.value.title,
    composer: composerDraft.value,
    description: descriptionDraft.value.trim(),
  })
  sheet.value = (await store.get(sheet.value.id)) ?? sheet.value
  renaming.value = false
}


/**
 * Rewrite the piece for another instrument at the same sounding pitch. Warns
 * first about notes that fall outside the target's range, since those will
 * show no fingering until corrected.
 */
async function convertTo(id: InstrumentId) {
  if (!sheet.value) return
  if (dirty.value) {
    window.alert('Save or discard your changes first.')
    return
  }
  let target
  try {
    target = await loadInstrument(id)
  } catch {
    window.alert(`Couldn’t download the ${CATALOG[id].noun} — you seem to be offline.`)
    return
  }
  const playable = new Set(noteRange(settings.contextFor(id)).map((entry) => entry.midi))
  const outside = notesOf(score.value).filter((entry) => {
    const written = transposeBetween(entry.pitch, context.value.instrument, target)
    const midi = written ? Note.midi(written) : null
    return midi == null || !playable.has(midi)
  }).length
  const warning = outside
    ? `\n\n${outside} ${outside === 1 ? 'note falls' : 'notes fall'} outside the ${target.noun}'s range.`
    : ''
  if (
    !window.confirm(
      `Rewrite "${sheet.value.title}" for the ${target.noun}? Notes are transposed so the piece sounds the same.${warning}`,
    )
  ) {
    return
  }
  await store.convertInstrument(sheet.value.id, id)
  await settings.selectInstrument(id)
  await load()
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
          {{ sheet.composer || 'Tap to add a title, composer or description' }}
        </p>
        <p v-if="sheet.description" class="mt-1.5 text-sm whitespace-pre-line text-ink-200">
          {{ sheet.description }}
        </p>
      </button>
      <div class="flex shrink-0 gap-2">
        <button
          type="button"
          class="shrink-0 rounded-lg border border-ink-700 px-3 py-1.5 text-xs font-medium text-ink-400 transition-colors hover:border-red-500/60 hover:text-red-300"
          @click="deleteSheet"
        >
          Delete
        </button>
      </div>
    </header>

    <!-- The instrument this part is written for. Switching rewrites every note
         into the new instrument's written pitch, so the piece sounds the same. -->
    <div v-if="!renaming" class="space-y-1.5">
      <p class="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
        Notes written for — pick another to transpose
      </p>
      <InstrumentMenu
        :current="context.instrument.id"
        :options="convertOptions"
        label="Instrument of this part"
        class="max-w-xs"
        @select="convertTo"
      />
    </div>

    <form v-else class="space-y-2" @submit.prevent="saveRename">
      <input
        v-model="titleDraft"
        type="text"
        placeholder="Title"
        aria-label="Title"
        class="w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-600 focus:border-accent-400 focus:outline-none"
      />
      <input
        v-model="composerDraft"
        type="text"
        placeholder="Composer"
        aria-label="Composer"
        class="w-full rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-600 focus:border-accent-400 focus:outline-none"
      />
      <textarea
        v-model="descriptionDraft"
        rows="3"
        placeholder="Description"
        aria-label="Description"
        class="w-full resize-y rounded-lg border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-ink-50 placeholder:text-ink-600 focus:border-accent-400 focus:outline-none"
      />
      <div class="flex gap-2">
        <button
          type="submit"
          class="rounded-lg bg-accent-400 px-4 py-2 text-sm font-semibold text-ink-950 transition-colors hover:bg-accent-300"
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

    <!-- The engraved score, or the photo it came from. Detected notes are
         boxed on the photo; tapping a box or a note selects it in both. -->
    <div class="space-y-2">
      <div role="tablist" aria-label="Show" class="inline-flex rounded-lg border border-ink-700 bg-ink-950 p-0.5">
        <button
          v-for="option in (['score', 'photo'] as const)"
          :key="option"
          type="button"
          role="tab"
          :aria-selected="view === option"
          class="rounded-md px-3 py-1 text-xs font-semibold transition-colors"
          :class="view === option ? 'bg-accent-400 text-ink-950' : 'text-ink-400 hover:text-ink-200'"
          @click="view = option"
        >
          {{ option === 'score' ? 'Score' : 'Photo' }}
        </button>
      </div>

      <ScoreView
        v-if="view === 'score' && noteCount"
        :score="score"
        :selected-id="selectedId"
        :flagged="flaggedIds"
        @select="selectedId = $event === selectedId ? null : $event"
      />

      <div v-else-if="imageUrl" class="relative overflow-auto rounded-xl border border-ink-700 bg-ink-50">
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
          :boxes="items.map((item) => (item.event.kind === 'note' ? item.event.bbox : undefined))"
          :selected-index="selectedIndex"
          :flagged="items.flatMap((item, index) => (flaggedIds.includes(item.event.id) ? [index] : []))"
          @select="selectedId = items[$event]?.event.id ?? null"
        />
      </div>
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
          class="h-full rounded-full bg-accent-400 transition-[width] duration-300"
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
        <input v-model="showDebug" type="checkbox" class="h-3.5 w-3.5 accent-accent-400" />
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
              ? 'border-accent-400 bg-accent-400 text-ink-950'
              : 'border-ink-600 text-ink-200 hover:border-accent-400'
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
          {{ noteCount }} {{ noteCount === 1 ? 'note' : 'notes' }}
        </h2>
        <div class="flex gap-2">
          <button
            v-if="noteCount && settings.audioEnabled"
            type="button"
            class="rounded-lg border border-ink-600 px-3 py-1.5 text-xs font-medium text-ink-200 transition-colors hover:border-accent-400"
            @click="togglePlayback"
          >
            {{ stopPlayback ? 'Stop' : 'Play through' }}
          </button>
          <button
            type="button"
            class="rounded-lg border border-ink-600 px-3 py-1.5 text-xs font-medium text-ink-200 transition-colors hover:border-accent-400 disabled:opacity-50"
            :disabled="recogniser.running.value"
            @click="detect"
          >
            Detect notes
          </button>
          <button
            type="button"
            class="rounded-lg border border-ink-600 px-3 py-1.5 text-xs font-medium text-ink-200 transition-colors hover:border-accent-400"
            @click="editing = !editing"
          >
            {{ editing ? 'Done adding' : noteCount ? 'Add notes' : 'Note it down' }}
          </button>
        </div>
      </div>

      <!-- Pitches only, or with rhythm: durations are kept while hidden. -->
      <div v-if="noteCount" role="radiogroup" aria-label="Notation" class="flex flex-wrap items-center gap-2">
        <div class="inline-flex rounded-lg border border-ink-700 bg-ink-950 p-0.5">
          <button
            v-for="mode in (['pitches', 'rhythm'] as const)"
            :key="mode"
            type="button"
            role="radio"
            :aria-checked="score.mode === mode"
            class="rounded-md px-3 py-1 text-xs font-semibold transition-colors"
            :class="score.mode === mode ? 'bg-accent-400 text-ink-950' : 'text-ink-400 hover:text-ink-200'"
            @click="setMode(mode)"
          >
            {{ mode === 'pitches' ? 'Pitches only' : 'With rhythm' }}
          </button>
        </div>
        <span class="text-[11px] text-ink-400">
          {{
            score.mode === 'pitches'
              ? 'Order of notes only — no durations.'
              : 'Durations, measures and time signature.'
          }}
        </span>
      </div>

      <!-- Whole-sequence edits. They only touch the draft, so Discard undoes them. -->
      <div v-if="noteCount" class="flex flex-wrap gap-1.5" aria-label="Edit all notes">
        <button
          type="button"
          title="Move every note down an octave"
          class="rounded-md border border-ink-600 px-2 py-1 text-[11px] font-medium text-ink-200 transition-colors hover:border-accent-400"
          @click="shiftAllOctaves(-1)"
        >
          All ▼ octave
        </button>
        <button
          type="button"
          title="Move every note up an octave"
          class="rounded-md border border-ink-600 px-2 py-1 text-[11px] font-medium text-ink-200 transition-colors hover:border-accent-400"
          @click="shiftAllOctaves(1)"
        >
          All ▲ octave
        </button>
        <button
          type="button"
          title="Remove every note"
          class="ml-auto rounded-md border border-ink-600 px-2 py-1 text-[11px] font-medium text-ink-400 transition-colors hover:border-red-500/60 hover:text-red-300"
          @click="clearAll"
        >
          Clear all
        </button>
      </div>

      <div
        v-if="!noteCount && !editing"
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

    </section>

    <!-- Detail for the selected note. Deliberately above the keypad: while
         transcribing, the fingering you just entered must stay in view without
         scrolling past the buttons you are tapping. -->
    <section
      v-if="selected"
      class="space-y-3 rounded-xl border border-ink-700 bg-ink-900 p-4"
      :aria-label="`Details for ${selected.pitch}`"
    >
      <div class="flex items-center gap-3">
        <StaffPosition :note="selected.pitch" size="sm" class="shrink-0" />
        <NoteBadge :note="selected.pitch" size="md" />
        <span class="text-xs text-ink-400">note {{ (selectedIndex ?? 0) + 1 }}</span>
        <button
          type="button"
          class="ml-auto text-xs font-medium text-ink-400 transition-colors hover:text-red-300"
          @click="removeAt(selectedIndex!)"
        >
          Remove
        </button>
      </div>

      <!-- One-tap fixes for what detection most often gets wrong. -->
      <div class="flex flex-wrap gap-1.5" aria-label="Correct this note">
        <button
          v-for="fix in [
            { label: '♭ −½', title: 'Down a semitone', run: () => shiftSemitone(selectedIndex!, -1) },
            { label: '♯ +½', title: 'Up a semitone', run: () => shiftSemitone(selectedIndex!, 1) },
            { label: '▼ step', title: 'Down a line or space', run: () => shiftStep(selectedIndex!, -1) },
            { label: '▲ step', title: 'Up a line or space', run: () => shiftStep(selectedIndex!, 1) },
            { label: '8vb', title: 'Down an octave', run: () => shiftSemitone(selectedIndex!, -12) },
            { label: '8va', title: 'Up an octave', run: () => shiftSemitone(selectedIndex!, 12) },
            { label: '+ after', title: 'Insert a note after this one', run: () => insertAfter(selectedIndex!) },
            {
              label: selected.barAfter ? '− divider' : '| divider',
              title: selected.barAfter ? 'Remove the divider after this note' : 'Add a divider after this note',
              run: () => toggleBar(selectedIndex!),
            },
          ]"
          :key="fix.label"
          type="button"
          :title="fix.title"
          class="rounded-md border border-ink-600 px-2 py-1 text-[11px] font-medium text-ink-200 transition-colors hover:border-accent-400"
          @click="fix.run()"
        >
          {{ fix.label }}
        </button>
      </div>

      <div v-if="selected.chosen" class="flex gap-4">
        <KeyChart
          :keys="selected.chosen.keys"
          :partial="selected.chosen.partial"
          :instrument="context.instrument"
          size="sm"
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
                    ? 'border-accent-400 bg-accent-400 text-ink-950'
                    : 'border-ink-600 text-ink-200 hover:border-accent-400'
                "
                @click="chooseFingering(selectedIndex!, option)"
              >
                {{ option.kind }}
              </button>
            </div>
          </div>

          <RouterLink
            :to="{ name: 'note', params: { note: canonicalNote(selected.chosen.midi) } }"
            class="inline-block pt-1 text-xs font-medium text-accent-400 hover:text-accent-300"
          >
            Open in note library →
          </RouterLink>
        </div>
      </div>

      <p v-else class="text-sm text-amber-200">
        No fingering on record for {{ noteLabel(selected.pitch) }} with your instrument setup.
      </p>
    </section>

    <NotePicker
      v-if="editing"
      :context="context"
      :can-bar="items.length > 0"
      @add="addNote"
      @bar="toggleBar(items.length - 1)"
    />

    <div v-if="dirty" class="sticky bottom-24 flex gap-2 md:bottom-4">
      <button
        type="button"
        class="flex-1 rounded-lg bg-accent-400 px-4 py-2.5 text-sm font-semibold text-ink-950 shadow-lg shadow-ink-950/50 transition-colors hover:bg-accent-300 disabled:opacity-50"
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
  <p
    v-else-if="instrumentMissing"
    class="rounded-xl border border-ink-700 bg-ink-900 px-4 py-6 text-sm text-ink-400"
  >
    This sheet is written for the {{ CATALOG[instrumentMissing].noun }}, which hasn’t been downloaded to
    this device yet. Connect to the internet and open it again.
  </p>
</template>