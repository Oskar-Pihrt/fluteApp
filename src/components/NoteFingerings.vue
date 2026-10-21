<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import FingeringCard from '@/components/FingeringCard.vue'
import NoteBadge from '@/components/NoteBadge.vue'
import PlayButton from '@/components/PlayButton.vue'
import StaffPosition from '@/components/StaffPosition.vue'
import {
  fingeringsForNote,
  noteFrequency,
  noteLabel,
  noteLabelWithEnharmonic,
  soundingNote,
} from '@/domain/lookup'
import { useSettingsStore } from '@/stores/settings'

/**
 * One note's full detail — staff position, badge, and every documented
 * fingering. Shared by the note library's inline panel and the standalone
 * note page, so the two present the same information.
 *
 * `paged` is the note page on a phone, which must fit one screen: one
 * fingering at a time, its chart sized to the room left, swiped or stepped
 * through with the arrows.
 */
const props = withDefaults(defineProps<{ note: string; paged?: boolean }>(), { paged: false })

const settings = useSettingsStore()
const fingerings = computed(() => fingeringsForNote(props.note, settings.context))
const frequency = computed(() => noteFrequency(props.note, settings.instrument))
/** Only shown for transposing instruments, where it differs from the note. */
const sounding = computed(() => {
  if (!settings.instrument.transposeSemitones) return null
  const note = soundingNote(props.note, settings.instrument)
  return note && noteLabel(note)
})

const page = ref(0)
const current = computed(() => fingerings.value[Math.min(page.value, fingerings.value.length - 1)])
watch(
  () => [props.note, fingerings.value.length],
  () => (page.value = 0),
)

function step(by: number) {
  page.value = Math.max(0, Math.min(fingerings.value.length - 1, page.value + by))
}

/** A horizontal swipe turns the page; anything mostly vertical is ignored. */
let swipeStart: { x: number; y: number } | null = null
function onPointerDown(event: PointerEvent) {
  swipeStart = { x: event.clientX, y: event.clientY }
}
function onPointerUp(event: PointerEvent) {
  if (!swipeStart) return
  const dx = event.clientX - swipeStart.x
  const dy = event.clientY - swipeStart.y
  swipeStart = null
  if (Math.abs(dx) > 50 && Math.abs(dx) > 2 * Math.abs(dy)) step(dx < 0 ? 1 : -1)
}

/** The card's box, measured: the chart takes its height, and at most half its width. */
const cardBox = ref<HTMLElement | null>(null)
const box = ref({ width: 0, height: 0 })
const observer = new ResizeObserver(([entry]) => {
  box.value = { width: entry.contentRect.width, height: entry.contentRect.height }
})
watch(cardBox, (element, previous) => {
  if (previous) observer.unobserve(previous)
  if (element) observer.observe(element)
})
onBeforeUnmount(() => observer.disconnect())
/** Card padding and border, around the chart. */
const CARD_INSET = 34
const chartHeight = computed(() => {
  const fingering = current.value
  if (!fingering || !box.value.height) return undefined
  const chart = settings.instrument.chart
  const large = (chart.pixelWidth.lg * chart.height) / chart.width
  const byWidth = ((box.value.width - CARD_INSET) * 0.55 * chart.height) / chart.width
  return Math.max(1, Math.floor(Math.min(large, byWidth, box.value.height - CARD_INSET)))
})
</script>

<template>
  <div :class="paged ? 'flex min-h-0 flex-1 flex-col gap-3' : 'space-y-5'">
    <header class="flex shrink-0 items-start gap-4">
      <StaffPosition
        :note="note"
        size="sm"
        class="shrink-0"
        :class="paged ? 'h-28 w-auto short:h-20' : ''"
      />
      <div class="min-w-0 flex-1">
        <NoteBadge :note="note" size="lg" />
        <p class="mt-1 text-sm text-ink-400">
          {{ noteLabelWithEnharmonic(note) }}
          <span v-if="sounding"> · sounds {{ sounding }}</span>
          <span v-if="frequency"> · {{ frequency.toFixed(1) }} Hz</span>
        </p>
      </div>
      <PlayButton :note="note" class="mt-1 shrink-0" />
    </header>

    <section v-if="paged && current" class="flex min-h-0 flex-1 flex-col gap-2" aria-roledescription="carousel">
      <div class="flex shrink-0 items-center gap-2">
        <h3 class="min-w-0 flex-1 truncate text-xs font-semibold tracking-wider text-ink-400 uppercase">
          <template v-if="fingerings.length > 1">Fingering {{ page + 1 }} of {{ fingerings.length }}</template>
          <template v-else>1 fingering</template>
        </h3>
        <template v-if="fingerings.length > 1">
          <button
            v-for="dir in [-1, 1]"
            :key="dir"
            type="button"
            class="flex h-10 w-10 items-center justify-center border border-ink-700 text-ink-200 transition-colors hover:border-ink-400 disabled:opacity-30"
            :aria-label="dir < 0 ? 'Previous fingering' : 'Next fingering'"
            :disabled="dir < 0 ? page === 0 : page === fingerings.length - 1"
            @click="step(dir)"
          >
            <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
              <path :d="dir < 0 ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'" />
            </svg>
          </button>
        </template>
      </div>
      <div
        ref="cardBox"
        class="min-h-0 flex-1 touch-pan-y"
        @pointerdown="onPointerDown"
        @pointerup="onPointerUp"
        @pointercancel="swipeStart = null"
      >
        <FingeringCard
          :key="current.id"
          :fingering="current"
          :height="chartHeight"
          class="h-full"
        />
      </div>
      <div v-if="fingerings.length > 1" class="flex shrink-0 justify-center gap-1.5" aria-hidden="true">
        <span
          v-for="(fingering, i) in fingerings"
          :key="fingering.id"
          class="h-1.5 w-1.5"
          :class="i === page ? 'bg-accent-400' : 'bg-ink-700'"
        />
      </div>
    </section>

    <section v-else-if="fingerings.length" class="space-y-3">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-ink-400">
        {{ fingerings.length }} {{ fingerings.length === 1 ? 'fingering' : 'fingerings' }}
      </h3>
      <!-- The diagram is tall, so pair cards up once there's width for it. -->
      <div class="grid gap-3 sm:grid-cols-2">
        <FingeringCard
          v-for="fingering in fingerings"
          :key="fingering.id"
          :fingering="fingering"
          size="md"
        />
      </div>
    </section>

    <p v-else class="rounded-xl border border-ink-700 bg-ink-900 px-4 py-6 text-sm text-ink-400">
      No fingering on record for {{ noteLabelWithEnharmonic(note) }} with your current instrument
      setup.
    </p>
  </div>
</template>
