<script setup lang="ts">
import { computed } from 'vue'
import type { Duration, DurationType, ScoreEvent } from '@/score/model'

/**
 * The rhythm row above the keyboard, after MuseScore's palette: durations,
 * dot, rest and tie for the selected event and the next one typed. Symbols
 * are SMuFL glyphs from the Bravura font the score is engraved with.
 * Thirty-seconds are left to the keyboard shortcut (2) to keep the row
 * thumb-sized.
 */
const props = defineProps<{
  /** The selected event, if any. */
  selected: ScoreEvent | null
  /** Duration new notes get. */
  inputDuration: Duration
}>()

const emit = defineEmits<{
  duration: [type: DurationType]
  dot: []
  rest: []
  tie: []
}>()

const DURATIONS: { type: DurationType; glyph: string; label: string }[] = [
  { type: 'whole', glyph: '\uE1D2', label: 'Whole note' },
  { type: 'half', glyph: '\uE1D3', label: 'Half note' },
  { type: 'quarter', glyph: '\uE1D5', label: 'Quarter note' },
  { type: 'eighth', glyph: '\uE1D7', label: 'Eighth note' },
  { type: '16th', glyph: '\uE1D9', label: 'Sixteenth note' },
]

const DOT_NOTE = '\uE1D5'
const DOT = '\uE1E7'
const REST = '\uE4E5'

/** What the duration buttons show as active: the selection's, else the input's. */
const current = computed(() => props.selected?.duration ?? props.inputDuration)
const tied = computed(() => props.selected?.kind === 'note' && !!props.selected.tie)

const base = 'flex h-12 items-center justify-center border transition-colors disabled:opacity-35'
const off = 'border-ink-600 text-ink-50 enabled:hover:border-accent-400'
const on = 'border-accent-400 bg-accent-400 text-ink-950'
</script>

<template>
  <div class="grid grid-cols-8 gap-1" role="toolbar" aria-label="Duration">
    <button
      v-for="d in DURATIONS"
      :key="d.type"
      type="button"
      :class="[base, current.type === d.type ? on : off]"
      :title="d.label"
      :aria-label="d.label"
      :aria-pressed="current.type === d.type"
      @click="emit('duration', d.type)"
    >
      <span class="smufl">{{ d.glyph }}</span>
    </button>
    <button
      type="button"
      :class="[base, current.dots ? on : off]"
      title="Dot (again for a double dot)"
      aria-label="Dot"
      :aria-pressed="current.dots > 0"
      :disabled="!props.selected"
      @click="emit('dot')"
    >
      <span class="smufl">{{ DOT_NOTE }}{{ DOT.repeat(Math.max(1, current.dots)) }}</span>
    </button>
    <button
      type="button"
      :class="[base, props.selected?.kind === 'rest' ? on : off]"
      title="Rest — turn the selected note into a rest, or back"
      aria-label="Rest"
      :aria-pressed="props.selected?.kind === 'rest'"
      :disabled="!props.selected"
      @click="emit('rest')"
    >
      <span class="smufl">{{ REST }}</span>
    </button>
    <button
      type="button"
      :class="[base, tied ? on : off]"
      title="Tie into the next note"
      aria-label="Tie"
      :aria-pressed="tied"
      :disabled="props.selected?.kind !== 'note'"
      @click="emit('tie')"
    >
      ⁀
    </button>
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
