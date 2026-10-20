<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import BottomSheet from '@/components/BottomSheet.vue'
import FingeringStrip, { type StripEntry } from '@/components/FingeringStrip.vue'
import MeasureTools from '@/components/MeasureTools.vue'
import PianoKeyboard from '@/components/PianoKeyboard.vue'
import ScorePalette from '@/components/ScorePalette.vue'
import type { StaffTap } from '@/components/ScoreView.vue'
import { onBeforeRouteLeave, RouterLink, useRoute, useRouter } from 'vue-router'
import KeyChart from '@/components/KeyChart.vue'
import NoteBadge from '@/components/NoteBadge.vue'
import OmrDebugView from '@/components/OmrDebugView.vue'
import ScoreView from '@/components/ScoreView.vue'
import SheetOverlay from '@/components/SheetOverlay.vue'
import type { Sheet } from '@/data/db'
import { diatonicAtStaffPosition } from '@/domain/staff'
import { lettersAlteredBy } from '@/omr/pitch'
import { useRecogniser } from '@/omr/useRecogniser'
import type { KeySignature, OmrResult, OmrWarning } from '@/omr/types'
import { createBlobUrl, revokeBlobUrl } from '@/data/images'
import { playNote } from '@/domain/audio'
import { playScore } from '@/domain/player'
import { scoreToMusicXml } from '@/domain/musicxmlExport'
import { type Fingering, prettyCode } from '@/domain/fingering'
import { canonicalNote, fingeringsForNote, noteLabel, noteRange, transposeBetween } from '@/domain/lookup'
import { CATALOG, type InstrumentId, loadInstrument } from '@/instruments'
import { Note } from 'tonal'
import { useSettingsStore } from '@/stores/settings'
import { sheetInstrument, useSheetsStore } from '@/stores/sheets'
import { type Duration, type DurationType, emptyScore, eventId, type NoteEvent, type Score, toPlain } from '@/score/model'
import {
  cycleDots,
  eventById,
  firstOffMeasure,
  insertAfter as insertEventAfter,
  insertAt,
  keyAlterations,
  locate,
  patchMeasure,
  pitchAt,
  rebarFrom,
  removeEvent,
  setAccidental,
  setDuration,
  toggleRest,
  toggleTie,
} from '@/score/edit'
import {
  fromSequence,
  keyAt,
  measureFill,
  notesOf,
  type SequenceItem,
  toPitchesMode,
  toRhythmMode,
  timeAt,
  toSequence,
} from '@/score/ops'

/**
 * Feature 3, detail — the sheet as engraved music (or the photo it came
 * from), every note with its fingering. Full screen on a phone: a top bar,
 * the score, and at the bottom whatever the moment needs — the fingering
 * strip and player while reading, the keyboard while editing, the review
 * after detection. Everything else waits in bottom sheets.
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
const titleDraft = ref('')
const composerDraft = ref('')
const descriptionDraft = ref('')
/** What the page shows: the engraved score, or the photo it came from. */
const view = ref<'score' | 'photo'>('score')
/** The bottom sheet open, if any. */
const panel = ref<null | 'menu' | 'fingering' | 'measure' | 'key' | 'rename' | 'instrument'>(null)

/** Letter names under the notes — a reading aid, remembered on this device. */
const NAMES_KEY = 'fluteapp.sheetNoteNames'
const noteNames = ref(readNoteNames())
function readNoteNames(): boolean {
  try {
    return localStorage.getItem(NAMES_KEY) === '1'
  } catch {
    return false
  }
}
watch(noteNames, (on) => {
  try {
    localStorage.setItem(NAMES_KEY, on ? '1' : '0')
  } catch {
    // Storage disabled: the choice lasts until the page closes.
  }
})

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

// ── Undo / redo ────────────────────────────────────────────────────────────
// Every edit replaces the score, so history is just the scores it replaced.
const history = ref<Score[]>([])
const future = ref<Score[]>([])
let replaying = false
watch(
  score,
  (_, previous) => {
    if (replaying || !previous) return
    history.value.push(previous)
    if (history.value.length > 200) history.value.shift()
    future.value = []
  },
  { flush: 'sync' },
)

/** Set the score without it counting as an edit (loading, undo, redo). */
function replace(next: Score) {
  replaying = true
  score.value = next
  replaying = false
}

function undo() {
  const previous = history.value.pop()
  if (!previous) return
  future.value.push(score.value)
  replace(previous)
}

function redo() {
  const next = future.value.pop()
  if (!next) return
  history.value.push(score.value)
  replace(next)
}

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

  replace(await store.scoreFor(id))
  tempo.value = score.value.tempo ?? 90
  history.value = []
  future.value = []
  savedSnapshot.value = JSON.stringify(toPlain(score.value))
  view.value = 'score'
  detectionWarnings.value = []
  detectedIds.value = []
  detectedRelatives.value = new Map()
  keyOverride.value = null
  selectedId.value = null
  reviewed.value = new Set()
  titleDraft.value = found.title
  composerDraft.value = found.composer
  // "Start blank" in the library lands straight in the editor.
  if (route.query.edit) {
    editing.value = true
    void router.replace({ query: {} })
  }
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

/** The fingering strip: every note in reading order, barlines kept. */
const stripEntries = computed<StripEntry[]>(() =>
  resolved.value.flatMap((entry) =>
    entry.note
      ? [{ id: entry.event.id, pitch: entry.note.pitch, fingering: entry.chosen, barAfter: entry.barAfter }]
      : [],
  ),
)

/** The measure being read: the sounding note's, else the selection's. */
const currentMeasure = computed(() => {
  const id = playingId.value ?? selectedId.value
  const at = id ? locate(score.value, id) : null
  return at ? at.measure : null
})

/** A tap in the strip: select and hear it; a second tap opens its fingerings. */
function onStripSelect(id: string) {
  if (id === selectedId.value && !playingId.value) {
    panel.value = 'fingering'
    return
  }
  selectedId.value = id
  const event = eventById(score.value, id)
  if (settings.audioEnabled && event?.kind === 'note') playNote(event.pitch, context.value.instrument, 0.5)
}

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

/** Duration new notes get in rhythm mode — the last one picked on the palette. */
const inputDuration = ref<Duration>({ type: 'quarter', dots: 0 })

/** Type a note in: after the selection (or at the end), then select it. */
function addNote(pitch: string) {
  const note = newNote(pitch)
  score.value =
    !selectedId.value && measureCursor.value !== null && score.value.measures[measureCursor.value]
      ? insertAt(score.value, { measure: measureCursor.value, index: score.value.measures[measureCursor.value].events.length }, note)
      : insertEventAfter(score.value, selectedId.value, note)
  measureCursor.value = null
  selectedId.value = note.id
  if (settings.audioEnabled) playNote(pitch, context.value.instrument, 0.4)
}

/** A tap on an empty spot of the staff: that line or space, at that place. */
function onStaffTap(tap: StaffTap) {
  const pitch = pitchAt(tap.relative, keyAt(score.value, tap.measureIndex))
  const note = newNote(pitch)
  score.value = tap.afterId
    ? insertEventAfter(score.value, tap.afterId, note)
    : insertAt(score.value, { measure: tap.measureIndex, index: 0 }, note)
  selectedId.value = note.id
  if (settings.audioEnabled) playNote(pitch, context.value.instrument, 0.4)
}

