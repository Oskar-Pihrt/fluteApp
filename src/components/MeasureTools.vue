<script setup lang="ts">
import { computed } from 'vue'
import type { Jump, Measure, Score, TimeSignature } from '@/score/model'
import { keyAt, timeAt } from '@/score/ops'

/**
 * What a measure carries besides its notes: time and key signatures,
 * barlines, first/second endings and navigation marks. Changes apply to the
 * measure the selection is in.
 */
const props = defineProps<{ score: Score; measureIndex: number; offMeasures: number }>()

const emit = defineEmits<{
  patch: [patch: Partial<Omit<Measure, 'id' | 'events'>>]
  fix: []
  addMeasure: []
  removeMeasure: []
}>()

const measure = computed(() => props.score.measures[props.measureIndex])
const rhythm = computed(() => props.score.mode === 'rhythm')

const TIMES: { label: string; time: TimeSignature }[] = [
  { label: '2/4', time: { beats: 2, beatType: 4 } },
  { label: '3/4', time: { beats: 3, beatType: 4 } },
  { label: '4/4', time: { beats: 4, beatType: 4 } },
  { label: 'C', time: { beats: 4, beatType: 4, symbol: 'common' } },
  { label: '¢', time: { beats: 2, beatType: 2, symbol: 'cut' } },
  { label: '2/2', time: { beats: 2, beatType: 2 } },
  { label: '3/8', time: { beats: 3, beatType: 8 } },
  { label: '6/8', time: { beats: 6, beatType: 8 } },
  { label: '9/8', time: { beats: 9, beatType: 8 } },
  { label: '12/8', time: { beats: 12, beatType: 8 } },
  { label: '5/4', time: { beats: 5, beatType: 4 } },
]

