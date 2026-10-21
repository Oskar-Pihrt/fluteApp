<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import BottomSheet from '@/components/BottomSheet.vue'
import StaffPosition from '@/components/StaffPosition.vue'
import {
  answerMidis,
  generateQuestion,
  INTERVAL_NAMES,
  isCorrect,
  itemsAt,
  levelsFor,
  MODES,
  UNLOCK_CORRECT,
  UNLOCK_WINDOW,
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
 *
 * One question fills the screen: a big play square in the middle, the answers
 * under the thumb. On a phone it is exactly one screen and never scrolls — the
 * square and the staff drawings shrink to the room left, and the controls
 * tighten on short screens. Exercise, level and statistics live in a panel behind the
 * button at the top.
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

/** The last answers at this level as a strip of bars, padded to the unlock window. */
const recentBars = computed(() => {
  const recent = progress.value.recent.slice(-UNLOCK_WINDOW)
  return [...recent, ...Array<null>(UNLOCK_WINDOW - recent.length).fill(null)]
})
const canUnlock = computed(() => progress.value.level === progress.value.unlocked && progress.value.unlocked < levelCount.value)

const panelOpen = ref(false)

/** Share of right answers per item, for the bars in the panel. */
function share(item: number): number | null {
  const stats = progress.value.stats[item]
  return stats && stats.attempts ? stats.correct / stats.attempts : null
}

function answerClass(item: number): string {
  if (answered.value && question.value?.answer === item) return 'border-accent-400 bg-accent-400 text-ink-950'
  if (answered.value && chosen.value === item) return 'border-[#f0b44c] text-[#f0b44c]'
  if (!items.value.includes(item)) return 'border-ink-800 text-ink-400 opacity-35'
  return answered.value ? 'border-ink-800 bg-ink-900 text-ink-400' : 'border-ink-700 bg-ink-900 text-ink-50 enabled:active:bg-ink-800'
}
</script>

<template>
  <div class="flex min-h-0 flex-1 flex-col gap-3 pb-3 md:gap-4 md:pb-0">
    <header class="flex shrink-0 items-center justify-between gap-3">
      <button
        type="button"
        class="flex h-11 items-center gap-2 border border-ink-700 px-3 text-sm font-semibold text-ink-50 transition-colors hover:border-ink-400"
        aria-haspopup="dialog"
        @click="panelOpen = true"
      >
        {{ MODE_LABELS[mode].title }} · Level {{ progress.level }}
        <svg viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      <p class="text-sm text-ink-400">
        <span class="font-semibold text-ink-50">{{ trainer.sessionCorrect }}/{{ trainer.sessionAttempts }}</span>
        · streak {{ trainer.streak }}
      </p>
    </header>

    <div v-if="canUnlock" class="shrink-0 space-y-1.5">
      <div
        class="flex gap-[3px]"
        role="img"
        :aria-label="`${recentCorrect} of the last ${progress.recent.length} right`"
      >
        <span
          v-for="(bar, i) in recentBars"
          :key="i"
          class="h-1.5 flex-1"
          :class="bar === null ? 'bg-ink-800' : bar ? 'bg-accent-400' : 'bg-ink-600'"
        />
      </div>
      <p class="text-xs text-ink-400 short:sr-only">
        Level {{ progress.level + 1 }} after {{ UNLOCK_CORRECT }} of the last {{ UNLOCK_WINDOW }} right
      </p>
    </div>

    <p v-if="loadError" class="shrink-0 border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-200">
      {{ loadError }}
    </p>

    <!-- The question, or what it was. -->
    <section class="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 max-md:[container-type:size] md:py-2">
      <template v-if="!question || !answered">
        <button
          type="button"
          class="flex size-[clamp(4rem,calc(100cqh-5rem),9rem)] shrink-0 items-center justify-center bg-accent-400 text-ink-950 transition-colors hover:bg-accent-300 active:bg-accent-500 disabled:opacity-50"
          :disabled="!loaded"
          :aria-label="question ? 'Play it again' : 'Start'"
          @click="question ? replay() : next()"
        >
          <svg v-if="question" viewBox="0 0 24 24" class="size-[40%]" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
            <path d="M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M19 6a8 8 0 0 1 0 12" />
          </svg>
          <svg v-else viewBox="0 0 24 24" class="size-[40%]" fill="currentColor" aria-hidden="true">
            <path d="M7 4l13 8-13 8z" />
          </svg>
        </button>
        <p class="text-center text-sm text-ink-200">
          <template v-if="!loaded && !loadError">Loading piano…</template>
          <template v-else-if="!question">{{ MODE_LABELS[mode].hint }}</template>
          <template v-else-if="question.mode === 'reference' && question.root != null">
            Reference <span class="font-semibold text-ink-50">{{ midiLabel(question.root) }}</span>, then the note to name
          </template>
          <template v-else-if="question.mode === 'interval'">How far apart?</template>
          <template v-else>Which note was that?</template>
        </p>
        <p v-if="question" class="text-xs text-ink-400">Tap the square to hear it again</p>
      </template>

      <div
        v-else
        role="status"
        class="flex min-h-0 w-full flex-1 flex-col gap-2.5 border bg-ink-900 p-3 md:flex-none md:gap-3 md:p-4"
        :class="correct ? 'border-accent-400' : 'border-[#f0b44c]'"
      >
        <p class="flex shrink-0 items-center gap-2 text-lg font-semibold" :class="correct ? 'text-accent-400' : 'text-[#f0b44c]'">
          <svg viewBox="0 0 24 24" class="h-5 w-5" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true">
            <path v-if="correct" d="M5 12l5 5L20 7" />
            <path v-else d="M6 6l12 12M18 6L6 18" />
          </svg>
          {{ correct ? 'Right' : 'Not quite' }} — {{ answerText }}
        </p>
        <!-- The staves take the room left over and shrink with it. -->
        <div class="flex min-h-0 flex-1 justify-center gap-6 md:justify-start">
          <figure v-for="(midi, i) in question.midis" :key="i" class="flex min-h-0 flex-col items-center gap-1">
            <StaffPosition
              :note="canonicalNote(midi)"
              :clef="clefFor(midi)"
              class="min-h-0 w-auto flex-1 max-md:max-h-[171px] md:flex-none"
            />
            <figcaption class="shrink-0 text-xs text-ink-200">
              {{ midiLabel(midi) }}
              <span v-if="question.midis.length > 1" class="text-ink-400">
                {{ question.mode === 'reference' ? (i === 0 ? '(reference)' : '(target)') : `(${i + 1})` }}
              </span>
            </figcaption>
          </figure>
        </div>
        <p v-if="unlockMessage" class="shrink-0 bg-accent-400/15 px-3 py-2 text-sm text-accent-300">{{ unlockMessage }}</p>
        <div class="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            class="h-10 flex-1 border border-ink-700 px-2 text-[13px] whitespace-nowrap text-ink-200 md:h-11 md:px-3 md:text-sm transition-colors hover:border-accent-400"
            @click="replay"
          >
            Hear it again
          </button>
          <button
            v-if="!correct && chosen != null"
            type="button"
            class="h-10 flex-1 border border-ink-700 px-2 text-[13px] whitespace-nowrap text-ink-200 md:h-11 md:px-3 md:text-sm transition-colors hover:border-accent-400"
            @click="playMyAnswer"
          >
            Hear my answer
          </button>
          <RouterLink
            v-for="link in fingeringLinks"
            :key="link.midi"
            :to="{ name: 'note', params: { note: link.note } }"
            class="flex h-10 flex-1 items-center justify-center border border-ink-700 px-2 text-[13px] whitespace-nowrap md:px-3 md:text-sm md:h-11 text-ink-200 transition-colors hover:border-accent-400"
          >
            {{ link.label }} on {{ settings.instrument.shortName }}
          </RouterLink>
        </div>
      </div>
    </section>

    <section aria-label="Answers" class="grid shrink-0 grid-cols-4 gap-1.5">
      <button
        v-for="item in gridItems"
        :key="item"
        type="button"
        class="flex h-[clamp(2.5rem,7svh,3.5rem)] flex-col items-center justify-center border px-1 text-center transition-colors disabled:cursor-default"
        :class="answerClass(item)"
        :disabled="!question || answered || !items.includes(item)"
        @click="answer(item)"
      >
        <span class="text-[15px] font-semibold">{{ itemLabel(item) }}</span>
        <span v-if="mode === 'interval'" class="text-[10px] leading-tight opacity-75">{{ INTERVAL_NAMES[item].long }}</span>
      </button>
    </section>

    <button
      v-if="answered"
      type="button"
      class="h-[clamp(2.75rem,7svh,3.5rem)] w-full shrink-0 bg-accent-400 text-base font-semibold text-ink-950 transition-colors hover:bg-accent-300"
      @click="next"
    >
      Next
    </button>

    <BottomSheet :open="panelOpen" label="Exercise" @close="panelOpen = false">
      <div class="space-y-5 px-4">
        <div class="grid grid-cols-3 border border-ink-700" role="tablist" aria-label="Exercise">
          <button
            v-for="m in MODES"
            :key="m"
            type="button"
            role="tab"
            :aria-selected="mode === m"
            class="h-11 text-sm font-semibold transition-colors not-first:border-l not-first:border-ink-700"
            :class="mode === m ? 'bg-ink-800 text-ink-50' : 'text-ink-400 hover:text-ink-200'"
            @click="setMode(m)"
          >
            {{ MODE_LABELS[m].title }}
          </button>
        </div>
        <p class="-mt-2 text-xs text-ink-400">{{ MODE_LABELS[mode].hint }}</p>

        <section class="space-y-2">
          <h2 class="text-[11px] font-semibold tracking-wider text-ink-400 uppercase">Level</h2>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="level in levelCount"
              :key="level"
              type="button"
              class="h-11 min-w-11 border px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35"
              :class="progress.level === level ? 'border-accent-400 bg-accent-400 text-ink-950' : 'border-ink-700 text-ink-200 hover:border-ink-400'"
              :disabled="level > progress.unlocked"
              :aria-label="level > progress.unlocked ? `Level ${level}, locked` : `Level ${level}`"
              :aria-pressed="progress.level === level"
              @click="setLevel(level); panelOpen = false"
            >
              {{ level }}
            </button>
          </div>
          <p class="text-xs text-ink-400">{{ items.map(itemLabel).join(' · ') }}</p>
        </section>

        <section class="space-y-1">
          <h2 class="text-[11px] font-semibold tracking-wider text-ink-400 uppercase">
            Right answers · best streak {{ trainer.bestStreak }}
          </h2>
          <ul>
            <li v-for="item in gridItems" :key="item" class="flex h-9 items-center gap-3 border-b border-ink-800">
              <span class="w-12 shrink-0 text-sm font-semibold text-ink-50">{{ itemLabel(item) }}</span>
              <span class="h-2 flex-1 bg-ink-800" aria-hidden="true">
                <span
                  class="block h-full"
                  :class="(share(item) ?? 0) >= 0.75 ? 'bg-accent-400' : 'bg-[#f0b44c]'"
                  :style="{ width: `${(share(item) ?? 0) * 100}%` }"
                />
              </span>
              <span class="w-24 shrink-0 text-right text-xs text-ink-200 tabular-nums">{{ accuracy(item) }}</span>
            </li>
          </ul>
        </section>

        <button
          type="button"
          class="h-11 w-full border border-ink-700 text-xs text-ink-400 transition-colors hover:border-red-400 hover:text-red-300"
          @click="resetStats"
        >
          Reset {{ MODE_LABELS[mode].title.toLowerCase() }} progress
        </button>
      </div>
    </BottomSheet>
  </div>
</template>
