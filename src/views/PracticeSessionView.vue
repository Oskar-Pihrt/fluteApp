<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import KeyChart from '@/components/KeyChart.vue'
import NoteBadge from '@/components/NoteBadge.vue'
import PitchTrace from '@/components/PitchTrace.vue'
import StaffPosition from '@/components/StaffPosition.vue'
import TuningBar from '@/components/TuningBar.vue'
import { audioContext, playNote } from '@/domain/audio'
import { fingeringsForNote, noteLabel, noteRange } from '@/domain/lookup'
import { NoteStabiliser } from '@/domain/pitch'
import {
  dayNumber,
  EXERCISE_TITLES,
  IN_TUNE_CENTS,
  keyId,
  LONG_TONE_SECONDS,
  longTones,
  noteDrill,
  scaleForDay,
  scaleName,
  scaleSteps,
  seededRandom,
  TRAINING,
  type ExerciseId,
  type Step,
} from '@/domain/practice'
import { startMetronome, type Metronome } from '@/practice/metronome'
import { useMicrophone } from '@/practice/useMicrophone'
import { BPM_RANGE, usePracticeStore } from '@/stores/practice'
import { useSettingsStore } from '@/stores/settings'

/**
 * One practice exercise, full screen and never scrolling: long tones, notes
 * with their fingerings, or a scale. The microphone confirms each note; the
 * "Played" button moves on without it, for a noisy room or a refused mic.
 *
 * Opened with `?training=1` it is a part of today's training: finishing it
 * ticks the part off and leads on to the next one.
 */

const route = useRoute()
const router = useRouter()
const practice = usePracticeStore()
const settings = useSettingsStore()

const exercise = computed(() => route.params.exercise as ExerciseId)
const inTraining = computed(() => route.query.training === '1')
const instrument = computed(() => settings.instrument)
const context = computed(() => settings.context)
const range = computed(() => noteRange(context.value).map((entry) => entry.midi))

const mic = useMicrophone(() => instrument.value)

// ── The exercise's notes ──────────────────────────────────────────────────

const scaleKey = computed(() => scaleForDay(range.value, practice.today))
const steps = ref<Step[]>([])
const index = ref(0)
const finished = ref(false)
const step = computed(() => steps.value[index.value] ?? null)

function build() {
  const today = practice.today
  if (exercise.value === 'longTones') steps.value = longTones(range.value, today)
  else if (exercise.value === 'notes') {
    // Training draws the day's notes; free practice a fresh set each time.
    const rng = inTraining.value ? seededRandom(dayNumber(today)) : Math.random
    steps.value = noteDrill(range.value, practice.recordsFor(settings.instrumentId).notes, rng)
  } else steps.value = (scaleKey.value && scaleSteps(scaleKey.value, range.value)) || []
  index.value = 0
  finished.value = false
  resetStep()
}

const fingering = computed(() => (step.value ? (fingeringsForNote(step.value.note, context.value)[0] ?? null) : null))

const title = computed(() =>
  exercise.value === 'scale' && scaleKey.value ? `${scaleName(scaleKey.value)} — up and down` : EXERCISE_TITLES[exercise.value],
)
const subtitle = computed(() => {
  const part = inTraining.value ? `Part ${TRAINING.indexOf(exercise.value) + 1} of 3 · ` : ''
  return `${part}note ${Math.min(index.value + 1, steps.value.length)} of ${steps.value.length}`
})

// ── Sizing: the chart takes what height the screen can spare. ─────────────

const viewportHeight = ref(typeof window === 'undefined' ? 800 : window.innerHeight)
function onResize() {
  viewportHeight.value = window.innerHeight
}
const chartHeight = computed(() => {
  const share = exercise.value === 'longTones' ? 0.3 : exercise.value === 'notes' ? 0.32 : 0.26
  return Math.round(Math.min(260, Math.max(110, viewportHeight.value * share)))
})

