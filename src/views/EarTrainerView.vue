<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import StaffPosition from '@/components/StaffPosition.vue'
import {
  answerMidis,
  generateQuestion,
  INTERVAL_NAMES,
  isCorrect,
  itemsAt,
  levelsFor,
  MODES,
  type Mode,
  type Question,
} from '@/domain/earTraining'
import { canonicalNote, noteLabel, noteRange } from '@/domain/lookup'
import { loadPiano, pianoLoaded, playPianoSequence, stopAllPiano } from '@/domain/piano'
import type { Clef } from '@/domain/staff'
import { useEarTrainerStore } from '@/stores/earTrainer'
import { useSettingsStore } from '@/stores/settings'

/**
 * Ear trainer: hear a piano note or interval, say what it was. Independent of
 * the selected instrument — everything here is concert pitch — except for the
 * fingering links shown after an answer.
 */

const trainer = useEarTrainerStore()
const settings = useSettingsStore()

const MODE_LABELS: Record<Mode, { title: string; hint: string }> = {
  note: { title: 'Note', hint: 'Name the note you hear.' },
  interval: { title: 'Interval', hint: 'Two notes, one after the other. How far apart?' },
  reference: { title: 'Reference', hint: 'A named note plays first, then the note to identify.' },
}

const PITCH_CLASS_LABELS = [
  'C', 'C♯/D♭', 'D', 'D♯/E♭', 'E', 'F', 'F♯/G♭', 'G', 'G♯/A♭', 'A', 'A♯/B♭', 'B',
]

const loaded = ref(pianoLoaded())
const loadError = ref<string | null>(null)
const question = ref<Question | null>(null)
const chosen = ref<number | null>(null)
const unlockMessage = ref<string | null>(null)

onMounted(() => {
  if (loaded.value) return
  loadPiano().then(
    () => (loaded.value = true),
    () => (loadError.value = 'Could not load the piano sounds. Check your connection and reopen this page.'),
  )
})

onBeforeUnmount(stopAllPiano)

const mode = computed(() => trainer.mode)
const progress = computed(() => trainer.current)
const levelCount = computed(() => levelsFor(mode.value).length)
const items = computed(() => itemsAt(mode.value, progress.value.level))
const answered = computed(() => chosen.value != null)
const correct = computed(() => question.value != null && chosen.value != null && isCorrect(question.value, chosen.value))

/** Everything answerable in this mode, for the button grid and the stats table. */
const gridItems = computed(() =>
  mode.value === 'interval' ? itemsAt('interval', levelCount.value) : itemsAt('note', levelCount.value),
)

function itemLabel(item: number): string {
  return mode.value === 'interval' ? INTERVAL_NAMES[item].short : PITCH_CLASS_LABELS[item]
}

function midiLabel(midi: number): string {
  return noteLabel(canonicalNote(midi))
}

/** "Perfect 5th up", "E", … — the right answer, in words. */
const answerText = computed(() => {
  const q = question.value
  if (!q) return ''
  if (q.mode !== 'interval') return PITCH_CLASS_LABELS[q.answer]
  return `${INTERVAL_NAMES[q.answer].long} ${q.direction === 'down' ? 'down' : 'up'}`
})

function clefFor(midi: number): Clef {
  return midi < 60 ? 'bass' : 'treble'
}

/** Written pitch for the active instrument, when it can play that note. */
const fingeringLinks = computed(() => {
  const q = question.value
  if (!q || !answered.value) return []
  const playable = new Set(noteRange(settings.context).map((entry) => entry.midi))
  const seen = new Set<number>()
  const links: { midi: number; note: string; label: string }[] = []
  for (const midi of q.midis) {
    const written = midi - settings.instrument.transposeSemitones
    if (!playable.has(written) || seen.has(written)) continue
    seen.add(written)
    links.push({ midi, note: canonicalNote(written), label: noteLabel(canonicalNote(written)) })
  }
  return links
})

function play(midis: readonly number[]) {
  stopAllPiano()
  playPianoSequence(midis, 0.95)
}

function next() {
  unlockMessage.value = null
  chosen.value = null
  question.value = generateQuestion(mode.value, progress.value.level, progress.value.stats)
  play(question.value.midis)
}

function replay() {
  if (question.value) play(question.value.midis)
}

