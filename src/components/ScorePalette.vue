<script setup lang="ts">
import { computed } from 'vue'
import { DURATION_TYPES, type Duration, type DurationType, type ScoreEvent } from '@/score/model'

/**
 * The editor's palette, after MuseScore's: durations, dot, rest and tie for
 * the selected event (and the next one typed), accidentals, delete, and undo
 * and redo. Symbols are SMuFL glyphs from the Bravura font the score is
 * engraved with.
 */
const props = defineProps<{
  mode: 'pitches' | 'rhythm'
  /** The selected event, if any. */
  selected: ScoreEvent | null
  /** Duration new notes get. */
  inputDuration: Duration
  canUndo: boolean
  canRedo: boolean
}>()

const emit = defineEmits<{
  duration: [type: DurationType]
  dot: []
  rest: []
  tie: []
  accidental: [alter: -1 | 0 | 1]
  remove: []
  undo: []
  redo: []
}>()

const GLYPH: Record<DurationType, string> = {
  whole: '',
  half: '',
  quarter: '',
  eighth: '',
  '16th': '',
  '32nd': '',
}

const LABEL: Record<DurationType, string> = {
  whole: 'Whole note',
  half: 'Half note',
  quarter: 'Quarter note',
  eighth: 'Eighth note',
  '16th': 'Sixteenth note',
  '32nd': 'Thirty-second note',
}

/** What the duration buttons show as active: the selection's, else the input's. */
const current = computed(() => props.selected?.duration ?? props.inputDuration)
const isNote = computed(() => props.selected?.kind === 'note')
const tied = computed(() => props.selected?.kind === 'note' && !!props.selected.tie)

const base =
  'flex h-10 min-w-10 items-center justify-center rounded-lg border px-2 text-sm font-semibold transition-colors disabled:opacity-35'
const off = 'border-ink-600 text-ink-200 hover:border-accent-400'
const on = 'border-accent-400 bg-accent-400 text-ink-950'
</script>

<template>
  <div class="space-y-2 rounded-xl border border-ink-700 bg-ink-900/95 p-2 shadow-lg shadow-ink-950/50 backdrop-blur">
    <div v-if="props.mode === 'rhythm'" class="flex flex-wrap gap-1.5" role="toolbar" aria-label="Duration">
      <button
        v-for="type in DURATION_TYPES"
        :key="type"
        type="button"
        :class="[base, current.type === type ? on : off]"
        :title="LABEL[type]"
        :aria-label="LABEL[type]"
        :aria-pressed="current.type === type"
        @click="emit('duration', type)"
      >
        <span class="smufl">{{ GLYPH[type] }}</span>
      </button>
      <button
        type="button"
        :class="[base, current.dots ? on : off]"
        title="Dot (press again for a double dot)"
        aria-label="Dot"
        :aria-pressed="current.dots > 0"
        :disabled="!props.selected"
        @click="emit('dot')"
      >
        <span class="smufl">{{ '' }}{{ ''.repeat(Math.max(1, current.dots)) }}</span>
      </button>
      <button
        type="button"
        :class="[base, props.selected?.kind === 'rest' ? on : off]"
        title="Rest — turn the selected note into a rest, or back"
        aria-label="Rest"
        :disabled="!props.selected"
        @click="emit('rest')"
      >
        <span class="smufl">{{ '' }}</span>
      </button>
      <button
        type="button"
        :class="[base, tied ? on : off]"
        title="Tie into the next note"
        aria-label="Tie"
        :aria-pressed="tied"
        :disabled="!isNote"
        @click="emit('tie')"
      >
        ⁀
      </button>
    </div>

    <div class="flex flex-wrap gap-1.5" role="toolbar" aria-label="Edit">
      <button type="button" :class="[base, off]" title="Flat" aria-label="Flat" :disabled="!isNote" @click="emit('accidental', -1)">
        <span class="smufl">{{ '' }}</span>
      </button>
      <button type="button" :class="[base, off]" title="Natural" aria-label="Natural" :disabled="!isNote" @click="emit('accidental', 0)">
        <span class="smufl">{{ '' }}</span>
      </button>
      <button type="button" :class="[base, off]" title="Sharp" aria-label="Sharp" :disabled="!isNote" @click="emit('accidental', 1)">
        <span class="smufl">{{ '' }}</span>
      </button>
      <button
        type="button"
        :class="[base, off]"
        title="Delete (Del)"
        aria-label="Delete"
        :disabled="!props.selected"
        @click="emit('remove')"
      >
        ✕
      </button>
      <span class="flex-1" />
      <button type="button" :class="[base, off]" title="Undo (Ctrl+Z)" aria-label="Undo" :disabled="!props.canUndo" @click="emit('undo')">
        ↶
      </button>
      <button type="button" :class="[base, off]" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" :disabled="!props.canRedo" @click="emit('redo')">
        ↷
      </button>
    </div>
  </div>
</template>

<style scoped>
/* SMuFL glyphs sit on the baseline at a size relative to the staff; this
   centres them in a button. */
.smufl {
  font-family: Bravura, serif;
  font-size: 22px;
  line-height: 1;
  transform: translateY(0.18em);
}
</style>
