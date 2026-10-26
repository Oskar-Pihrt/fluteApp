<script setup lang="ts">
import { computed } from 'vue'
import { IN_TUNE_CENTS } from '@/domain/practice'

/**
 * The held note's tuning over the last few seconds: a line of cents against
 * time, with the in-tune band shaded. Gaps (silence, a different note) break
 * the line rather than dropping it to zero.
 */
const props = withDefaults(defineProps<{ points: readonly { t: number; cents: number | null }[]; seconds?: number }>(), {
  seconds: 8,
})

const W = 300
const H = 100
const RANGE = 50
const y = (cents: number) => H / 2 - (Math.max(-RANGE, Math.min(RANGE, cents)) / RANGE) * (H / 2 - 4)

const segments = computed(() => {
  const latest = props.points.length ? props.points[props.points.length - 1].t : 0
  const from = Math.max(0, latest - props.seconds)
  const lines: string[] = []
  let current: string[] = []
  for (const p of props.points) {
    if (p.t < from) continue
    if (p.cents == null) {
      if (current.length > 1) lines.push(current.join(' '))
      current = []
      continue
    }
    current.push(`${(((p.t - from) / props.seconds) * W).toFixed(1)},${y(p.cents).toFixed(1)}`)
  }
  if (current.length > 1) lines.push(current.join(' '))
  return lines
})
</script>

<template>
  <svg :viewBox="`0 0 ${W} ${H}`" preserveAspectRatio="none" class="block h-full w-full" role="img" aria-label="Tuning over the last seconds">
    <rect x="0" :y="y(IN_TUNE_CENTS)" :width="W" :height="y(-IN_TUNE_CENTS) - y(IN_TUNE_CENTS)" class="fill-accent-400/15" />
    <line x1="0" :y1="H / 2" :x2="W" :y2="H / 2" class="stroke-ink-700" stroke-dasharray="4 4" vector-effect="non-scaling-stroke" />
    <polyline
      v-for="(line, i) in segments"
      :key="i"
      :points="line"
      fill="none"
      class="stroke-accent-400"
      stroke-width="2.5"
      stroke-linejoin="round"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</template>
