<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Note } from 'tonal'
import KeyChart from '@/components/KeyChart.vue'
import NoteBadge from '@/components/NoteBadge.vue'
import { fingeringsForNote, noteLabel, noteLabelWithEnharmonic, noteRange } from '@/domain/lookup'
import { SCALE_TONICS, SCALE_TYPES, scaleNotes } from '@/domain/scales'
import { useSettingsStore } from '@/stores/settings'

/**
 * Feature 2 — the whole range as blocks, grouped by octave. Each block shows
 * the note's usual fingering upright, so the page itself answers "how do I
 * play this?"; tapping a block opens every way to play it.
 */

const settings = useSettingsStore()
const query = ref('')

type Tab = 'octaves' | 'full' | 'scales'
const TABS: { id: Tab; label: string }[] = [
  { id: 'octaves', label: 'Octaves' },
  { id: 'full', label: 'Full' },
  { id: 'scales', label: 'Scales' },
]
const tab = ref<Tab>('octaves')

const tonic = ref('C')
const scaleTypeId = ref('major')
const scaleType = computed(() => SCALE_TYPES.find((t) => t.id === scaleTypeId.value) ?? SCALE_TYPES[0])

/** "f#5", "Gb", "bb4" — what someone types for a note, made comparable. */
function normalise(text: string): string {
  return text.toLowerCase().replace(/♯/g, '#').replace(/♭/g, 'b').replace(/\s+/g, '')
}

const rows = computed(() =>
  noteRange(settings.context).map((entry) => {
    const fingerings = fingeringsForNote(entry.note, settings.context)
    const label = noteLabelWithEnharmonic(entry.note)
    return {
      ...entry,
      octave: Note.get(entry.note).oct ?? 0,
      primary: fingerings[0] ?? null,
      count: fingerings.length,
      // Every spelling, with and without the octave: "f#5 / gb5 / f# / gb".
      names: label.split('/').flatMap((name) => {
        const spelled = normalise(name)
        return [spelled, spelled.replace(/\d+$/, '')]
      }),
    }
  }),
)

/** Every note on one page, one tile each — the improvisation cheat sheet. */
const tiles = computed(() =>
  rows.value.map((row) => ({ key: row.midi, note: row.note, to: row.note, primary: row.primary, tonic: false })),
)

/** Only the notes of the chosen scale, the tonic picked out. */
const scaleTiles = computed(() => {
  const byMidi = new Map(rows.value.map((row) => [row.midi, row]))
  return scaleNotes(tonic.value, scaleType.value, rows.value.map((row) => row.midi)).flatMap((n) => {
    const row = byMidi.get(n.midi)
    return row ? [{ key: n.midi, note: n.note, to: row.note, primary: row.primary, tonic: n.isTonic }] : []
  })
})

const scaleSummary = computed(() => {
  const first = scaleTiles.value.find((t) => t.tonic)
  const pcs = [...new Set(scaleTiles.value.slice(0, 13).map((t) => noteLabel(t.note).replace(/\d+$/, '')))]
  return first ? pcs.join(' · ') : ''
})

const octaves = computed(() => {
  const q = normalise(query.value)
  const groups = new Map<number, typeof rows.value>()
  for (const row of rows.value) {
    if (q && !row.names.some((name) => name.startsWith(q))) continue
    const bucket = groups.get(row.octave)
    if (bucket) bucket.push(row)
    else groups.set(row.octave, [row])
  }
  return [...groups.entries()].map(([octave, notes]) => ({ octave, notes }))
})
</script>

