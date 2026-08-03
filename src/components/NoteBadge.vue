<script setup lang="ts">
import { computed } from 'vue'
import { Note } from 'tonal'
import { noteLabel } from '@/domain/lookup'

/** A note name with its octave set apart, so "F♯5" reads at a glance. */
const props = withDefaults(
  defineProps<{ note: string; size?: 'sm' | 'md' | 'lg' }>(),
  { size: 'md' },
)

const parts = computed(() => {
  const parsed = Note.get(props.note)
  const pitch = parsed.empty ? props.note : noteLabel(parsed.pc)
  return { pitch, octave: parsed.oct ?? null }
})

const SIZES = {
  sm: 'text-base',
  md: 'text-2xl',
  lg: 'text-5xl',
} as const

const OCTAVE_SIZES = {
  sm: 'text-[0.7em]',
  md: 'text-[0.6em]',
  lg: 'text-[0.5em]',
} as const
</script>

<template>
  <span class="font-semibold tracking-tight text-ink-50" :class="SIZES[size]">
    {{ parts.pitch }}<span
      v-if="parts.octave !== null"
      class="ml-0.5 align-baseline text-ink-400"
      :class="OCTAVE_SIZES[size]"
      >{{ parts.octave }}</span
    >
  </span>
</template>