const MAJORS = ['C♭', 'G♭', 'D♭', 'A♭', 'E♭', 'B♭', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯']
const KEYS = Array.from({ length: 15 }, (_, i) => {
  const fifths = i - 7
  const count = Math.abs(fifths)
  return { fifths, label: `${count ? `${count}${fifths > 0 ? '♯' : '♭'}` : 'No accidentals'} · ${MAJORS[i]} major` }
})

const JUMPS: { jump: Jump; label: string }[] = [
  { jump: 'segno', label: 'Segno 𝄋' },
  { jump: 'coda', label: 'Coda 𝄌' },
  { jump: 'toCoda', label: 'To Coda' },
  { jump: 'fine', label: 'Fine' },
  { jump: 'dc', label: 'D.C.' },
  { jump: 'dcAlFine', label: 'D.C. al Fine' },
  { jump: 'dcAlCoda', label: 'D.C. al Coda' },
  { jump: 'ds', label: 'D.S.' },
  { jump: 'dsAlFine', label: 'D.S. al Fine' },
  { jump: 'dsAlCoda', label: 'D.S. al Coda' },
]

const timeLabel = computed(() => {
  const time = measure.value?.time
  if (!time) return ''
  return TIMES.find((t) => JSON.stringify(t.time) === JSON.stringify(time))?.label ?? `${time.beats}/${time.beatType}`
})

function setTime(label: string) {
  if (!label) return emit('patch', { time: undefined })
  const found = TIMES.find((t) => t.label === label)
  if (found) emit('patch', { time: found.time })
}

function setKey(value: string) {
  emit('patch', { keyFifths: value === '' ? undefined : Number(value) })
}

function setVolta(value: string) {
  emit('patch', { volta: value ? { numbers: value.split(',').map(Number) } : undefined })
}

function toggleJump(jump: Jump, on: boolean) {
  const jumps = (measure.value?.jumps ?? []).filter((j) => j !== jump)
  emit('patch', { jumps: on ? [...jumps, jump] : jumps.length ? jumps : undefined })
}

const field = 'w-full rounded-lg border border-ink-600 bg-ink-950 px-2 py-1.5 text-xs text-ink-50'
const label = 'text-[11px] font-semibold uppercase tracking-wider text-ink-400'
</script>

<template>
  <section v-if="measure" class="space-y-3 rounded-xl border border-ink-700 bg-ink-900 p-3" aria-label="Measure">
    <div class="flex items-center justify-between gap-2">
      <h3 :class="label">Measure {{ props.measureIndex + 1 }}</h3>
      <div class="flex gap-1.5">
        <button
          type="button"
          class="rounded-md border border-ink-600 px-2 py-1 text-[11px] font-medium text-ink-200 hover:border-accent-400"
          @click="emit('addMeasure')"
        >
          + measure after
        </button>
        <button
          type="button"
          class="rounded-md border border-ink-600 px-2 py-1 text-[11px] font-medium text-ink-400 hover:border-red-500/60 hover:text-red-300"
          :disabled="props.score.measures.length < 2"
          @click="emit('removeMeasure')"
        >
          Delete measure
        </button>
      </div>
    </div>

    <p
      v-if="rhythm && props.offMeasures"
      class="flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
    >
      <span>
        {{ props.offMeasures }} {{ props.offMeasures === 1 ? 'measure doesn’t' : 'measures don’t' }} add up to the
        time signature.
      </span>
      <button type="button" class="shrink-0 font-semibold text-amber-200 hover:text-amber-50" @click="emit('fix')">
        Regroup measures
      </button>
    </p>

    <div class="grid grid-cols-2 gap-2">
      <label v-if="rhythm" class="space-y-1">
        <span :class="label">Time</span>
        <select :class="field" :value="timeLabel" @change="setTime(($event.target as HTMLSelectElement).value)">
          <option value="">
            {{ props.measureIndex ? `Continue (${timeAt(props.score, props.measureIndex).beats}/${timeAt(props.score, props.measureIndex).beatType})` : '4/4 (default)' }}
          </option>
          <option v-for="t in TIMES" :key="t.label" :value="t.label">{{ t.label }}</option>
        </select>
      </label>
      <label class="space-y-1">
        <span :class="label">Key</span>
        <select
          :class="field"
          :value="measure.keyFifths ?? ''"
          @change="setKey(($event.target as HTMLSelectElement).value)"
        >
          <option value="">Continue ({{ KEYS[keyAt(props.score, props.measureIndex) + 7].label }})</option>
          <option v-for="k in KEYS" :key="k.fifths" :value="k.fifths">{{ k.label }}</option>
        </select>
      </label>
      <label class="space-y-1">
        <span :class="label">Starts with</span>
        <select
          :class="field"
          :value="measure.barStart ?? ''"
          @change="emit('patch', { barStart: (($event.target as HTMLSelectElement).value || undefined) as Measure['barStart'] })"
        >
          <option value="">Normal barline</option>
          <option value="repeatStart">Repeat start 𝄆</option>
        </select>
      </label>
      <label class="space-y-1">
        <span :class="label">Ends with</span>
        <select
          :class="field"
          :value="measure.barEnd ?? ''"
          @change="emit('patch', { barEnd: (($event.target as HTMLSelectElement).value || undefined) as Measure['barEnd'] })"
        >
          <option value="">Normal barline</option>
          <option value="double">Double barline</option>
          <option value="final">Final barline</option>
          <option value="repeatEnd">Repeat end 𝄇</option>
        </select>
      </label>
      <label class="space-y-1">
        <span :class="label">Ending</span>
        <select
          :class="field"
          :value="measure.volta?.numbers.join(',') ?? ''"
          @change="setVolta(($event.target as HTMLSelectElement).value)"
        >
          <option value="">None</option>
          <option value="1">1st ending</option>
          <option value="2">2nd ending</option>
          <option value="3">3rd ending</option>
          <option value="1,2">1st and 2nd</option>
        </select>
      </label>
    </div>

    <div class="space-y-1">
      <span :class="label">Marks</span>
      <div class="flex flex-wrap gap-1.5">
        <label
          v-for="j in JUMPS"
          :key="j.jump"
          class="flex cursor-pointer items-center gap-1.5 rounded-md border border-ink-700 px-2 py-1 text-[11px] text-ink-200"
        >
          <input
            type="checkbox"
            class="h-3.5 w-3.5 accent-accent-400"
            :checked="measure.jumps?.includes(j.jump) ?? false"
            @change="toggleJump(j.jump, ($event.target as HTMLInputElement).checked)"
          />
          {{ j.label }}
        </label>
      </div>
    </div>
  </section>
</template>