// ── Per-step state ────────────────────────────────────────────────────────

const stabiliser = new NoteStabiliser(150)
/** Long tones: seconds held in tune, the longest unbroken run, and the trace. */
const held = ref(0)
const run = ref(0)
const bestRun = ref(0)
/** Longest unbroken in-tune run on the current note — what the record keeps. */
let stepBest = 0
const trace = ref<{ t: number; cents: number | null }[]>([])
let stepStarted = 0
let lastFrame = 0
/** Notes and scales: a wrong note was heard before the right one. */
const fumbled = ref(false)
const wrongHeard = ref<string | null>(null)
const success = ref<{ note: string; cents: number } | null>(null)
const revealed = ref(false)
let revealTimer = 0
let advanceTimer = 0
/** Scales: timing of each played note — 'on', 'off', or null before it is played. */
const timing = ref<('on' | 'off' | null)[]>([])
/** Session tallies for the summary. */
const firstTry = ref(0)
const onBeat = ref(0)
/** Notes the microphone confirmed, as opposed to "Played" taps. */
const heardCount = ref(0)

function resetStep() {
  stabiliser.reset()
  held.value = 0
  run.value = 0
  stepBest = 0
  trace.value = []
  stepStarted = performance.now()
  lastFrame = stepStarted
  fumbled.value = false
  wrongHeard.value = null
  success.value = null
  revealed.value = !practice.hideFingering
  window.clearTimeout(revealTimer)
  if (!revealed.value) revealTimer = window.setTimeout(() => (revealed.value = true), 3000)
}

function advance() {
  window.clearTimeout(advanceTimer)
  if (index.value + 1 >= steps.value.length) {
    complete()
    return
  }
  index.value++
  resetStep()
}

/** The fallback: the player says they played it. Counts toward progress, not records. */
function played() {
  advance()
}

watch(
  () => mic.heard.value,
  (heard) => {
    const current = step.value
    if (!current || finished.value || success.value) return
    const now = performance.now()

    if (exercise.value === 'longTones') {
      const dt = Math.min((now - lastFrame) / 1000, 0.1)
      lastFrame = now
      const onNote = heard != null && heard.midi === current.midi
      trace.value.push({ t: (now - stepStarted) / 1000, cents: onNote ? heard.cents : null })
      if (trace.value.length > 600) trace.value.splice(0, trace.value.length - 600)
      if (onNote && Math.abs(heard.cents) <= IN_TUNE_CENTS) {
        held.value += dt
        run.value += dt
        stepBest = Math.max(stepBest, run.value)
        bestRun.value = Math.max(bestRun.value, run.value)
      } else run.value = 0
      if (held.value >= LONG_TONE_SECONDS) {
        practice.recordHold(settings.instrumentId, current.midi, stepBest)
        success.value = { note: current.note, cents: heard?.cents ?? 0 }
        advanceTimer = window.setTimeout(advance, 600)
      }
      return
    }

    const steady = stabiliser.push(heard?.midi ?? null, now)
    if (steady == null) return
    if (steady !== current.midi) {
      fumbled.value = true
      wrongHeard.value = heard?.note ?? null
      return
    }
    wrongHeard.value = null
    success.value = { note: current.note, cents: heard?.cents ?? 0 }
    heardCount.value++
    if (exercise.value === 'notes') {
      practice.recordNote(settings.instrumentId, current.midi, fumbled.value)
      if (!fumbled.value) firstTry.value++
    } else {
      const context = audioContext()
      let mark: 'on' | 'off' = 'on'
      if (metronome && context) {
        const { offset } = metronome.nearestBeat(context.currentTime - 0.15)
        mark = Math.abs(offset) <= 0.25 ? 'on' : 'off'
      }
      timing.value[index.value] = mark
      if (mark === 'on') onBeat.value++
    }
    advanceTimer = window.setTimeout(advance, exercise.value === 'scale' ? 150 : 700)
  },
)