function answer(item: number) {
  const q = question.value
  if (!q || answered.value) return
  chosen.value = item
  const unlocked = trainer.record(q, isCorrect(q, item))
  if (unlocked != null) unlockMessage.value = `Level ${unlocked} unlocked — new ${mode.value === 'interval' ? 'intervals' : 'notes'} added.`
}

function playMyAnswer() {
  if (question.value && chosen.value != null) play(answerMidis(question.value, chosen.value))
}

function reset() {
  stopAllPiano()
  question.value = null
  chosen.value = null
  unlockMessage.value = null
}

function setMode(value: Mode) {
  if (value === trainer.mode) return
  reset()
  trainer.mode = value
}

function setLevel(level: number) {
  reset()
  trainer.setLevel(level)
}

function resetStats() {
  if (!window.confirm(`Reset ${MODE_LABELS[mode.value].title.toLowerCase()} progress and statistics?`)) return
  reset()
  trainer.resetStats(mode.value)
}

function accuracy(item: number): string {
  const stats = progress.value.stats[item]
  if (!stats || stats.attempts === 0) return '—'
  return `${Math.round((stats.correct / stats.attempts) * 100)}% (${stats.correct}/${stats.attempts})`
}

const recentCorrect = computed(() => progress.value.recent.filter(Boolean).length)
</script>

