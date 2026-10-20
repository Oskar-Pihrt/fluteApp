<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Jump, Measure, Score, TimeSignature } from '@/score/model'
import { keyAt, timeAt } from '@/score/ops'

/**
 * What a measure carries besides its notes: time and key signatures,
 * barlines, first/second endings and navigation marks — as rows of buttons
 * a thumb can hit, for the measure the selection is in. Lives in a bottom
 * sheet; the arrows step through the measures without closing it.
 */
const props = defineProps<{ score: Score; measureIndex: number; offMeasures: number }>()

const emit = defineEmits<{
  patch: [patch: Partial<Omit<Measure, 'id' | 'events'>>]
  fix: []
  addMeasure: []
  removeMeasure: []
  move: [delta: number]
}>()

const measure = computed(() => props.score.measures[props.measureIndex])
const rhythm = computed(() => props.score.mode === 'rhythm')

const TIMES: { label: string; time: TimeSignature; common?: boolean }[] = [
  { label: '2/4', time: { beats: 2, beatType: 4 }, common: true },
  { label: '3/4', time: { beats: 3, beatType: 4 }, common: true },
  { label: '4/4', time: { beats: 4, beatType: 4 }, common: true },
  { label: 'C', time: { beats: 4, beatType: 4, symbol: 'common' }, common: true },
  { label: '¢', time: { beats: 2, beatType: 2, symbol: 'cut' }, common: true },
  { label: '6/8', time: { beats: 6, beatType: 8 }, common: true },
  { label: '2/2', time: { beats: 2, beatType: 2 } },
  { label: '3/8', time: { beats: 3, beatType: 8 } },
  { label: '9/8', time: { beats: 9, beatType: 8 } },
  { label: '12/8', time: { beats: 12, beatType: 8 } },
  { label: '5/4', time: { beats: 5, beatType: 4 } },
]
const allTimes = ref(false)

