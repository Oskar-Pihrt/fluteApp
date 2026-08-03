<script setup lang="ts">
import { computed, ref } from 'vue'
import { Note } from 'tonal'
import { noteLabel, noteRange } from '@/domain/lookup'
import { useSettingsStore } from '@/stores/settings'

/**
 * Fast note entry for transcribing a piece.
 *
 * The bottleneck when noting down sheet music is entering many notes in a row,
 * so the octave is sticky: you pick an octave once and then tap pitch names
 * repeatedly. Only octaves that exist in the flute's range are offered.
 */

const emit = defineEmits<{ add: [note: string] }>()

const settings = useSettingsStore()

const range = computed(() => noteRange(settings.fluteConfig))

const octaves = computed(() => [
  ...new Set(range.value.map((entry) => Note.get(entry.note).oct ?? 0)),
])

const octave = ref<number | null>(null)
const activeOctave = computed(() => octave.value ?? (octaves.value.includes(5) ? 5 : octaves.value[0]))

const PITCH_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const

const playable = computed(() => new Set(range.value.map((entry) => entry.note)))

const buttons = computed(() =>
  PITCH_CLASSES.map((pc) => {
    const note = `${pc}${activeOctave.value}`
    return {
      note,
      label: noteLabel(pc),
      accidental: pc.includes('#'),
      enabled: playable.value.has(note),
    }
  }),
)
</script>

<template>
  <div class="space-y-3 rounded-xl border border-ink-700 bg-ink-900 p-3">
    <div class="flex items-center gap-2">
      <span class="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Octave</span>
      <div class="flex gap-1.5">
        <button
          v-for="oct in octaves"
          :key="oct"
          type="button"
          class="h-8 w-8 rounded-lg border text-sm font-semibold transition-colors"
          :class="
            oct === activeOctave
              ? 'border-brass-400 bg-brass-400 text-ink-950'
              : 'border-ink-600 text-ink-200 hover:border-ink-400'
          "
          @click="octave = oct"
        >
          {{ oct }}
        </button>
      </div>
    </div>

    <div class="grid grid-cols-6 gap-1.5">
      <button
        v-for="button in buttons"
        :key="button.note"
        type="button"
        class="rounded-lg border py-2.5 text-sm font-semibold transition-colors disabled:opacity-25"
        :class="
          button.accidental
            ? 'border-ink-700 bg-ink-950 text-ink-200 enabled:hover:border-brass-400'
            : 'border-ink-600 bg-ink-800 text-ink-50 enabled:hover:border-brass-400'
        "
        :disabled="!button.enabled"
        @click="emit('add', button.note)"
      >
        {{ button.label }}
      </button>
    </div>
  </div>
</template>