<template>
  <div class="space-y-6">
    <header>
      <h1 class="text-xl">Ear trainer</h1>
      <p class="mt-1 text-sm text-ink-400">{{ MODE_LABELS[mode].hint }}</p>
    </header>

    <div class="grid grid-cols-3 gap-1 rounded-xl border border-ink-700 p-1" role="tablist" aria-label="Exercise">
      <button
        v-for="m in MODES"
        :key="m"
        type="button"
        role="tab"
        :aria-selected="mode === m"
        class="rounded-lg px-2 py-2 text-sm font-medium transition-colors"
        :class="mode === m ? 'bg-ink-700 text-accent-400' : 'text-ink-400 hover:text-ink-200'"
        @click="setMode(m)"
      >
        {{ MODE_LABELS[m].title }}
      </button>
    </div>

    <section class="space-y-2">
      <h2 class="text-xs font-semibold uppercase tracking-wider text-ink-400">Level</h2>
      <div class="flex flex-wrap gap-2">
        <button
          v-for="level in levelCount"
          :key="level"
          type="button"
          class="h-9 min-w-9 rounded-lg border px-3 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
          :class="
            progress.level === level
              ? 'border-accent-400 bg-ink-800 text-accent-400'
              : 'border-ink-700 text-ink-200 hover:border-ink-400'
          "
          :disabled="level > progress.unlocked"
          :aria-label="level > progress.unlocked ? `Level ${level}, locked` : `Level ${level}`"
          :aria-pressed="progress.level === level"
          @click="setLevel(level)"
        >
          {{ level }}
        </button>
      </div>
      <p class="text-xs text-ink-400">
        {{ items.map(itemLabel).join(' · ') }}
      </p>
      <p v-if="progress.level === progress.unlocked && progress.unlocked < levelCount" class="text-xs text-ink-400">
        Next level after 16 of the last 20 right ({{ recentCorrect }}/{{ progress.recent.length }} so far).
      </p>
    </section>

    <p v-if="loadError" class="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
      {{ loadError }}
    </p>

    <section class="space-y-3">
      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 rounded-xl bg-accent-500 px-4 py-3.5 text-base font-semibold text-ink-950 transition-colors hover:bg-accent-400 disabled:opacity-50"
          :disabled="!loaded || (question != null && !answered)"
          @click="next"
        >
          {{ !loaded && !loadError ? 'Loading piano…' : question ? 'Next' : 'Play' }}
        </button>
        <button
          type="button"
          class="rounded-xl border border-ink-600 px-5 py-3.5 text-sm font-medium text-ink-200 transition-colors hover:border-accent-400 disabled:opacity-40"
          :disabled="!question"
          @click="replay"
        >
          Replay
        </button>
      </div>

      <p v-if="question?.mode === 'reference' && question.root != null" class="text-sm text-ink-200">
        Reference:
        <span class="font-semibold text-ink-50">{{ midiLabel(question.root) }}</span>
        <span class="text-ink-400"> — then the note to name.</span>
      </p>
    </section>

    <section class="space-y-2" aria-label="Answers">
      <div class="grid gap-2" :class="mode === 'interval' ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-4'">
        <button
          v-for="item in gridItems"
          :key="item"
          type="button"
          class="rounded-xl border px-2 py-3 text-center transition-colors disabled:cursor-not-allowed"
          :class="[
            answered && question?.answer === item
              ? 'border-emerald-400 bg-emerald-400/15 text-ink-50'
              : answered && chosen === item
                ? 'border-red-400 bg-red-400/15 text-ink-50'
                : 'border-ink-700 text-ink-200 enabled:hover:border-ink-400',
            !items.includes(item) ? 'opacity-30' : '',
          ]"
          :disabled="!question || answered || !items.includes(item)"
          @click="answer(item)"
        >
          <span class="block text-sm font-semibold">{{ itemLabel(item) }}</span>
          <span v-if="mode === 'interval'" class="mt-0.5 block text-[11px] leading-tight text-ink-400">
            {{ INTERVAL_NAMES[item].long }}
          </span>
        </button>
      </div>
    </section>

    <section v-if="question && answered" class="space-y-4 rounded-xl border border-ink-700 bg-ink-900 p-4">
      <p class="text-sm font-semibold" :class="correct ? 'text-emerald-300' : 'text-red-300'">
        {{ correct ? 'Correct' : 'Not quite' }}
        <span class="font-normal text-ink-200"> — it was {{ answerText }}.</span>
      </p>

      <div class="flex flex-wrap gap-6">
        <figure v-for="(midi, i) in question.midis" :key="i" class="flex flex-col items-center gap-1.5">
          <StaffPosition :note="canonicalNote(midi)" :clef="clefFor(midi)" />
          <figcaption class="text-xs text-ink-200">
            {{ midiLabel(midi) }}
            <span v-if="question.midis.length > 1" class="text-ink-400">
              {{ question.mode === 'reference' ? (i === 0 ? '(reference)' : '(target)') : `(${i + 1})` }}
            </span>
          </figcaption>
        </figure>
      </div>

      <p v-if="unlockMessage" class="rounded-lg bg-accent-400/15 px-3 py-2 text-sm text-accent-300">
        {{ unlockMessage }}
      </p>

      <div class="flex flex-wrap gap-2">
        <button
          v-if="!correct && chosen != null"
          type="button"
          class="rounded-lg border border-ink-600 px-3 py-2 text-sm text-ink-200 transition-colors hover:border-accent-400"
          @click="playMyAnswer"
        >
          Play my answer
        </button>
        <RouterLink
          v-for="link in fingeringLinks"
          :key="link.midi"
          :to="{ name: 'note', params: { note: link.note } }"
          class="rounded-lg border border-ink-600 px-3 py-2 text-sm text-ink-200 transition-colors hover:border-accent-400"
        >
          {{ link.label }} on {{ settings.instrument.name }}
        </RouterLink>
      </div>
    </section>

    <section class="flex items-center justify-between rounded-xl border border-ink-800 px-4 py-3 text-sm">
      <span class="text-ink-200">
        Session
        <span class="font-semibold text-ink-50">{{ trainer.sessionCorrect }}/{{ trainer.sessionAttempts }}</span>
      </span>
      <span class="text-ink-200">
        Streak <span class="font-semibold text-ink-50">{{ trainer.streak }}</span>
        <span class="text-ink-400"> (best {{ trainer.bestStreak }})</span>
      </span>
    </section>

    <details class="rounded-xl border border-ink-800 px-4 py-3">
      <summary class="cursor-pointer text-sm font-medium text-ink-200">Statistics</summary>
      <table class="mt-3 w-full text-sm">
        <tbody>
          <tr v-for="item in gridItems" :key="item" class="border-t border-ink-800">
            <td class="py-1.5 pr-3 text-ink-200">
              {{ itemLabel(item) }}
              <span v-if="mode === 'interval'" class="text-xs text-ink-400">{{ INTERVAL_NAMES[item].long }}</span>
            </td>
            <td class="py-1.5 text-right tabular-nums text-ink-400">{{ accuracy(item) }}</td>
          </tr>
        </tbody>
      </table>
      <button
        type="button"
        class="mt-3 rounded-lg border border-ink-700 px-3 py-2 text-xs text-ink-400 transition-colors hover:border-red-400 hover:text-red-300"
        @click="resetStats"
      >
        Reset {{ MODE_LABELS[mode].title.toLowerCase() }} progress
      </button>
    </details>
  </div>
</template>
