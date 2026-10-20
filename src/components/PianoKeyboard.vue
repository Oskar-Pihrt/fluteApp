<script setup lang="ts">
import { computed, ref } from 'vue'
import { Note } from 'tonal'
import { type InstrumentContext, noteRange } from '@/domain/lookup'

/**
 * Note entry as a piano keyboard: one octave, C to C, moved up and down with
 * the arrows. Keys outside the instrument's range are greyed out. The octave
 * is sticky, so a run of notes is a run of taps.
 */
const props = defineProps<{
  context: InstrumentContext
  /** Spell the black keys as flats (a flat key signature is in force). */
  flats?: boolean
  /** What a tap does, shown beside the octave. */
  hint?: string
}>()

const emit = defineEmits<{ add: [note: string] }>()

const range = computed(() => noteRange(props.context))
const playable = computed(() => new Set(range.value.map((entry) => entry.midi)))
const octaves = computed(() => [...new Set(range.value.map((entry) => Note.get(entry.note).oct ?? 0))])

const picked = ref<number | null>(null)
const octave = computed(() => {
  if (picked.value != null && octaves.value.includes(picked.value)) return picked.value
  const preferred = props.context.instrument.defaultPickerOctave
  return octaves.value.includes(preferred) ? preferred : octaves.value[0]
})

function shift(delta: number) {
  const next = octave.value + delta
  if (octaves.value.includes(next)) picked.value = next
}

const WHITES = ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C']
/** Black keys: the white key they follow, and both spellings. */
const BLACKS = [
  { after: 0, sharp: 'C#', flat: 'Db' },
  { after: 1, sharp: 'D#', flat: 'Eb' },
  { after: 3, sharp: 'F#', flat: 'Gb' },
  { after: 4, sharp: 'G#', flat: 'Ab' },
  { after: 5, sharp: 'A#', flat: 'Bb' },
]

function key(name: string, oct: number) {
  const note = `${name}${oct}`
  return { note, enabled: playable.value.has(Note.midi(note) ?? -1) }
}

const whites = computed(() =>
  WHITES.map((name, i) => ({ ...key(name, octave.value + (i === 7 ? 1 : 0)), label: name })),
)
const blacks = computed(() =>
  BLACKS.map((black) => {
    const name = props.flats ? black.flat : black.sharp
    return {
      ...key(name, octave.value),
      label: name.replace('#', '♯').replace('b', '♭'),
      // Centred on the line between two white keys, as a share of the width.
      left: `${((black.after + 1) / 8) * 100}%`,
    }
  }),
)
</script>

<template>
  <div class="space-y-2.5">
    <div class="flex items-center gap-2">
      <button
        type="button"
        class="h-10 w-11 border border-ink-600 text-base text-ink-50 disabled:opacity-30"
        aria-label="Octave down"
        :disabled="!octaves.includes(octave - 1)"
        @click="shift(-1)"
      >
        ‹
      </button>
      <p class="flex-1 text-center text-sm text-ink-50">
        C{{ octave }} – C{{ octave + 1 }}
        <span v-if="hint" class="text-ink-400">· {{ hint }}</span>
      </p>
      <button
        type="button"
        class="h-10 w-11 border border-ink-600 text-base text-ink-50 disabled:opacity-30"
        aria-label="Octave up"
        :disabled="!octaves.includes(octave + 1)"
        @click="shift(1)"
      >
        ›
      </button>
    </div>

    <div class="relative h-40 select-none" role="group" aria-label="Keyboard">
      <div class="grid h-full grid-cols-8 gap-[3px]">
        <button
          v-for="white in whites"
          :key="white.note"
          type="button"
          class="flex items-end justify-center bg-ink-50 pb-2 text-sm font-bold text-ink-950 transition-colors active:bg-accent-300 disabled:opacity-25"
          :aria-label="white.note"
          :disabled="!white.enabled"
          @click="emit('add', white.note)"
        >
          {{ white.label }}
        </button>
      </div>
      <button
        v-for="black in blacks"
        :key="black.note"
        type="button"
        class="absolute top-0 flex h-[58%] w-[9%] -translate-x-1/2 items-end justify-center border border-ink-600 bg-ink-950 pb-1.5 text-[10px] text-ink-400 transition-colors active:bg-accent-500 disabled:opacity-40"
        :style="{ left: black.left }"
        :aria-label="black.note"
        :disabled="!black.enabled"
        @click="emit('add', black.note)"
      >
        {{ black.label }}
      </button>
    </div>
  </div>
</template>