const selectedEvent = computed(() => (selectedId.value ? eventById(score.value, selectedId.value) : null))
/** A measure stepped to with nothing in it to select. */
const measureCursor = ref<number | null>(null)
/** The measure the measure tools work on: the selection's, else the one stepped to, else the last. */
const toolMeasure = computed(() => {
  const at = selectedId.value ? locate(score.value, selectedId.value) : null
  const last = score.value.measures.length - 1
  return at?.measure ?? Math.min(measureCursor.value ?? last, last)
})
const offMeasures = computed(() =>
  score.value.mode === 'rhythm' ? measureFill(score.value).filter((fill) => fill !== 'ok').length : 0,
)

function paletteDuration(type: DurationType) {
  inputDuration.value = { type, dots: 0 }
  if (selectedId.value) {
    const dots = selectedEvent.value?.duration?.dots ?? 0
    score.value = setDuration(score.value, selectedId.value, { type, dots })
  }
}

function paletteDot() {
  if (selectedId.value) score.value = cycleDots(score.value, selectedId.value)
}

function paletteRest() {
  if (!selectedId.value) return
  const previous = [...notesOf(score.value)].reverse().find((n) => n.id !== selectedId.value)
  score.value = toggleRest(score.value, selectedId.value, previous?.pitch ?? 'B4')
}

function paletteTie() {
  if (selectedId.value) score.value = toggleTie(score.value, selectedId.value)
}

function paletteAccidental(alter: -1 | 0 | 1) {
  if (!selectedId.value) return
  score.value = setAccidental(score.value, selectedId.value, alter)
  const event = selectedEvent.value
  if (settings.audioEnabled && event?.kind === 'note') playNote(event.pitch, context.value.instrument, 0.4)
}

function paletteRemove() {
  const index = selectedIndex.value
  if (index === null || index < 0) return
  const id = items.value[index].event.id
  const next = items.value[index + 1]?.event.id ?? items.value[index - 1]?.event.id ?? null
  score.value = removeEvent(score.value, id)
  selectedId.value = next
}

function addMeasureAfter() {
  const index = toolMeasure.value
  const measures = [...score.value.measures]
  measures.splice(index + 1, 0, { id: eventId(), events: [] })
  score.value = { ...score.value, measures }
  // Onto the new measure, so the next notes typed land in it.
  selectedId.value = null
  measureCursor.value = index + 1
}

/** Step the measure sheet to the measure before or after, selecting its first event. */
function moveMeasure(delta: number) {
  const index = toolMeasure.value + delta
  const target = score.value.measures[index]
  if (!target) return
  selectedId.value = target.events[0]?.id ?? null
  measureCursor.value = index
}

function removeMeasure() {
  if (score.value.measures.length < 2) return
  const index = toolMeasure.value
  const count = score.value.measures[index].events.length
  if (count && !window.confirm(`Delete measure ${index + 1} and its ${count} ${count === 1 ? 'event' : 'events'}?`)) return
  score.value = { ...score.value, measures: score.value.measures.filter((_, i) => i !== index) }
  selectedId.value = null
}

/**
 * Desktop shortcuts while editing, after MuseScore: 2–7 durations (32nd to
 * whole), . dot, 0 rest, A–G type a note, ↑/↓ semitone (with Ctrl an
 * octave), ←/→ move the selection, Del delete, + tie, Ctrl+Z / Ctrl+Shift+Z.
 */
function onKeydown(event: KeyboardEvent) {
  if (!editing.value) return
  const target = event.target as HTMLElement | null
  if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return
  const ctrl = event.ctrlKey || event.metaKey
  const key = event.key
  const index = selectedIndex.value ?? -1
  const handled = (() => {
    if (ctrl && key.toLowerCase() === 'z') return event.shiftKey ? redo() : undo(), true
    if (ctrl && key.toLowerCase() === 'y') return redo(), true
    if (ctrl) return false
    const durations: Record<string, DurationType> = { '2': '32nd', '3': '16th', '4': 'eighth', '5': 'quarter', '6': 'half', '7': 'whole' }
    if (durations[key] && score.value.mode === 'rhythm') return paletteDuration(durations[key]), true
    if (key === '.') return paletteDot(), true
    if (key === '0') return paletteRest(), true
    if (key === '+') return paletteTie(), true
    if (key === 'Delete' || key === 'Backspace') return paletteRemove(), true
    if (key === 'ArrowLeft' && index > 0) return (selectedId.value = items.value[index - 1].event.id), true
    if (key === 'ArrowRight' && index < items.value.length - 1)
      return (selectedId.value = items.value[index + 1].event.id), true
    if ((key === 'ArrowUp' || key === 'ArrowDown') && index >= 0) {
      return shiftSemitone(index, (key === 'ArrowUp' ? 1 : -1) * (event.altKey ? 12 : 1)), true
    }
    if (/^[a-g]$/i.test(key)) {
      // The octave that puts it nearest the note before.
      const previous = selectedEvent.value?.kind === 'note' ? selectedEvent.value.pitch : notesOf(score.value).at(-1)?.pitch
      const reference = (previous && Note.midi(previous)) || 72
      const letter = key.toUpperCase()
      const alter = keyAlterationFor(letter)
      const candidates = [3, 4, 5, 6, 7].map((octave) => `${letter}${alter}${octave}`)
      const nearest = candidates.sort(
        (a, b) => Math.abs((Note.midi(a) ?? 0) - reference) - Math.abs((Note.midi(b) ?? 0) - reference),
      )[0]
      return addNote(nearest), true
    }
    return false
  })()
  if (handled) event.preventDefault()
}

