<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import KeyChart from '@/components/KeyChart.vue'
import NoteBadge from '@/components/NoteBadge.vue'
import PlayButton from '@/components/PlayButton.vue'
import type { Fingering } from '@/domain/fingering'
import type { KeyId } from '@/domain/keys'
import {
  canonicalNote,
  nearestFingerings,
  noteLabel,
  noteLabelWithEnharmonic,
  notesForKeys,
  unavailableKeys,
} from '@/domain/lookup'
import { useSettingsStore } from '@/stores/settings'

/**
 * Feature 1 — pick the keys you press, get the notes it produces.
 *
 * The chart takes the screen; the answer sits in a panel pinned above the tab
 * bar, so it stays in view while the keys are tapped. The first two octaves
 * share fingerings, so a match commonly returns two notes an octave apart:
 * the panel leads with one and offers the others beside it.
 */

const settings = useSettingsStore()
const selected = ref<KeyId[]>([])
/** Holes the player marked as half covered (recorder thumb, whistle half-holes). */
const half = ref<KeyId[]>([])

const unavailable = computed(() => unavailableKeys(settings.context))

const matches = computed(() => notesForKeys(selected.value, settings.context, half.value))
const touched = computed(() => selected.value.length > 0 || half.value.length > 0)

/** Which of several matches the panel leads with. */
const shownIndex = ref(0)
const shown = computed(() => matches.value[Math.min(shownIndex.value, matches.value.length - 1)] ?? null)
const others = computed(() => matches.value.filter((match) => match !== shown.value))
watch(matches, () => (shownIndex.value = 0))

const suggestions = computed(() =>
  matches.value.length || !touched.value
    ? []
    : nearestFingerings(selected.value, settings.context, 3, half.value),
)

/**
 * On a phone the page is exactly one screen, so the chart takes whatever room
 * the title and the answer panel leave — measured, not guessed, since phones
 * differ by a couple of hundred pixels. From `md` up it is drawn large.
 */
const chartBox = ref<HTMLElement | null>(null)
const box = ref({ width: 0, height: 0 })
const wide = ref(window.matchMedia('(min-width: 768px)').matches)
const observer = new ResizeObserver(([entry]) => {
  box.value = { width: entry.contentRect.width, height: entry.contentRect.height }
  wide.value = window.matchMedia('(min-width: 768px)').matches
})
onMounted(() => chartBox.value && observer.observe(chartBox.value))
onBeforeUnmount(() => observer.disconnect())
const chartHeight = computed(() => {
  if (wide.value || !box.value.height) return undefined
  const chart = settings.instrument.chart
  const large = (chart.pixelWidth.lg * chart.height) / chart.width
  const byWidth = (box.value.width * chart.height) / chart.width
  return Math.floor(Math.min(large, byWidth, box.value.height))
})

// A key set from one instrument means nothing on another.
watch(
  () => settings.instrumentId,
  () => reset(),
)

function reset() {
  selected.value = []
  half.value = []
}

function apply(fingering: Fingering) {
  selected.value = [...fingering.keys]
  half.value = [...fingering.partial]
}

function show(note: string) {
  shownIndex.value = Math.max(0, matches.value.findIndex((match) => match.note === note))
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-3 md:block md:space-y-4">
    <header class="flex shrink-0 items-center gap-3">
      <div class="min-w-0 flex-1">
        <h1 class="text-2xl">What note is this?</h1>
        <p class="mt-0.5 text-sm text-ink-400">
          {{ settings.instrument.shortName }} · tap the keys you hold down
        </p>
      </div>
      <button
        type="button"
        class="flex h-11 w-11 shrink-0 items-center justify-center border border-ink-700 text-ink-200 transition-colors hover:border-ink-400 disabled:opacity-30"
        aria-label="Clear keys"
        :disabled="!touched"
        @click="reset"
      >
        <svg viewBox="0 0 24 24" class="h-[18px] w-[18px]" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path d="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4" />
        </svg>
      </button>
    </header>

    <div class="flex min-h-0 flex-1 flex-col gap-3 md:flex-row md:items-start md:gap-9">
      <div ref="chartBox" class="flex min-h-0 flex-1 justify-center overflow-hidden md:flex-none md:overflow-visible">
        <KeyChart
          v-model:keys="selected"
          v-model:partial="half"
          interactive
          size="lg"
          :height="chartHeight"
          :unavailable="unavailable"
          class="shrink-0"
        />
      </div>

      <!-- The answer. Full width along the bottom on a phone, its height kept
           steady so the chart doesn't jump; beside the chart from `md` up. -->
      <section
        aria-live="polite"
        aria-label="Result"
        class="-mx-4 min-h-36 shrink-0 border-t border-ink-700 bg-ink-900 px-4 pt-3 pb-3.5 md:mx-0 md:min-h-0 md:w-full md:min-w-0 md:flex-1 md:border md:p-4"
      >
        <div class="mx-auto max-w-3xl">
          <!-- Nothing pressed yet. -->
          <p v-if="!touched" class="py-4 text-center text-sm text-ink-400">Your note appears here.</p>

          <!-- A match. -->
          <template v-else-if="shown">
            <div class="flex items-center gap-3">
              <div class="min-w-0 flex-1">
                <p class="flex flex-wrap items-baseline gap-x-2">
                  <NoteBadge :note="shown.note" size="md" />
                  <button
                    v-for="other in others"
                    :key="other.id"
                    type="button"
                    class="text-base text-ink-400 underline decoration-ink-600 underline-offset-4 hover:text-ink-200"
                    @click="show(other.note)"
                  >
                    or {{ noteLabel(other.note) }}
                  </button>
                </p>
                <p class="mt-0.5 truncate text-xs text-ink-400">
                  {{ noteLabelWithEnharmonic(shown.note) }}
                  <span v-if="shown.kind !== 'primary'" class="text-accent-400">· {{ shown.kind }} fingering</span>
                  <span v-if="others.length && !shown.comment"> · same keys, other octave</span>
                  <span v-if="shown.comment"> · {{ shown.comment }}</span>
                </p>
              </div>
              <PlayButton :note="shown.note" class="h-12! w-12! shrink-0 border-0! bg-accent-400 text-ink-950!" />
            </div>
            <RouterLink
              :to="{ name: 'note', params: { note: canonicalNote(shown.midi) } }"
              class="mt-3 flex h-11 items-center justify-center border border-ink-700 text-sm text-ink-200 transition-colors hover:border-accent-400"
            >
              All ways to play {{ noteLabel(shown.note) }}
            </RouterLink>
          </template>

          <!-- No match: the nearest fingerings, one tap to set. -->
          <template v-else>
            <p class="text-sm font-semibold text-ink-50">No note for these keys</p>
            <p class="mt-0.5 text-xs text-ink-400">
              {{ suggestions.length ? 'Closest fingerings — tap one to set it:' : `Plenty of combinations play nothing on the ${settings.instrument.noun}.` }}
            </p>
            <div v-if="suggestions.length" class="mt-2.5 grid grid-cols-3 gap-2">
              <button
                v-for="suggestion in suggestions"
                :key="suggestion.fingering.id"
                type="button"
                class="flex h-16 flex-col items-center justify-center gap-0.5 border border-ink-700 bg-ink-950 transition-colors hover:border-accent-400"
                @click="apply(suggestion.fingering)"
              >
                <NoteBadge :note="suggestion.fingering.note" size="sm" />
                <span class="text-[11px] text-ink-400">
                  {{ suggestion.distance }} {{ suggestion.distance === 1 ? 'key' : 'keys' }} away
                </span>
              </button>
            </div>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>
