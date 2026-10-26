<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { noteRange } from '@/domain/lookup'
import {
  EXERCISE_TITLES,
  scaleForDay,
  scaleName,
  scaleSteps,
  SCALE_KEYS,
  TRAINING,
  type ExerciseId,
} from '@/domain/practice'
import { usePracticeStore } from '@/stores/practice'
import { useSettingsStore } from '@/stores/settings'

/**
 * Practice — today's training and the streak it keeps.
 *
 * Three short parts in a fixed order; finishing all three counts the day. Each
 * exercise can also be played on its own from "Free practice", which adds to
 * the records but not the streak. One screen on a phone, no scrolling.
 */

const practice = usePracticeStore()
const settings = useSettingsStore()

onMounted(() => practice.refreshDay())

const range = computed(() => noteRange(settings.context).map((entry) => entry.midi))
const todaysKey = computed(() => scaleForDay(range.value, practice.today))
const records = computed(() => practice.recordsFor(settings.instrumentId))

/** Rough minutes per part, for the "left" estimate. */
const MINUTES: Record<ExerciseId, number> = { longTones: 3, notes: 4, scale: 3 }

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

const steps = computed(() =>
  TRAINING.map((id, i) => ({
    id,
    title: id === 'scale' && todaysKey.value ? `Scale — ${scaleName(todaysKey.value)}` : EXERCISE_TITLES[id],
    detail:
      id === 'longTones' ? '5 notes · held 8 s each' : id === 'notes' ? '20 notes from your range' : 'one octave up and down',
    state: i < practice.partsDone ? 'done' : i === practice.partsDone ? 'current' : 'pending',
  })),
)

const minutesLeft = computed(() =>
  TRAINING.slice(practice.partsDone).reduce((sum, id) => sum + MINUTES[id], 0),
)

const startLabel = computed(() => {
  const next = practice.nextPart
  if (!next) return ''
  return `${practice.partsDone ? 'Continue' : 'Start'} — ${EXERCISE_TITLES[next]}`
})

const bestHold = computed(() => {
  const holds = Object.values(records.value.bestHold)
  return holds.length ? `best ${Math.max(...holds).toFixed(1)} s` : 'no record yet'
})
const hitRate = computed(() => {
  const all = Object.values(records.value.notes)
  const attempts = all.reduce((sum, s) => sum + s.attempts, 0)
  if (!attempts) return 'no record yet'
  const misses = all.reduce((sum, s) => sum + s.misses, 0)
  return `${Math.round(((attempts - misses) / attempts) * 100)} % first try`
})
const keysDone = computed(() => {
  const playable = SCALE_KEYS.filter((key) => scaleSteps(key, range.value)).length
  return `${records.value.scalesDone.length} of ${playable} keys`
})