/** The accidental the key signature in force at the selection gives a letter. */
function keyAlterationFor(letter: string): string {
  const at = selectedId.value ? locate(score.value, selectedId.value) : null
  return keyAlterations(keyAt(score.value, at?.measure ?? 0)).get(letter) ?? ''
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

/**
 * Run automatic detection and load the result into the draft as suggestions.
 *
 * Nothing is saved: the result lands in the same unsaved draft the manual picker
 * writes to, so reviewing, correcting and saving all work exactly as before. If
 * detection fails or finds nothing, the manual editor is untouched and still the
 * way through. Detection reads pitches, so the result is a pitches-mode score,
 * its measures where the page's barlines are.
 */
async function detect(withRhythm = false) {
  panel.value = null
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
  reviewed.value = new Set()
  reviewSkipped.value = false
  if (withRhythm) {
    if (outcome.rhythm?.measures.length) {
      loadDetectedRhythm(outcome.rhythm, outcome.keySignature)
      return
    }
    detectionWarnings.value = [
      ...outcome.warnings,
      { code: 'rhythm-unsure', message: 'This detector can’t read durations yet, so only the pitches were read.' },
    ]
  }
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
 * A detection with durations into a rhythm-mode score: measures, time
 * signatures, repeats, endings and marks as read. Notes in a measure that
 * needed a correction to add up are flagged; measures that still don't are
 * tinted by the score itself.
 */
function loadDetectedRhythm(rhythm: NonNullable<OmrResult['rhythm']>, key: KeySignature) {
  const relatives = new Map<string, number>()
  const flagged: string[] = []
  const measures: Score['measures'] = rhythm.measures.map((measure, index) => ({
    id: eventId(),
    ...(index === 0 ? { keyFifths: key.kind === '#' ? key.count : -key.count } : {}),
    ...(measure.time ? { time: measure.time } : {}),
    ...(measure.barStart ? { barStart: measure.barStart } : {}),
    ...(measure.barEnd ? { barEnd: measure.barEnd } : {}),
    ...(measure.volta ? { volta: measure.volta } : {}),
    ...(measure.jumps?.length ? { jumps: measure.jumps } : {}),
    events: measure.events.map((event) => {
      const id = eventId()
      if (event.kind === 'rest') return { kind: 'rest' as const, id, duration: event.duration }
      if (event.relative != null) relatives.set(id, event.relative)
      if (measure.fill === 'fixed' || event.durationScore < 0.5) flagged.push(id)
      return {
        kind: 'note' as const,
        id,
        pitch: event.pitch ?? 'B4',
        duration: event.duration,
        source: 'detected' as const,
        ...(event.tie ? { tie: true } : {}),
        ...(event.bbox ? { bbox: event.bbox } : {}),
        confidence: flagged.includes(id) ? Math.min(event.confidence ?? 1, 0.4) : event.confidence,
      }
    }),
  }))
  score.value = { mode: 'rhythm', clef: 'treble', measures }
  detectedRelatives.value = relatives
  detectedIds.value = []
  selectedId.value = notesOf(score.value)[0]?.id ?? null
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

function chooseFingering(index: number, fingering: Fingering) {
  const options = resolved.value[index].options
  // Storing the id only when it differs from the default keeps backups small
  // and lets the primary fingering follow future data corrections.
  updateAt(index, (note) => ({
    ...note,
    chosenFingeringId: fingering.id === options[0]?.id ? undefined : fingering.id,
  }))
}

function toggleEditing() {
  editing.value = !editing.value
  if (editing.value) view.value = 'score'
  panel.value = null
}

/** Leave the editor: keep the draft (the save bar offers it), or throw it away on request. */
function closeEditor() {
  if (dirty.value && window.confirm('Discard your changes?')) discard()
  else editing.value = false
}

// ── Reviewing a detection ──────────────────────────────────────────────────
/** Unsure notes the player has looked at and kept. */
const reviewed = ref(new Set<string>())
const reviewSkipped = ref(false)
const toCheck = computed(() =>
  flaggedIds.value.filter((id) => !reviewed.value.has(id) && eventById(score.value, id)?.kind === 'note'),
)
const reviewing = computed(
  () => !editing.value && hasDetected.value && toCheck.value.length > 0 && !reviewSkipped.value,
)
/** The note under review: the selection if it is one of them, else the first. */
const reviewId = computed(() =>
  selectedId.value && toCheck.value.includes(selectedId.value) ? selectedId.value : (toCheck.value[0] ?? null),
)
const reviewIndex = computed(() => items.value.findIndex((item) => item.event.id === reviewId.value))
const reviewNote = computed(() => {
  const event = reviewId.value ? eventById(score.value, reviewId.value) : null
  return event?.kind === 'note' ? event : null
})
watch(reviewId, (id) => {
  if (reviewing.value && id) selectedId.value = id
})

function stepReview(delta: number) {
  const list = toCheck.value
  if (!list.length) return
  const at = list.indexOf(reviewId.value ?? '')
  selectedId.value = list[(at + delta + list.length) % list.length]
}

function keepReviewed() {
  const id = reviewId.value
  if (!id) return
  const list = toCheck.value
  const next = list[(list.indexOf(id) + 1) % list.length]
  reviewed.value = new Set([...reviewed.value, id])
  selectedId.value = next !== id ? next : null
}

/**
 * The page around the note under review, cut from the photo: the viewBox of
 * an SVG holding the whole image, centred on the note's box.
 */
const reviewCrop = computed(() => {
  const box = reviewNote.value?.bbox
  if (!box || !sheet.value || !imageUrl.value) return null
  const width = sheet.value.imageWidth
  const height = sheet.value.imageHeight
  const tall = Math.max(box.height * height * 7, 60)
  const wide = tall * 2.6
  const cx = (box.x + box.width / 2) * width
  const cy = (box.y + box.height / 2) * height
  return {
    viewBox: `${cx - wide / 2} ${cy - tall / 2} ${wide} ${tall}`,
    width,
    height,
    rect: { x: box.x * width, y: box.y * height, width: box.width * width, height: box.height * height },
    stroke: tall / 70,
  }
})

/** The key signature as read, for the review's correction button. */
const keyLabel = computed(() => KEY_CHOICES.find((choice) => isCurrentKey(choice.key))?.label ?? '?')


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
    reviewSkipped.value = true
  } finally {
    saving.value = false
  }
}

function discard() {
  replace(JSON.parse(savedSnapshot.value) as Score)
  history.value = []
  future.value = []
  editing.value = false
  selectedId.value = null
}

// ── Playback ───────────────────────────────────────────────────────────────
/** The event sounding now, for the cursor and the fingering it shows. */
const playingId = ref<string | null>(null)
/** Practice tempo: starts at the piece's own, never saved with it. */
const tempo = ref(90)
const metronome = ref(false)
const countIn = ref(false)

/** Play the selected measure over and over, for practising a passage. */
const loopMeasure = ref(false)

/** One measure as a score of its own: what is in force there, no repeats or jumps. */
function measureOnly(index: number): Score {
  const measure = score.value.measures[index]
  return {
    ...score.value,
    measures: [
      {
        id: measure.id,
        events: measure.events,
        time: timeAt(score.value, index),
        keyFifths: keyAt(score.value, index),
      },
    ],
  }
}

/** Play from the selected note, or the beginning; again to stop. */
function togglePlayback() {
  if (stopPlayback.value) {
    const stop = stopPlayback.value
    // Cleared first: the stop reports the end, which must not start a loop again.
    stopPlayback.value = null
    stop()
    return
  }
  if (!noteCount.value) return
  startPlayback(loopMeasure.value ? (currentMeasure.value ?? 0) : null, true)
}

function startPlayback(loopIndex: number | null, first: boolean) {
  const source = loopIndex === null ? score.value : measureOnly(loopIndex)
  stopPlayback.value = playScore(source, context.value.instrument, {
    tempo: tempo.value,
    metronome: metronome.value,
    countIn: countIn.value && first,
    startId: loopIndex === null ? selectedId.value : null,
    onEvent: (id) => {
      playingId.value = id
      if (id !== null || !stopPlayback.value) return
      // The end reached by itself: round again, or done.
      if (loopIndex !== null && loopMeasure.value) startPlayback(loopIndex, false)
      else stopPlayback.value = null
    },
  })
}

function nudgeTempo(delta: number) {
  tempo.value = Math.min(240, Math.max(30, tempo.value + delta))
}

function startRename() {
  if (!sheet.value) return
  titleDraft.value = sheet.value.title
  composerDraft.value = sheet.value.composer
  descriptionDraft.value = sheet.value.description ?? ''
  panel.value = 'rename'
}

/** The new-piece screen saves its title and composer as they are typed. */
async function saveStartMeta() {
  if (!sheet.value) return
  const title = titleDraft.value.trim() || sheet.value.title
  if (title === sheet.value.title && composerDraft.value === sheet.value.composer) return
  await store.updateMeta(sheet.value.id, {
    title,
    composer: composerDraft.value,
    description: sheet.value.description ?? '',
  })
  sheet.value = (await store.get(sheet.value.id)) ?? sheet.value
}

/** Leaving with unsaved work asks first: there is no save bar to forget on the way out. */
onBeforeRouteLeave(() => {
  if (dirty.value && !window.confirm('Leave without saving your changes?')) return false
})

async function saveRename() {
  if (!sheet.value) return
  await store.updateMeta(sheet.value.id, {
    title: titleDraft.value.trim() || sheet.value.title,
    composer: composerDraft.value,
    description: descriptionDraft.value.trim(),
  })
  sheet.value = (await store.get(sheet.value.id)) ?? sheet.value
  panel.value = null
}


/**
 * Rewrite the piece for another instrument at the same sounding pitch. Warns
 * first about notes that fall outside the target's range, since those will
 * show no fingering until corrected.
 */
async function convertTo(id: InstrumentId) {
  panel.value = null
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

/** Download the score (as it is now, saved or not) as a MusicXML file. */
function exportMusicXml() {
  if (!sheet.value) return
  const xml = scoreToMusicXml(score.value, {
    title: sheet.value.title,
    composer: sheet.value.composer,
    partName: context.value.instrument.name,
    transposeSemitones: context.value.instrument.transposeSemitones,
  })
  const url = URL.createObjectURL(new Blob([xml], { type: 'application/vnd.recordare.musicxml+xml' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `${sheet.value.title.replace(/[\\/:*?"<>|]+/g, '').trim() || 'score'}.musicxml`
  link.click()
  URL.revokeObjectURL(url)
}

async function deleteSheet() {
  if (!sheet.value) return
  if (!window.confirm(`Delete "${sheet.value.title}" and its notes? This cannot be undone.`)) return
  await store.remove(sheet.value.id)
  await router.replace({ name: 'sheets' })
}
/** The new-piece screen's three ways in. */
const startOptions: { title: string; sub: string; icon: string; run: () => void; primary?: boolean }[] = [
  {
    title: 'Read notes and rhythm',
    sub: 'Pitches, durations, measures and repeats — playable in tempo. You check what it found.',
    icon: 'M3 7V3h4M17 3h4v4M21 17v4h-4M7 21H3v-4M8 15V9l8-2v6',
    run: () => void detect(true),
    primary: true,
  },
  {
    title: 'Read pitches only',
    sub: 'Faster and more forgiving: just the order of the notes, for their fingerings.',
    icon: 'M3 7V3h4M17 3h4v4M21 17v4h-4M7 21H3v-4M10 14h.01M15 11h.01',
    run: () => void detect(false),
  },
  {
    title: 'Type them in myself',
    sub: 'On a keyboard, with the photo a tap away.',
    icon: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
    run: toggleEditing,
  },
]

// Shared looks, so the template reads as layout.
const iconButton =
  'flex h-11 w-11 shrink-0 items-center justify-center text-ink-200 transition-colors hover:text-ink-50 disabled:text-ink-600'
const tool =
  'flex h-10 min-w-10 items-center justify-center border border-ink-600 px-1.5 text-sm text-ink-50 transition-colors hover:border-accent-400'
const fix =
  'flex h-14 flex-col items-center justify-center gap-0.5 border border-ink-600 text-base text-ink-50 transition-colors hover:border-accent-400'
const fixLabel = 'text-[10px] font-normal text-ink-400'
const toggle = 'flex h-12 w-12 shrink-0 items-center justify-center border transition-colors'
const toggleOn = 'border-accent-400 bg-ink-800 text-accent-300'
const toggleOff = 'border-ink-600 text-ink-200 hover:border-ink-400'
const label = 'text-[11px] font-semibold uppercase tracking-wider text-ink-400'
const field =
  'h-11 w-full border border-ink-600 bg-ink-950 px-3 text-sm text-ink-50 placeholder:text-ink-600 focus:border-accent-400 focus:outline-none'
const row = 'flex min-h-14 items-center gap-2 border-b border-ink-800 px-4 py-2'
const small =
  'h-10 min-w-11 shrink-0 border border-ink-600 px-2.5 text-xs font-semibold text-ink-50 transition-colors hover:border-accent-400 disabled:opacity-40'
</script>

<template>
  <div v-if="sheet" class="flex h-svh flex-col">
    <!-- Top bar. Reading: back, title, photo, edit, more. Editing: close,
         the measure, undo/redo and save. -->
    <header class="flex h-14 shrink-0 items-center gap-1 border-b border-ink-800 bg-ink-900 px-1 md:px-0">
      <template v-if="editing">
        <button type="button" :class="iconButton" aria-label="Close the editor" @click="closeEditor">
          <svg viewBox="0 0 24 24" class="h-[22px] w-[22px]" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <button
          type="button"
          class="flex h-11 min-w-0 flex-1 items-center gap-1.5 px-1 text-left text-[15px] font-semibold text-ink-50"
          @click="panel = 'measure'"
        >
          <span class="truncate">Measure {{ toolMeasure + 1 }}</span>
          <svg viewBox="0 0 24 24" class="h-3 w-3 shrink-0 text-ink-400" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">
            <path d="M6 9l6 6 6-6" />
          </svg>
          <span v-if="offMeasures" class="h-2 w-2 shrink-0 bg-amber-400" aria-label="Some measures don’t add up" />
        </button>
        <button type="button" :class="iconButton" aria-label="Undo" title="Undo (Ctrl+Z)" :disabled="!history.length" @click="undo">
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
            <path d="M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" />
          </svg>
        </button>
        <button type="button" :class="iconButton" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" :disabled="!future.length" @click="redo">
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
            <path d="M15 14l5-5-5-5M20 9H9a5 5 0 0 0 0 10h3" />
          </svg>
        </button>
        <button
          type="button"
          class="ml-1 h-9 shrink-0 bg-accent-400 px-4 text-sm font-bold text-ink-950 transition-colors hover:bg-accent-300 disabled:opacity-50"
          :disabled="saving"
          @click="dirty ? save() : (editing = false)"
        >
          {{ saving ? 'Saving…' : dirty ? 'Save' : 'Done' }}
        </button>
      </template>

      <template v-else>
        <RouterLink :to="{ name: 'sheets' }" :class="iconButton" aria-label="Back to sheet music">
          <svg viewBox="0 0 24 24" class="h-[22px] w-[22px]" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </RouterLink>
        <button type="button" class="min-w-0 flex-1 text-left" @click="startRename">
          <h1 class="truncate text-base">{{ sheet.title }}</h1>
          <p class="truncate text-[11px] text-ink-400">
            <template v-if="currentMeasure !== null">Measure {{ currentMeasure + 1 }} of {{ score.measures.length }}</template>
            <template v-else>{{ sheet.composer || context.instrument.name }}</template>
          </p>
        </button>
        <button
          v-if="noteCount"
          type="button"
          :class="[iconButton, view === 'photo' ? 'text-accent-300' : '']"
          :aria-label="view === 'photo' ? 'Show the score' : 'Show the photo'"
          :aria-pressed="view === 'photo'"
          @click="view = view === 'photo' ? 'score' : 'photo'"
        >
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M3 4h18v16H3zM3 16l5-5 4 4 3-3 6 6" />
          </svg>
        </button>
        <button v-if="noteCount" type="button" :class="iconButton" aria-label="Edit notes" @click="toggleEditing">
          <svg viewBox="0 0 24 24" class="h-[19px] w-[19px]" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
            <path d="M4 20h4L19 9l-4-4L4 16z" />
          </svg>
        </button>
        <button type="button" :class="iconButton" aria-label="More" @click="panel = 'menu'">
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="currentColor" aria-hidden="true">
            <circle cx="12" cy="5" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="12" cy="19" r="1.8" />
          </svg>
        </button>
      </template>
    </header>

    <!-- Changes made outside the editor (a fingering, the whole piece an
         octave, a detection) wait here to be kept or dropped. -->
    <div
      v-if="dirty && !editing && !reviewing"
      class="flex shrink-0 items-center gap-2 border-b border-ink-800 bg-ink-900 px-4 py-2"
    >
      <p class="flex-1 text-xs text-ink-200">Unsaved changes</p>
      <button type="button" class="h-9 border border-ink-600 px-3 text-xs text-ink-200 hover:border-ink-400" @click="discard">
        Discard
      </button>
      <button
        type="button"
        class="h-9 bg-accent-400 px-4 text-xs font-bold text-ink-950 hover:bg-accent-300 disabled:opacity-50"
        :disabled="saving"
        @click="save"
      >
        {{ saving ? 'Saving…' : 'Save' }}
      </button>
    </div>

    <div
      v-if="noteCount && view === 'score' && !editing"
      class="flex shrink-0 items-center justify-end px-4 pt-2"
    >
      <label class="flex cursor-pointer items-center gap-2 text-xs text-ink-200">
        Note names
        <input v-model="noteNames" type="checkbox" class="peer sr-only" />
        <span class="relative inline-block h-5 w-9 bg-ink-700 transition-colors peer-checked:bg-accent-400" aria-hidden="true">
          <span class="absolute top-0.5 left-0.5 h-4 w-4 bg-ink-950 transition-transform" :class="noteNames ? 'translate-x-4' : ''" />
        </span>
      </label>
    </div>

    <!-- The page itself: what scrolls. -->
    <main class="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3" aria-label="Score">
      <!-- Detection: progress, then anything the recogniser wants to warn about. -->
      <section v-if="recogniser.running.value" class="space-y-2 border border-ink-700 bg-ink-900 p-4">
        <div class="flex items-center justify-between gap-3">
          <p class="text-sm text-ink-200">{{ recogniser.stageLabel() }}…</p>
          <button type="button" class="h-9 shrink-0 px-2 text-xs font-medium text-ink-400 hover:text-ink-200" @click="recogniser.cancel()">
            Cancel
          </button>
        </div>
        <div class="h-1.5 overflow-hidden bg-ink-800">
          <div
            class="h-full bg-accent-400 transition-[width] duration-300"
            :style="{ width: `${Math.round((recogniser.progress.value?.fraction ?? 0) * 100)}%` }"
          />
        </div>
      </section>

      <p v-if="recogniser.error.value" class="border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        {{ recogniser.error.value }} You can still enter the notes by hand.
      </p>

      <div
        v-for="warning in detectionWarnings"
        :key="warning.code"
        class="flex items-start gap-3 border border-amber-500/40 bg-amber-500/10 px-3 py-2.5"
      >
        <p class="flex-1 text-xs leading-relaxed text-amber-100">{{ warning.message }}</p>
        <button
          type="button"
          class="shrink-0 text-[11px] font-medium text-amber-200/70 hover:text-amber-100"
          @click="detectionWarnings = detectionWarnings.filter((w) => w !== warning)"
        >
          Dismiss
        </button>
      </div>

      <OmrDebugView
        v-if="isDev && recogniser.debug.value"
        :binarised="recogniser.debug.value.binarised"
        :staff-removed="recogniser.debug.value.staffRemoved"
        :eroded="recogniser.debug.value.eroded"
      />

      <!-- A piece with nothing in it yet: name it, then pick how the notes get in. -->
      <section v-if="!noteCount && !editing && !recogniser.running.value" class="space-y-4" aria-label="New piece">
        <div class="flex gap-3">
          <button
            v-if="imageUrl"
            type="button"
            class="h-32 w-24 shrink-0 overflow-hidden border border-ink-700 bg-ink-50"
            aria-label="Show the photo"
            @click="view = view === 'photo' ? 'score' : 'photo'"
          >
            <img :src="imageUrl" alt="" class="h-full w-full object-cover object-top" />
          </button>
          <div class="min-w-0 flex-1 space-y-2">
            <label class="block space-y-1">
              <span :class="label">Title</span>
              <input v-model="titleDraft" type="text" :class="field" @change="saveStartMeta" />
            </label>
            <label class="block space-y-1">
              <span :class="label">Composer</span>
              <input v-model="composerDraft" type="text" placeholder="Optional" :class="field" @change="saveStartMeta" />
            </label>
          </div>
        </div>

        <h2 class="pt-1 text-lg">How do you want the notes?</h2>
        <button
          v-for="option in startOptions"
          :key="option.title"
          type="button"
          class="flex w-full gap-3.5 border p-3.5 text-left transition-colors"
          :class="option.primary ? 'border-accent-400 bg-ink-800' : 'border-ink-700 bg-ink-900 hover:border-ink-400'"
          @click="option.run()"
        >
          <span
            class="flex h-11 w-11 shrink-0 items-center justify-center"
            :class="option.primary ? 'bg-accent-400 text-ink-950' : 'border border-ink-700 text-accent-400'"
          >
            <svg viewBox="0 0 24 24" class="h-[22px] w-[22px]" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
              <path :d="option.icon" />
            </svg>
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-[15px] font-semibold text-ink-50">{{ option.title }}</span>
            <span class="mt-0.5 block text-xs leading-relaxed text-ink-400">{{ option.sub }}</span>
          </span>
        </button>
        <p class="text-xs leading-relaxed text-ink-400">
          Detection works best on a flat scan or screenshot. It is a head start — you can fix anything after.
        </p>
      </section>

      <!-- The engraved score, or the photo it came from. Detected notes are
           boxed on the photo; tapping a box or a note selects it in both. -->
      <ScoreView
        v-if="view === 'score' && (noteCount || editing)"
        :score="score"
        :selected-id="selectedId"
        :flagged="flaggedIds"
        :playing-id="playingId"
        :editing="editing"
        :note-names="noteNames && !editing"
        @select="selectedId = editing || reviewing ? $event : $event === selectedId ? null : $event"
        @staff-tap="onStaffTap"
      />
      <p v-if="editing && view === 'score'" class="text-xs text-ink-400">
        Tap a note to select it. Tap an empty line or space to put a note there.
      </p>

      <div v-if="imageUrl && view === 'photo'" class="relative overflow-auto border border-ink-700 bg-ink-50">
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
    </main>

    <!-- Editing: the selected note, the rhythm row and the keyboard. -->
    <section v-if="editing" class="shrink-0 border-t border-ink-700 bg-ink-900" aria-label="Note entry">
      <div class="flex items-center gap-1.5 border-b border-ink-800 px-4 py-2">
        <template v-if="selectedEvent">
          <span class="min-w-10">
            <NoteBadge v-if="selectedEvent.kind === 'note'" :note="selectedEvent.pitch" size="sm" />
            <span v-else class="text-sm text-ink-400">Rest</span>
          </span>
          <span class="flex-1" />
          <template v-if="selectedEvent.kind === 'note'">
            <button type="button" :class="tool" aria-label="Flat" title="Flat" @click="paletteAccidental(-1)">
              <span class="smufl">{{ '' }}</span>
            </button>
            <button type="button" :class="tool" aria-label="Natural" title="Natural" @click="paletteAccidental(0)">
              <span class="smufl">{{ '' }}</span>
            </button>
            <button type="button" :class="tool" aria-label="Sharp" title="Sharp" @click="paletteAccidental(1)">
              <span class="smufl">{{ '' }}</span>
            </button>
            <button type="button" :class="tool" aria-label="Down a line or space" @click="shiftStep(selectedIndex!, -1)">▼</button>
            <button type="button" :class="tool" aria-label="Up a line or space" @click="shiftStep(selectedIndex!, 1)">▲</button>
          </template>
          <button
            v-if="score.mode === 'pitches'"
            type="button"
            :class="[tool, items[selectedIndex ?? -1]?.barAfter ? 'border-accent-400 text-accent-300' : '']"
            :aria-pressed="items[selectedIndex ?? -1]?.barAfter ?? false"
            aria-label="Barline after this note"
            @click="toggleBar(selectedIndex!)"
          >
            |
          </button>
          <button type="button" :class="[tool, 'text-red-300']" aria-label="Delete" title="Delete (Del)" @click="paletteRemove">
            <svg viewBox="0 0 24 24" class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14" />
            </svg>
          </button>
        </template>
        <p v-else class="flex h-10 items-center text-xs text-ink-400">
          {{
            measureCursor !== null && !selectedId
              ? `New notes go into measure ${toolMeasure + 1}.`
              : 'New notes go at the end. Tap a note to change it.'
          }}
        </p>
      </div>
      <div class="space-y-3 px-4 pt-3" style="padding-bottom: calc(var(--safe-bottom) + 1rem)">
        <ScorePalette
          v-if="score.mode === 'rhythm'"
          :selected="selectedEvent"
          :input-duration="inputDuration"
          @duration="paletteDuration"
          @dot="paletteDot"
          @rest="paletteRest"
          @tie="paletteTie"
        />
        <PianoKeyboard
          :context="context"
          :flats="keyAt(score, toolMeasure) < 0"
          :hint="selected ? `adds after ${noteLabel(selected.pitch)}` : 'adds a note'"
          @add="addNote"
        />
      </div>
    </section>

    <!-- After a detection: the unsure notes one by one, each beside the spot
         on the page it was read from. -->
    <section
      v-else-if="reviewing && reviewNote"
      class="shrink-0 space-y-3 border-t border-ink-700 bg-ink-900 px-4 pt-3"
      style="padding-bottom: calc(var(--safe-bottom) + 1rem)"
      aria-label="Check the detected notes"
    >
      <svg
        v-if="reviewCrop"
        :viewBox="reviewCrop.viewBox"
        preserveAspectRatio="xMidYMid slice"
        class="block h-28 w-full bg-ink-50"
        role="img"
        aria-label="The spot on the photo this note was read from"
      >
        <image :href="imageUrl!" x="0" y="0" :width="reviewCrop.width" :height="reviewCrop.height" />
        <rect v-bind="reviewCrop.rect" fill="none" stroke="#c77a00" :stroke-width="reviewCrop.stroke" />
      </svg>
      <div class="flex items-center gap-2">
        <button type="button" :class="tool" aria-label="Previous note to check" @click="stepReview(-1)">‹</button>
        <div class="min-w-0 flex-1 text-center">
          <p class="text-[11px] font-semibold tracking-wider text-amber-300 uppercase">
            Unsure · {{ toCheck.length }} left
          </p>
          <NoteBadge :note="reviewNote.pitch" size="md" />
        </div>
        <button type="button" :class="tool" aria-label="Next note to check" @click="stepReview(1)">›</button>
      </div>
      <div class="grid grid-cols-5 gap-1.5">
        <button type="button" :class="fix" @click="shiftStep(reviewIndex, 1)">▲<span :class="fixLabel">step up</span></button>
        <button type="button" :class="fix" @click="shiftStep(reviewIndex, -1)">▼<span :class="fixLabel">step down</span></button>
        <button type="button" :class="fix" @click="shiftSemitone(reviewIndex, -1)">
          <span class="smufl">{{ '' }}</span><span :class="fixLabel">½ down</span>
        </button>
        <button type="button" :class="fix" @click="shiftSemitone(reviewIndex, 1)">
          <span class="smufl">{{ '' }}</span><span :class="fixLabel">½ up</span>
        </button>
        <button type="button" :class="[fix, 'text-red-300']" @click="removeAt(reviewIndex)">
          ✕<span :class="fixLabel">not a note</span>
        </button>
      </div>
      <div class="flex gap-2">
        <button
          v-if="keyOverride"
          type="button"
          class="h-12 shrink-0 border border-ink-600 px-3 text-xs text-ink-200 hover:border-accent-400"
          @click="panel = 'key'"
        >
          Key {{ keyLabel }}
        </button>
        <button
          type="button"
          class="flex h-12 flex-1 items-center justify-center gap-2 bg-accent-400 text-sm font-bold text-ink-950 hover:bg-accent-300"
          @click="keepReviewed"
        >
          <svg viewBox="0 0 24 24" class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">
            <path d="M5 12l5 5 9-10" />
          </svg>
          Looks right
        </button>
      </div>
      <div class="flex gap-2">
        <button type="button" class="h-10 flex-1 text-xs text-ink-400 hover:text-ink-200" @click="reviewSkipped = true">
          Skip checking
        </button>
        <button
          type="button"
          class="h-10 flex-1 border border-ink-600 text-xs font-semibold text-ink-50 hover:border-accent-400 disabled:opacity-50"
          :disabled="saving"
          @click="save"
        >
          {{ saving ? 'Saving…' : 'Save as is' }}
        </button>
      </div>
    </section>

    <!-- Reading: the fingering of every note, and the player. -->
    <section v-else-if="noteCount" class="shrink-0 border-t border-ink-700 bg-ink-900" aria-label="Fingerings and playback">
      <div class="flex items-baseline justify-between px-4 pt-2.5 pb-1.5">
        <h2 :class="label">Fingerings</h2>
        <span class="text-[11px] text-ink-400">
          {{ selectedId && !playingId ? 'tap again for alternatives' : 'tap a note to hear it' }}
        </span>
      </div>
      <FingeringStrip
        :entries="stripEntries"
        :focus-id="playingId ?? selectedId"
        :flagged="flaggedIds"
        :instrument="context.instrument"
        @select="onStripSelect"
      />
      <div
        v-if="settings.audioEnabled"
        class="flex items-center gap-2 border-t border-ink-800 px-4 pt-2.5"
        style="padding-bottom: calc(var(--safe-bottom) + 1rem)"
        aria-label="Playback"
      >
        <button
          type="button"
          class="flex h-12 w-14 shrink-0 items-center justify-center transition-colors"
          :class="stopPlayback ? 'bg-ink-50 text-ink-950' : 'bg-accent-400 text-ink-950 hover:bg-accent-300'"
          :aria-label="stopPlayback ? 'Stop' : selectedId ? 'Play from the selected note' : 'Play'"
          @click="togglePlayback"
        >
          <svg v-if="stopPlayback" viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" aria-hidden="true">
            <rect x="5" y="5" width="14" height="14" />
          </svg>
          <svg v-else viewBox="0 0 24 24" class="h-[18px] w-[18px]" fill="currentColor" aria-hidden="true">
            <path d="M7 4l13 8-13 8z" />
          </svg>
        </button>
        <div class="flex h-12 min-w-0 flex-1 items-center border border-ink-600" aria-label="Tempo">
          <button type="button" class="h-full w-11 shrink-0 text-xl text-ink-200" aria-label="Slower" @click="nudgeTempo(-5)">−</button>
          <label class="flex min-w-0 flex-1 items-baseline justify-center gap-1">
            <input
              v-model.number="tempo"
              type="number"
              min="30"
              max="240"
              class="w-10 bg-transparent text-center text-[15px] font-bold text-ink-50 [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none"
              aria-label="Tempo in beats per minute"
            />
            <span class="text-[11px] text-ink-400">BPM</span>
          </label>
          <button type="button" class="h-full w-11 shrink-0 text-xl text-ink-200" aria-label="Faster" @click="nudgeTempo(5)">+</button>
        </div>
        <button
          type="button"
          :class="[toggle, loopMeasure ? toggleOn : toggleOff]"
          :aria-pressed="loopMeasure"
          aria-label="Loop the selected measure"
          title="Loop the selected measure"
          @click="loopMeasure = !loopMeasure"
        >
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.9" aria-hidden="true">
            <path d="M17 2l3 3-3 3M4 11V9a4 4 0 0 1 4-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 0 1-4 4H4" />
          </svg>
        </button>
        <button
          type="button"
          :class="[toggle, metronome ? toggleOn : toggleOff]"
          :aria-pressed="metronome"
          aria-label="Metronome"
          title="Metronome"
          @click="metronome = !metronome"
        >
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
            <path d="M9 3h6l4 18H5zM12 15l5-7M7 15h10" />
          </svg>
        </button>
      </div>
      <div v-else style="height: calc(var(--safe-bottom) + 0.5rem)" />
    </section>

    <!-- ── Bottom sheets ─────────────────────────────────────────────────── -->
    <BottomSheet :open="panel === 'menu'" label="Piece options" @close="panel = null">
      <div class="flex items-start gap-3 border-b border-ink-800 px-4 pb-3.5">
        <div class="min-w-0 flex-1">
          <h2 class="text-lg">{{ sheet.title }}</h2>
          <p class="text-xs text-ink-400">
            {{ [sheet.composer, `${noteCount} ${noteCount === 1 ? 'note' : 'notes'}`, `${score.measures.length} measures`].filter(Boolean).join(' · ') }}
          </p>
          <p v-if="sheet.description" class="mt-1.5 text-xs whitespace-pre-line text-ink-200">{{ sheet.description }}</p>
        </div>
        <button type="button" class="h-9 shrink-0 border border-ink-600 px-3 text-xs text-ink-50" @click="startRename">Rename</button>
      </div>

      <div v-if="noteCount" :class="row">
        <span class="flex-1 text-[15px] text-ink-50">Notation</span>
        <div role="radiogroup" aria-label="Notation" class="flex border border-ink-600">
          <button
            v-for="mode in (['pitches', 'rhythm'] as const)"
            :key="mode"
            type="button"
            role="radio"
            :aria-checked="score.mode === mode"
            class="h-9 px-3 text-xs"
            :class="score.mode === mode ? 'bg-accent-400 font-semibold text-ink-950' : 'text-ink-400'"
            @click="setMode(mode)"
          >
            {{ mode === 'pitches' ? 'Pitches only' : 'With rhythm' }}
          </button>
        </div>
      </div>

      <label v-if="noteCount && settings.audioEnabled" :class="[row, 'cursor-pointer']">
        <span class="flex-1 text-[15px] text-ink-50">Count in a measure before playing</span>
        <input v-model="countIn" type="checkbox" class="h-5 w-5 accent-accent-400" />
      </label>

      <button type="button" :class="[row, 'w-full text-left']" @click="panel = 'instrument'">
        <span class="min-w-0 flex-1">
          <span class="block text-[15px] text-ink-50">Rewrite for another instrument</span>
          <span class="block text-xs text-ink-400">Now: {{ context.instrument.name }} · sounds the same after</span>
        </span>
        <span class="text-ink-600" aria-hidden="true">›</span>
      </button>

      <button v-if="hasDetected && keyOverride" type="button" :class="[row, 'w-full text-left']" @click="panel = 'key'">
        <span class="min-w-0 flex-1">
          <span class="block text-[15px] text-ink-50">Key signature: {{ keyLabel }}</span>
          <span class="block text-xs text-ink-400">Read wrong? One tap re-spells every detected note.</span>
        </span>
        <span class="text-ink-600" aria-hidden="true">›</span>
      </button>

      <div :class="row">
        <span class="min-w-0 flex-1">
          <span class="block text-[15px] text-ink-50">{{ noteCount ? 'Detect notes again' : 'Detect notes' }}</span>
          <span class="block text-xs text-ink-400">{{ noteCount ? 'Replaces the notes with a fresh read' : 'Read them off the photo' }}</span>
        </span>
        <button type="button" :class="small" :disabled="recogniser.running.value" @click="detect(true)">Rhythm</button>
        <button type="button" :class="small" :disabled="recogniser.running.value" @click="detect(false)">Pitches</button>
      </div>
      <label v-if="isDev" :class="[row, 'cursor-pointer text-xs text-ink-400']">
        <input v-model="showDebug" type="checkbox" class="h-4 w-4 accent-accent-400" />
        Show detection stages on next run (dev)
      </label>

      <div v-if="noteCount" :class="row">
        <span class="flex-1 text-[15px] text-ink-50">Whole piece an octave</span>
        <button type="button" :class="small" aria-label="Every note down an octave" @click="shiftAllOctaves(-1)">▼</button>
        <button type="button" :class="small" aria-label="Every note up an octave" @click="shiftAllOctaves(1)">▲</button>
      </div>

      <button v-if="noteCount" type="button" :class="[row, 'w-full text-left text-[15px] text-ink-50']" @click="exportMusicXml(); panel = null">
        Export MusicXML
      </button>
      <button v-if="noteCount" type="button" :class="[row, 'w-full text-left text-[15px] text-ink-50']" @click="panel = null; clearAll()">
        Clear all notes
      </button>
      <button type="button" :class="[row, 'w-full border-b-0 text-left text-[15px] text-red-300']" @click="panel = null; deleteSheet()">
        Delete piece
      </button>
    </BottomSheet>

    <BottomSheet :open="panel === 'instrument'" label="Rewrite for another instrument" @close="panel = null">
      <div class="space-y-3 px-4">
        <h2 class="text-lg">Written for</h2>
        <p class="text-xs leading-relaxed text-ink-400">
          Pick another instrument and every note is rewritten in its written pitch, so the piece sounds the same.
        </p>
        <div class="space-y-1.5">
          <button
            v-for="id in convertOptions"
            :key="id"
            type="button"
            class="flex h-12 w-full items-center justify-between border px-3 text-left text-sm"
            :class="id === context.instrument.id ? 'border-accent-400 bg-ink-800 text-ink-50' : 'border-ink-700 text-ink-200 hover:border-ink-400'"
            :aria-current="id === context.instrument.id ? 'true' : undefined"
            @click="id === context.instrument.id ? (panel = null) : convertTo(id)"
          >
            {{ CATALOG[id].name }}
            <span v-if="id === context.instrument.id" class="text-xs text-accent-300">current</span>
          </button>
        </div>
        <RouterLink :to="{ name: 'settings' }" class="inline-block py-2 text-xs text-accent-400">
          More instruments in Setup →
        </RouterLink>
      </div>
    </BottomSheet>

    <BottomSheet :open="panel === 'rename'" label="Title and description" @close="panel = null">
      <form class="space-y-2.5 px-4" @submit.prevent="saveRename">
        <h2 class="text-lg">Title and description</h2>
        <input v-model="titleDraft" type="text" placeholder="Title" aria-label="Title" :class="field" />
        <input v-model="composerDraft" type="text" placeholder="Composer" aria-label="Composer" :class="field" />
        <textarea v-model="descriptionDraft" rows="3" placeholder="Description" aria-label="Description" :class="[field, 'h-auto resize-y py-2']" />
        <div class="flex gap-2 pt-1">
          <button type="submit" class="h-12 flex-1 bg-accent-400 text-sm font-semibold text-ink-950 hover:bg-accent-300">Save</button>
          <button type="button" class="h-12 border border-ink-600 px-5 text-sm text-ink-200" @click="panel = null">Cancel</button>
        </div>
      </form>
    </BottomSheet>

    <BottomSheet :open="panel === 'key'" label="Key signature" @close="panel = null">
      <div class="space-y-3 px-4">
        <h2 class="text-lg">Key signature</h2>
        <p class="text-xs leading-relaxed text-ink-400">Detection read it from the page. Tap the right one to re-spell every detected note.</p>
        <div class="grid grid-cols-5 gap-1.5">
          <button
            v-for="choice in KEY_CHOICES"
            :key="choice.label"
            type="button"
            class="h-12 border text-sm font-semibold transition-colors"
            :class="isCurrentKey(choice.key) ? 'border-accent-400 bg-accent-400 text-ink-950' : 'border-ink-600 text-ink-50 hover:border-accent-400'"
            @click="applyKey(choice.key); panel = null"
          >
            {{ choice.label }}
          </button>
        </div>
      </div>
    </BottomSheet>

    <BottomSheet :open="panel === 'measure'" label="Measure" @close="panel = null">
      <MeasureTools
        :score="score"
        :measure-index="toolMeasure"
        :off-measures="offMeasures"
        @patch="score = patchMeasure(score, toolMeasure, $event)"
        @fix="score = rebarFrom(score, Math.max(0, firstOffMeasure(score)))"
        @add-measure="addMeasureAfter"
        @remove-measure="removeMeasure"
        @move="moveMeasure"
      />
    </BottomSheet>

    <!-- A note's fingering in full: the chart, its code and notes, and the
         alternatives for an awkward passage. -->
    <BottomSheet :open="panel === 'fingering' && !!selected" label="Fingering" @close="panel = null">
      <section v-if="selected" class="space-y-4 px-4" :aria-label="`Fingering for ${selected.pitch}`">
        <div class="flex items-center gap-3">
          <NoteBadge :note="selected.pitch" size="lg" />
          <span class="text-xs text-ink-400">note {{ (selectedIndex ?? 0) + 1 }} of {{ items.length }}</span>
        </div>
        <div v-if="selected.chosen" class="flex gap-4">
          <KeyChart
            :keys="selected.chosen.keys"
            :partial="selected.chosen.partial"
            :instrument="context.instrument"
            size="md"
            class="shrink-0"
          />
          <div class="min-w-0 flex-1 space-y-3">
            <p class="font-mono text-xs break-words text-ink-200">{{ prettyCode(selected.chosen.code) }}</p>
            <p v-if="selected.chosen.comment" class="text-xs leading-relaxed text-ink-400">{{ selected.chosen.comment }}</p>
            <div v-if="selected.options.length > 1" class="space-y-1.5">
              <p :class="label">Use instead</p>
              <div class="flex flex-wrap gap-1.5">
                <button
                  v-for="option in selected.options"
                  :key="option.id"
                  type="button"
                  class="h-9 border px-3 text-xs font-medium transition-colors"
                  :class="option.id === selected.chosen.id ? 'border-accent-400 bg-accent-400 text-ink-950' : 'border-ink-600 text-ink-200 hover:border-accent-400'"
                  @click="chooseFingering(selectedIndex!, option)"
                >
                  {{ option.kind }}
                </button>
              </div>
            </div>
            <RouterLink
              :to="{ name: 'note', params: { note: canonicalNote(selected.chosen.midi) } }"
              class="inline-block py-1 text-xs font-medium text-accent-400 hover:text-accent-300"
            >
              Open in note library →
            </RouterLink>
          </div>
        </div>
        <p v-else class="text-sm text-amber-200">
          No fingering on record for {{ noteLabel(selected.pitch) }} with your instrument setup.
        </p>
      </section>
    </BottomSheet>
  </div>
  <p v-else-if="instrumentMissing" class="m-4 border border-ink-700 bg-ink-900 px-4 py-6 text-sm text-ink-400">
    This sheet is written for the {{ CATALOG[instrumentMissing].noun }}, which hasn’t been downloaded to this device
    yet. Connect to the internet and open it again.
  </p>
</template>

<style scoped>
/* SMuFL accidentals from Bravura, the font the score is engraved with. */
.smufl {
  font-family: Bravura, serif;
  font-size: 22px;
  line-height: 1;
  transform: translateY(0.12em);
}
</style>