<template>
  <div class="-mx-4 md:mx-0">
    <header class="flex items-center gap-3 px-4 pb-4 md:px-0">
      <h1 class="min-w-0 flex-1 text-2xl">Notes</h1>
      <label v-if="tab === 'octaves'" class="flex h-11 w-40 items-center gap-2 border border-ink-700 px-3 text-ink-400 focus-within:border-ink-400">
        <svg viewBox="0 0 24 24" class="h-4 w-4 shrink-0" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        <input
          v-model="query"
          type="text"
          placeholder="Go to note"
          aria-label="Go to note"
          autocapitalize="off"
          autocomplete="off"
          class="w-full min-w-0 bg-transparent text-sm text-ink-50 outline-none placeholder:text-ink-400"
        />
      </label>
    </header>

    <div class="mx-4 mb-4 grid grid-cols-3 border border-ink-700 md:mx-0" role="tablist" aria-label="Notes view">
      <button
        v-for="t in TABS"
        :key="t.id"
        type="button"
        role="tab"
        :aria-selected="tab === t.id"
        class="h-11 text-sm font-semibold transition-colors not-first:border-l not-first:border-ink-700"
        :class="tab === t.id ? 'bg-ink-800 text-ink-50' : 'text-ink-400 hover:text-ink-200'"
        @click="tab = t.id"
      >
        {{ t.label }}
      </button>
    </div>

    <section v-if="tab === 'scales'" class="space-y-3 px-4 pb-3 md:px-0">
      <div class="flex flex-wrap gap-1.5" role="group" aria-label="Key">
        <button
          v-for="t in SCALE_TONICS"
          :key="t"
          type="button"
          class="h-9 min-w-[2.6rem] border px-2 text-sm font-semibold transition-colors"
          :class="tonic === t ? 'border-accent-400 bg-accent-400 text-ink-950' : 'border-ink-700 text-ink-200 hover:border-ink-400'"
          :aria-pressed="tonic === t"
          @click="tonic = t"
        >
          {{ noteLabel(t) }}
        </button>
      </div>
      <div class="flex flex-wrap gap-1.5" role="group" aria-label="Scale">
        <button
          v-for="t in SCALE_TYPES"
          :key="t.id"
          type="button"
          class="h-9 border px-2.5 text-xs font-semibold transition-colors"
          :class="scaleTypeId === t.id ? 'border-accent-400 bg-accent-400 text-ink-950' : 'border-ink-700 text-ink-200 hover:border-ink-400'"
          :aria-pressed="scaleTypeId === t.id"
          @click="scaleTypeId = t.id"
        >
          {{ t.label }}
        </button>
      </div>
      <p class="text-xs text-ink-400">
        <strong class="text-ink-200">{{ noteLabel(tonic) }} {{ scaleType.label.toLowerCase() }}</strong>
        <template v-if="scaleSummary"> · {{ scaleSummary }}</template>
      </p>
    </section>

    <section v-if="tab !== 'octaves'" class="px-4 pb-5 md:px-0">
      <ul class="grid grid-cols-5 gap-1 sm:grid-cols-7 md:grid-cols-10">
        <li v-for="tile in tab === 'full' ? tiles : scaleTiles" :key="tile.key">
          <RouterLink
            :to="{ name: 'note', params: { note: tile.to } }"
            class="flex h-full flex-col items-center gap-1 border px-0.5 pt-1.5 pb-1.5 transition-colors hover:border-ink-600 active:bg-ink-800"
            :class="tile.tonic ? 'border-accent-400 bg-ink-800' : 'border-ink-800 bg-ink-900'"
          >
            <NoteBadge :note="tile.note" size="sm" />
            <KeyChart v-if="tile.primary" :keys="tile.primary.keys" :partial="tile.primary.partial" :height="84" class="h-auto max-w-full" />
          </RouterLink>
        </li>
      </ul>
      <p v-if="tab === 'scales' && !scaleTiles.length" class="py-10 text-center text-sm text-ink-400">
        No notes of this scale on the {{ settings.instrument.noun }}.
      </p>
    </section>

    <section v-for="group in tab === 'octaves' ? octaves : []" :key="group.octave" class="space-y-2 px-4 pb-5 md:px-0">
      <h2 class="text-[11px] font-semibold tracking-wider text-ink-400 uppercase">
        Octave {{ group.octave }}
        <span class="font-normal tracking-normal normal-case">
          · {{ settings.instrument.registerNames[group.octave] }}
        </span>
      </h2>
      <ul class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        <li v-for="row in group.notes" :key="row.midi">
          <RouterLink
            :to="{ name: 'note', params: { note: row.note } }"
            class="flex h-full flex-col items-center gap-2 border border-ink-800 bg-ink-900 px-1.5 pt-2 pb-2.5 transition-colors hover:border-ink-600 active:bg-ink-800"
          >
            <span class="flex items-baseline justify-between self-stretch px-0.5">
              <NoteBadge :note="row.note" size="sm" />
              <span class="text-[10px] text-ink-400">{{ row.count }} {{ row.count === 1 ? 'way' : 'ways' }}</span>
            </span>
            <KeyChart
              v-if="row.primary"
              :keys="row.primary.keys"
              :partial="row.primary.partial"
              :height="132"
              class="h-auto max-w-full"
            />
          </RouterLink>
        </li>
      </ul>
    </section>

    <p v-if="tab === 'octaves' && !octaves.length" class="px-4 py-10 text-center text-sm text-ink-400">
      No note “{{ query }}” on the {{ settings.instrument.noun }}.
    </p>

    <p class="mx-4 mt-6 border border-ink-800 px-4 py-3 text-xs leading-relaxed text-ink-400 md:mx-0">
      <template v-if="settings.instrument.transposeSemitones">
        Notes are shown in written pitch, as you read them.
      </template>
      <template v-if="settings.instrument.options.length">
        Showing the range for your setup:
        <strong class="text-ink-200">{{ settings.setupSummary(settings.instrumentId) }}</strong
        >. Change it in
        <RouterLink :to="{ name: 'settings' }" class="text-accent-400">Setup</RouterLink>.
      </template>
    </p>
  </div>
</template>