const MAJORS = ['C♭', 'G♭', 'D♭', 'A♭', 'E♭', 'B♭', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯']
const MINORS = ['A♭', 'E♭', 'B♭', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F♯', 'C♯', 'G♯', 'D♯', 'A♯']
const KEYS = Array.from({ length: 15 }, (_, i) => {
  const fifths = i - 7
  const count = Math.abs(fifths)
  return { fifths, label: count ? `${count}${fifths > 0 ? '♯' : '♭'}` : '♮' }
})

const ENDINGS: { label: string; numbers: number[] }[] = [
  { label: '1st ending', numbers: [1] },
  { label: '2nd ending', numbers: [2] },
  { label: '3rd ending', numbers: [3] },
  { label: '1st & 2nd', numbers: [1, 2] },
]

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

const BAR_ENDS: { value: Measure['barEnd']; label: string; name: string }[] = [
  { value: undefined, label: '\uE030', name: 'Normal barline' },
  { value: 'double', label: '\uE031', name: 'Double barline' },
  { value: 'final', label: '\uE032', name: 'Final barline' },
  { value: 'repeatEnd', label: '\uE041', name: 'Repeat end' },
]

/** The time in force here, and whether this measure sets it. */
const time = computed(() => timeAt(props.score, props.measureIndex))
const key = computed(() => keyAt(props.score, props.measureIndex))
const sameTime = (a: TimeSignature, b: TimeSignature) =>
  a.beats === b.beats && a.beatType === b.beatType && (a.symbol ?? null) === (b.symbol ?? null)

const shownTimes = computed(() => TIMES.filter((t) => allTimes.value || t.common || sameTime(t.time, time.value)))

function setTime(choice: TimeSignature) {
  // The first measure's time is the piece's; elsewhere, picking what is
  // already in force clears the change.
  const inherited = props.measureIndex ? timeAt(props.score, props.measureIndex - 1) : null
  emit('patch', { time: inherited && sameTime(inherited, choice) ? undefined : choice })
}

function setKey(fifths: number) {
  const inherited = props.measureIndex ? keyAt(props.score, props.measureIndex - 1) : 0
  emit('patch', { keyFifths: fifths === inherited && props.measureIndex ? undefined : fifths })
}

function toggleEnding(numbers: number[]) {
  const same = measure.value.volta?.numbers.join(',') === numbers.join(',')
  emit('patch', { volta: same ? undefined : { numbers } })
}

function toggleJump(jump: Jump) {
  const jumps = measure.value.jumps ?? []
  const next = jumps.includes(jump) ? jumps.filter((j) => j !== jump) : [...jumps, jump]
  emit('patch', { jumps: next.length ? next : undefined })
}

const heading = 'text-[11px] font-semibold uppercase tracking-wider text-ink-400'
const chip = 'h-10 min-w-11 border px-2 text-sm font-semibold transition-colors'
const on = 'border-accent-400 bg-accent-400 text-ink-950'
const off = 'border-ink-600 text-ink-50 hover:border-accent-400'
</script>

<template>
  <section v-if="measure" class="space-y-4 px-4" aria-label="Measure">
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="h-11 w-11 border border-ink-600 text-lg text-ink-50 disabled:opacity-30"
        aria-label="Previous measure"
        :disabled="props.measureIndex === 0"
        @click="emit('move', -1)"
      >
        ‹
      </button>
      <h2 class="flex-1 text-center text-lg">
        Measure {{ props.measureIndex + 1 }}
        <span class="text-sm font-normal text-ink-400">of {{ props.score.measures.length }}</span>
      </h2>
      <button
        type="button"
        class="h-11 w-11 border border-ink-600 text-lg text-ink-50 disabled:opacity-30"
        aria-label="Next measure"
        :disabled="props.measureIndex >= props.score.measures.length - 1"
        @click="emit('move', 1)"
      >
        ›
      </button>
    </div>

    <p
      v-if="rhythm && props.offMeasures"
      class="flex items-center gap-3 border border-amber-500/45 bg-amber-500/10 px-3 py-2 text-xs text-amber-100"
    >
      <span class="flex-1">
        {{ props.offMeasures }} {{ props.offMeasures === 1 ? 'measure doesn’t' : 'measures don’t' }} add up to the
        time signature.
      </span>
      <button type="button" class="h-9 shrink-0 border border-amber-400 px-3 font-semibold text-amber-300" @click="emit('fix')">
        Regroup
      </button>
    </p>

    <div v-if="rhythm" class="space-y-2">
      <h3 :class="heading">Time signature <span class="font-normal normal-case tracking-normal">· from here on</span></h3>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="t in shownTimes"
          :key="t.label"
          type="button"
          :class="[chip, sameTime(t.time, time) ? on : off]"
          :aria-pressed="sameTime(t.time, time)"
          @click="setTime(t.time)"
        >
          {{ t.label }}
        </button>
        <button v-if="!allTimes" type="button" :class="[chip, off, 'font-normal']" @click="allTimes = true">More…</button>
      </div>
    </div>

    <div class="space-y-2">
      <h3 :class="heading">
        Key <span class="font-normal normal-case tracking-normal">· {{ MAJORS[key + 7] }} major / {{ MINORS[key + 7] }} minor</span>
      </h3>
      <div class="chips -mx-4 flex gap-1.5 overflow-x-auto px-4">
        <button
          v-for="k in KEYS"
          :key="k.fifths"
          type="button"
          :class="[chip, 'shrink-0', k.fifths === key ? on : off]"
          :aria-pressed="k.fifths === key"
          :aria-label="`${k.label}, ${MAJORS[k.fifths + 7]} major`"
          @click="setKey(k.fifths)"
        >
          {{ k.label }}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-[2fr_4fr] gap-3">
      <div class="space-y-2">
        <h3 :class="heading">Start</h3>
        <div class="flex border border-ink-600">
          <button
            type="button"
            class="h-10 flex-1 text-xs"
            :class="!measure.barStart ? 'bg-ink-800 text-ink-50' : 'text-ink-400'"
            :aria-pressed="!measure.barStart"
            @click="emit('patch', { barStart: undefined })"
          >
            Normal
          </button>
          <button
            type="button"
            class="music h-10 flex-1 border-l border-ink-600 text-xl"
            :class="measure.barStart === 'repeatStart' ? 'bg-ink-800 text-accent-300' : 'text-ink-200'"
            aria-label="Repeat start"
            :aria-pressed="measure.barStart === 'repeatStart'"
            @click="emit('patch', { barStart: 'repeatStart' })"
          >
            {{ '\uE040' }}
          </button>
        </div>
      </div>
      <div class="space-y-2">
        <h3 :class="heading">End</h3>
        <div class="flex border border-ink-600">
          <button
            v-for="(bar, i) in BAR_ENDS"
            :key="bar.name"
            type="button"
            class="music h-10 flex-1 text-xl"
            :class="[
              i ? 'border-l border-ink-600' : '',
              measure.barEnd === bar.value ? 'bg-ink-800 text-accent-300' : 'text-ink-200',
            ]"
            :aria-label="bar.name"
            :aria-pressed="measure.barEnd === bar.value"
            @click="emit('patch', { barEnd: bar.value })"
          >
            {{ bar.label }}
          </button>
        </div>
      </div>
    </div>

    <div class="space-y-2">
      <h3 :class="heading">Endings &amp; marks</h3>
      <div class="flex flex-wrap gap-1.5">
        <button
          v-for="ending in ENDINGS"
          :key="ending.label"
          type="button"
          :class="[chip, 'h-9 text-xs font-medium', measure.volta?.numbers.join(',') === ending.numbers.join(',') ? on : off]"
          :aria-pressed="measure.volta?.numbers.join(',') === ending.numbers.join(',')"
          @click="toggleEnding(ending.numbers)"
        >
          {{ ending.label }}
        </button>
        <button
          v-for="j in JUMPS"
          :key="j.jump"
          type="button"
          :class="[chip, 'h-9 text-xs font-medium', measure.jumps?.includes(j.jump) ? on : off]"
          :aria-pressed="measure.jumps?.includes(j.jump) ?? false"
          @click="toggleJump(j.jump)"
        >
          {{ j.label }}
        </button>
      </div>
    </div>

    <div class="flex gap-2 pt-1">
      <button
        type="button"
        class="h-12 flex-1 border border-ink-600 text-sm text-ink-50 hover:border-accent-400"
        @click="emit('addMeasure')"
      >
        + Insert measure after
      </button>
      <button
        type="button"
        class="h-12 border border-ink-600 px-4 text-sm text-red-300 hover:border-red-500/60 disabled:opacity-35"
        :disabled="props.score.measures.length < 2"
        @click="emit('removeMeasure')"
      >
        Delete
      </button>
    </div>
  </section>
</template>

<style scoped>
/* SMuFL barline glyphs from Bravura, the font the score is engraved with. */
.music {
  font-family: Bravura, serif;
  line-height: 1;
}
.chips {
  scrollbar-width: none;
}
.chips::-webkit-scrollbar {
  display: none;
}
</style>