const FREE: { id: ExerciseId; record: () => string }[] = [
  { id: 'longTones', record: () => bestHold.value },
  { id: 'notes', record: () => hitRate.value },
  { id: 'scale', record: () => keysDone.value },
]
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-4 pb-3 short:gap-3 md:gap-6 md:pb-0">
    <header class="flex shrink-0 items-center justify-between gap-3">
      <h1 class="text-xl">Practice</h1>
      <p
        class="flex items-center gap-1.5 border px-2.5 py-1 text-sm font-semibold text-ink-50"
        :class="practice.streak ? 'border-accent-400' : 'border-ink-700'"
        :aria-label="`${practice.streak}-day streak`"
      >
        <svg viewBox="0 0 24 24" class="h-4 w-4 text-accent-400" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .3 1.6 1.2 2.5 2.5 3-.6-3 .2-5.6 0-8z" />
        </svg>
        {{ practice.streak }} {{ practice.streak === 1 ? 'day' : 'days' }}
      </p>
    </header>

    <!-- This week, Monday first. -->
    <ol class="grid shrink-0 grid-cols-7 gap-1.5" aria-label="This week">
      <li v-for="(entry, i) in practice.week" :key="entry.day" class="flex flex-col items-center gap-1">
        <span class="text-[11px] text-ink-400">{{ WEEKDAYS[i] }}</span>
        <span
          class="flex aspect-square w-full max-w-10 items-center justify-center text-[13px] font-semibold"
          :class="{
            'bg-accent-400 text-ink-950': entry.state === 'done',
            'border-2 border-accent-400 text-ink-50': entry.state === 'today',
            'border border-ink-700 text-ink-600': entry.state === 'missed',
            'border border-ink-800 text-ink-700': entry.state === 'future',
          }"
          :aria-label="`${entry.day}: ${entry.state}`"
        >
          <svg v-if="entry.state === 'done'" viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 12l5 5L20 7" />
          </svg>
          <template v-else>{{ Number(entry.day.slice(8)) }}</template>
        </span>
      </li>
    </ol>

    <!-- Today's training. -->
    <section class="shrink-0 space-y-2.5 border border-ink-700 bg-ink-900 p-4 short:p-3">
      <div class="flex items-baseline justify-between gap-3">
        <h2 class="text-base">Today’s training</h2>
        <p class="text-xs text-ink-400">
          <template v-if="practice.doneToday">Done for today</template>
          <template v-else>{{ practice.partsDone }} of 3 · ~{{ minutesLeft }} min left</template>
        </p>
      </div>
      <div class="h-1.5 bg-ink-800">
        <div class="h-full bg-accent-400 transition-[width]" :style="{ width: `${(practice.partsDone / 3) * 100}%` }" />
      </div>
      <ol>
        <li v-for="(step, i) in steps" :key="step.id" class="flex items-center gap-3 border-t border-ink-800 py-2.5 short:py-1.5">
          <span
            class="flex h-6 w-6 shrink-0 items-center justify-center text-xs font-bold"
            :class="{
              'bg-accent-400 text-ink-950': step.state === 'done',
              'border-2 border-accent-400 text-ink-50': step.state === 'current',
              'border border-ink-700 text-ink-400': step.state === 'pending',
            }"
          >
            <svg v-if="step.state === 'done'" viewBox="0 0 24 24" class="h-3.5 w-3.5" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M5 12l5 5L20 7" />
            </svg>
            <template v-else>{{ i + 1 }}</template>
          </span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-semibold" :class="step.state === 'done' ? 'text-ink-400' : 'text-ink-50'">{{ step.title }}</span>
            <span class="block text-xs text-ink-400 short:hidden">{{ step.detail }}</span>
          </span>
        </li>
      </ol>
      <RouterLink
        v-if="practice.nextPart"
        :to="{ name: 'practiceSession', params: { exercise: practice.nextPart }, query: { training: '1' } }"
        class="flex h-12 items-center justify-center bg-accent-400 text-base font-semibold text-ink-950 transition-colors hover:bg-accent-300 active:bg-accent-500"
      >
        {{ startLabel }}
      </RouterLink>
      <p v-else class="flex h-12 items-center justify-center gap-2 border border-accent-400 text-sm font-semibold text-ink-50">
        <svg viewBox="0 0 24 24" class="h-4 w-4 text-accent-400" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M5 12l5 5L20 7" />
        </svg>
        Done today — see you tomorrow
      </p>
    </section>

    <!-- Single exercises, for extra practice. They don't count toward the streak. -->
    <section class="shrink-0">
      <h2 class="text-xs font-semibold uppercase tracking-wider text-ink-400">Free practice</h2>
      <RouterLink
        v-for="item in FREE"
        :key="item.id"
        :to="{ name: 'practiceSession', params: { exercise: item.id } }"
        class="flex min-h-11 items-center justify-between gap-3 border-b border-ink-800 py-2 text-sm text-ink-200 transition-colors hover:text-ink-50"
      >
        {{ EXERCISE_TITLES[item.id] }}
        <span class="text-xs text-ink-400">{{ item.record() }}</span>
      </RouterLink>
    </section>
  </div>
</template>
