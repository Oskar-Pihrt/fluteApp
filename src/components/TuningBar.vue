<script setup lang="ts">
import { computed } from 'vue'
import { IN_TUNE_CENTS, TUNING_RANGE_CENTS } from '@/domain/practice'

/**
 * How far the held note is from true, as a marker on a flat-to-sharp bar with
 * the in-tune band shaded. ±TUNING_RANGE_CENTS spans the bar.
 */
const props = defineProps<{ cents: number | null }>()

const R = TUNING_RANGE_CENTS
const position = (cents: number) => `${50 + (Math.max(-R, Math.min(R, cents)) / R) * 50}%`
const inTune = computed(() => props.cents != null && Math.abs(props.cents) <= IN_TUNE_CENTS)
const label = computed(() => {
  if (props.cents == null) return '—'
  return `${props.cents > 0 ? '+' : props.cents < 0 ? '−' : '±'}${Math.abs(props.cents)} ¢`
})
</script>

<template>
  <div class="space-y-1.5" role="meter" :aria-valuemin="-R" :aria-valuemax="R" :aria-valuenow="cents ?? undefined" :aria-label="`Tuning ${label}`">
    <div class="flex justify-between text-xs text-ink-400">
      <span>flat</span>
      <span class="font-semibold" :class="inTune ? 'text-accent-300' : cents == null ? 'text-ink-400' : 'text-amber-300'">{{ label }}</span>
      <span>sharp</span>
    </div>
    <div class="relative h-4 bg-ink-800">
      <div class="absolute inset-y-0 bg-accent-400/35" :style="{ left: position(-IN_TUNE_CENTS), right: position(-IN_TUNE_CENTS) }" />
      <div class="absolute -inset-y-1 left-1/2 w-0.5 -translate-x-1/2 bg-ink-50" />
      <div
        v-if="cents != null"
        class="absolute -inset-y-1.5 w-1.5 -translate-x-1/2 transition-[left] duration-75"
        :class="inTune ? 'bg-accent-400' : 'bg-amber-400'"
        :style="{ left: position(cents) }"
      />
    </div>
  </div>
</template>