// ── Metronome (scales) ────────────────────────────────────────────────────

let metronome: Metronome | null = null
const beat = ref(-1)

function syncMetronome() {
  metronome?.stop()
  metronome = null
  beat.value = -1
  if (exercise.value !== 'scale' || !practice.metronomeOn || finished.value) return
  metronome = startMetronome(practice.metronomeBpm, 4, (b) => (beat.value = b))
}

watch(() => [practice.metronomeOn, practice.metronomeBpm, finished.value], syncMetronome)

function changeBpm(delta: number) {
  practice.metronomeBpm = Math.min(BPM_RANGE.max, Math.max(BPM_RANGE.min, practice.metronomeBpm + delta))
}

// ── Finishing ─────────────────────────────────────────────────────────────

const summary = computed(() => {
  const n = steps.value.length
  if (exercise.value === 'longTones') return `${n} long tones · longest steady hold ${bestRun.value.toFixed(1)} s`
  if (!heardCount.value) return `${n} notes`
  if (exercise.value === 'notes') return `${n} notes · ${firstTry.value} right first time`
  return practice.metronomeOn ? `${n} notes · ${onBeat.value} on the beat` : `${n} notes, up and down`
})

const nextPart = computed<ExerciseId | null>(() => {
  if (!inTraining.value) return null
  return TRAINING[TRAINING.indexOf(exercise.value) + 1] ?? null
})
const dayComplete = ref(false)

function complete() {
  finished.value = true
  mic.stop()
  if (exercise.value === 'scale' && scaleKey.value) practice.recordScale(settings.instrumentId, keyId(scaleKey.value))
  if (inTraining.value) {
    const wasDone = practice.doneToday
    practice.finishPart(exercise.value)
    dayComplete.value = !wasDone && practice.doneToday
  }
}

function goNext() {
  if (nextPart.value) void router.replace({ name: 'practiceSession', params: { exercise: nextPart.value }, query: { training: '1' } })
}

function again() {
  begin()
}

function hear() {
  if (step.value) playNote(step.value.note, instrument.value, 1.2)
}

// ── Lifecycle ─────────────────────────────────────────────────────────────

let sessionStarted = 0

function begin() {
  if (!TRAINING.includes(exercise.value)) {
    void router.replace({ name: 'practice' })
    return
  }
  practice.refreshDay()
  timing.value = []
  firstTry.value = 0
  onBeat.value = 0
  heardCount.value = 0
  bestRun.value = 0
  dayComplete.value = false
  build()
  void mic.start()
  syncMetronome()
}

onMounted(() => {
  sessionStarted = performance.now()
  window.addEventListener('resize', onResize)
  begin()
})

// The next part of the training reuses this view with new params.
watch(() => route.params.exercise, () => begin())

onBeforeUnmount(() => {
  window.removeEventListener('resize', onResize)
  window.clearTimeout(revealTimer)
  window.clearTimeout(advanceTimer)
  metronome?.stop()
  practice.addTime((performance.now() - sessionStarted) / 1000)
})

const micNote = computed(() => {
  switch (mic.state.value) {
    case 'listening':
      return 'Listening'
    case 'asking':
      return 'Asking for the microphone…'
    case 'denied':
      return 'Microphone blocked — tap Played after each note'
    case 'unsupported':
      return 'No microphone here — tap Played after each note'
    default:
      return 'Microphone off'
  }
})
</script>

<template>
  <div class="mx-auto flex h-svh max-w-xl flex-col gap-3 overflow-hidden px-4 pt-3 pb-[calc(0.75rem+var(--safe-bottom))] short:gap-2">
    <!-- Top bar -->
    <header class="flex shrink-0 items-center gap-3">
      <RouterLink
        :to="{ name: 'practice' }"
        class="flex h-11 w-11 shrink-0 items-center justify-center border border-ink-700 text-ink-200 transition-colors hover:border-ink-400"
        aria-label="Stop practice"
      >
        <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </RouterLink>
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-base">{{ title }}</h1>
        <p class="text-xs text-ink-400">{{ finished ? 'Finished' : subtitle }}</p>
      </div>
    </header>

    <!-- ── Finished ─────────────────────────────────────────────────── -->
    <section v-if="finished" class="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center">
      <template v-if="dayComplete">
        <svg viewBox="0 0 24 24" class="h-16 w-16 text-accent-400" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 1.6 1.2 2.5 2.5 3-.6-3 .2-5.6 0-8z" />
        </svg>
        <h2 class="text-2xl">Day complete</h2>
        <p class="text-sm text-ink-200">
          {{ practice.streak }}-day streak<template v-if="practice.streak >= practice.bestStreak && practice.streak > 1"> — your best yet</template>
        </p>
      </template>
      <template v-else>
        <svg viewBox="0 0 24 24" class="h-12 w-12 text-accent-400" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M5 12l5 5L20 7" />
        </svg>
        <h2 class="text-xl">{{ EXERCISE_TITLES[exercise] }} done</h2>
      </template>
      <p class="text-sm text-ink-400">{{ summary }}</p>
      <div class="mt-2 flex w-full max-w-xs flex-col gap-2">
        <button
          v-if="nextPart"
          type="button"
          class="h-12 bg-accent-400 text-base font-semibold text-ink-950 transition-colors hover:bg-accent-300"
          @click="goNext"
        >
          Next: {{ EXERCISE_TITLES[nextPart] }}
        </button>
        <button
          v-if="!inTraining"
          type="button"
          class="h-12 bg-accent-400 text-base font-semibold text-ink-950 transition-colors hover:bg-accent-300"
          @click="again"
        >
          Again
        </button>
        <RouterLink
          :to="{ name: 'practice' }"
          class="flex h-12 items-center justify-center border border-ink-600 text-sm font-medium text-ink-200 transition-colors hover:border-accent-400"
        >
          Back to Practice
        </RouterLink>
      </div>
    </section>

    <template v-else-if="step">
      <!-- ── Long tones ─────────────────────────────────────────────── -->
      <template v-if="exercise === 'longTones'">
        <ol class="flex shrink-0 gap-1.5" aria-label="Notes in this exercise">
          <li
            v-for="(s, i) in steps"
            :key="i"
            class="flex-1 border py-1.5 text-center text-sm font-semibold"
            :class="
              i < index
                ? 'border-ink-800 bg-ink-800 text-ink-400'
                : i === index
                  ? 'border-accent-400 bg-accent-400 text-ink-950'
                  : 'border-ink-700 text-ink-200'
            "
          >
            {{ noteLabel(s.note) }}
          </li>
        </ol>

        <section class="flex shrink-0 items-center justify-center gap-6">
          <NoteBadge :note="step.note" size="lg" />
          <KeyChart v-if="fingering" :keys="fingering.keys" :partial="fingering.partial" :instrument="instrument" :height="chartHeight" />
        </section>

        <TuningBar class="shrink-0" :cents="mic.heard.value && mic.heard.value.midi === step.midi ? mic.heard.value.cents : null" />

        <section class="flex min-h-0 flex-1 flex-col gap-2 border border-ink-700 bg-ink-900 p-3">
          <div class="flex shrink-0 justify-between text-xs text-ink-400">
            <span>Tuning over the last {{ LONG_TONE_SECONDS }} s</span>
            <span class="font-semibold text-ink-50">{{ held.toFixed(1) }} s in tune</span>
          </div>
          <div class="min-h-0 flex-1">
            <PitchTrace :points="trace" :seconds="LONG_TONE_SECONDS" />
          </div>
          <div class="h-1.5 shrink-0 bg-ink-800">
            <div class="h-full bg-accent-400" :style="{ width: `${Math.min(1, held / LONG_TONE_SECONDS) * 100}%` }" />
          </div>
          <p class="shrink-0 text-xs text-ink-400">
            Target {{ LONG_TONE_SECONDS }} s
            <template v-if="practice.recordsFor(settings.instrumentId).bestHold[String(step.midi)]">
              · best on {{ noteLabel(step.note) }} {{ practice.recordsFor(settings.instrumentId).bestHold[String(step.midi)] }} s
            </template>
          </p>
        </section>
      </template>

      <!-- ── Notes & fingerings ─────────────────────────────────────── -->
      <template v-else-if="exercise === 'notes'">
        <div class="h-1.5 shrink-0 bg-ink-800">
          <div class="h-full bg-accent-400 transition-[width]" :style="{ width: `${(index / steps.length) * 100}%` }" />
        </div>

        <section class="flex min-h-0 flex-1 items-center gap-4 border border-ink-700 bg-ink-900 px-4 py-3">
          <div class="flex min-w-0 flex-1 flex-col gap-3">
            <NoteBadge :note="step.note" size="lg" />
            <StaffPosition :note="step.note" size="md" />
          </div>
          <button
            v-if="!revealed"
            type="button"
            class="flex shrink-0 items-center justify-center border border-dashed border-ink-600 px-4 text-xs text-ink-400"
            :style="{ height: `${chartHeight}px` }"
            @click="revealed = true"
          >
            Tap to show<br />fingering
          </button>
          <KeyChart v-else-if="fingering" class="shrink-0" :keys="fingering.keys" :partial="fingering.partial" :instrument="instrument" :height="chartHeight" />
        </section>

        <p
          class="flex h-14 shrink-0 items-center gap-3 border px-4 text-sm"
          :class="
            success
              ? 'border-accent-500 bg-accent-500/15 text-ink-50'
              : wrongHeard
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-100'
                : 'border-ink-800 text-ink-400'
          "
          aria-live="polite"
        >
          <template v-if="success">
            <span class="font-semibold">Heard {{ noteLabel(success.note) }}</span>
            <span class="text-xs">{{ success.cents > 0 ? '+' : '' }}{{ success.cents }} cents</span>
          </template>
          <template v-else-if="wrongHeard">That’s {{ noteLabel(wrongHeard) }} — try {{ noteLabel(step.note) }}</template>
          <template v-else>Play it when you’re ready</template>
        </p>

        <div class="flex shrink-0 items-center gap-2">
          <span class="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Up next</span>
          <span
            v-for="(s, i) in steps.slice(index + 1, index + 4)"
            :key="i"
            class="border px-2.5 py-1 text-sm"
            :class="i === 0 ? 'border-ink-600 text-ink-200' : 'border-ink-800 text-ink-400'"
          >
            {{ noteLabel(s.note) }}
          </span>
        </div>

        <label class="flex shrink-0 items-center gap-2.5 text-sm text-ink-200">
          <input v-model="practice.hideFingering" type="checkbox" class="h-5 w-5 accent-accent-400" />
          Hide fingering until I tap
        </label>
      </template>

      <!-- ── Scale ──────────────────────────────────────────────────── -->
      <template v-else>
        <ol class="grid shrink-0 grid-cols-8 gap-1" aria-label="Scale notes">
          <li
            v-for="(s, i) in steps"
            :key="i"
            class="flex flex-col items-center gap-1 border py-1.5"
            :class="i < index ? 'border-ink-800 bg-ink-800' : i === index ? 'border-accent-400 bg-accent-400' : 'border-ink-700'"
          >
            <span class="text-sm font-semibold" :class="i < index ? 'text-ink-400' : i === index ? 'text-ink-950' : 'text-ink-200'">
              {{ noteLabel(s.note).replace(/\d+$/, '') }}
            </span>
            <span
              class="h-1.5 w-1.5"
              :class="timing[i] === 'on' ? 'bg-accent-400' : timing[i] === 'off' ? 'bg-amber-400' : 'bg-transparent'"
              :aria-label="timing[i] === 'on' ? 'on the beat' : timing[i] === 'off' ? 'off the beat' : undefined"
            />
          </li>
        </ol>

        <section class="flex min-h-0 flex-1 items-center gap-4 border border-ink-700 bg-ink-900 px-4 py-3">
          <div class="flex min-w-0 flex-1 flex-col gap-2">
            <span class="text-xs text-ink-400">Now</span>
            <NoteBadge :note="step.note" size="lg" />
            <p class="text-xs" :class="wrongHeard ? 'text-amber-300' : 'text-ink-400'">
              {{ wrongHeard ? `That’s ${noteLabel(wrongHeard)}` : index > 0 && timing[index - 1] ? (timing[index - 1] === 'on' ? 'On the beat' : 'A little off the beat') : ' ' }}
            </p>
          </div>
          <KeyChart v-if="fingering" class="shrink-0" :keys="fingering.keys" :partial="fingering.partial" :instrument="instrument" :height="chartHeight" />
        </section>

        <section class="shrink-0 space-y-2.5 border border-ink-700 p-3">
          <div class="flex items-center justify-between">
            <span class="text-sm font-semibold text-ink-50">Metronome</span>
            <button
              type="button"
              role="switch"
              :aria-checked="practice.metronomeOn"
              class="flex h-7 w-12 items-center p-1 transition-colors"
              :class="practice.metronomeOn ? 'justify-end bg-accent-400' : 'justify-start bg-ink-700'"
              aria-label="Metronome"
              @click="practice.metronomeOn = !practice.metronomeOn"
            >
              <span class="h-5 w-5 bg-ink-950" />
            </button>
          </div>
          <template v-if="practice.metronomeOn">
            <div class="grid grid-cols-4 gap-1.5" aria-hidden="true">
              <span v-for="b in 4" :key="b" class="h-2.5" :class="beat >= 0 && beat % 4 === b - 1 ? 'bg-accent-400' : 'bg-ink-700'" />
            </div>
            <div class="flex items-center gap-2">
              <button type="button" class="h-11 w-11 border border-ink-700 text-lg text-ink-200" aria-label="Slower" @click="changeBpm(-4)">−</button>
              <p class="flex-1 text-center">
                <span class="block text-xl font-semibold text-ink-50">{{ practice.metronomeBpm }}</span>
                <span class="block text-[11px] text-ink-400">BPM · one note per beat</span>
              </p>
              <button type="button" class="h-11 w-11 border border-ink-700 text-lg text-ink-200" aria-label="Faster" @click="changeBpm(4)">+</button>
            </div>
          </template>
        </section>
      </template>

      <!-- Microphone status and the two ways on. -->
      <p class="flex shrink-0 items-center gap-1.5 text-xs" :class="mic.state.value === 'listening' ? 'text-ink-400' : 'text-amber-300'">
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
        </svg>
        {{ micNote }}
        <button
          v-if="mic.state.value === 'denied' || mic.state.value === 'idle'"
          type="button"
          class="ml-auto text-xs font-medium text-accent-400"
          @click="mic.start()"
        >
          Try the mic
        </button>
      </p>
      <div class="grid shrink-0 grid-cols-2 gap-2">
        <button
          type="button"
          class="h-12 border border-ink-600 text-sm font-medium text-ink-200 transition-colors hover:border-accent-400"
          @click="hear"
        >
          Hear it
        </button>
        <button
          type="button"
          class="h-12 border border-ink-600 text-sm font-medium text-ink-200 transition-colors hover:border-accent-400"
          @click="played"
        >
          Played — next
        </button>
      </div>
    </template>

    <p v-else class="flex flex-1 items-center justify-center text-center text-sm text-ink-400">
      This exercise needs more notes than the {{ instrument.noun }} has in range.
    </p>
  </div>
</template>
