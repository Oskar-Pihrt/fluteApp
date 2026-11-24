<script setup lang="ts">
import { computed } from 'vue'
import { parseISO } from '@/lib/dates'

const props = defineProps<{ points: { date: string; value: number }[]; color: string; unit: string; id: string }>()
const W = 320, H = 150, PX = 14, PT = 14, PB = 24

const geo = computed(() => {
  const pts = [...props.points].sort((a, b) => a.date.localeCompare(b.date))
  const xs = pts.map((p) => parseISO(p.date).getTime())
  const vs = pts.map((p) => p.value)
  const x0 = Math.min(...xs), x1 = Math.max(...xs)
  let v0 = Math.min(...vs), v1 = Math.max(...vs)
  const pad = (v1 - v0) * 0.15 || v1 * 0.1 || 1
  v0 -= pad; v1 += pad
  const sx = (x: number) => (x1 === x0 ? W / 2 : PX + ((x - x0) / (x1 - x0)) * (W - PX * 2))
  const sy = (v: number) => PT + (1 - (v - v0) / (v1 - v0)) * (H - PT - PB)
  const xy = pts.map((p, i) => ({ x: sx(xs[i]), y: sy(p.value), ...p }))
  const line = xy.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  const area = xy.length > 1 ? `${line} L${xy.at(-1)!.x.toFixed(1)} ${H - PB} L${xy[0].x.toFixed(1)} ${H - PB} Z` : ''
  return { xy, line, area, v0, v1 }
})
const fmt = (n: number) => (n >= 100 ? Math.round(n) : Math.round(n * 10) / 10)
const short = (iso: string) => parseISO(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
</script>

<template>
  <svg :viewBox="`0 0 ${W} ${H}`" class="w-full" role="img">
    <defs>
      <linearGradient :id="'a' + id" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" :stop-color="color" stop-opacity=".4" />
        <stop offset="1" :stop-color="color" stop-opacity="0" />
      </linearGradient>
    </defs>
    <g stroke="currentColor" stroke-opacity=".08">
      <line v-for="i in 3" :key="i" :x1="PX" :x2="W - PX" :y1="PT + ((H - PT - PB) / 3) * (i - 1)" :y2="PT + ((H - PT - PB) / 3) * (i - 1)" />
      <line :x1="PX" :x2="W - PX" :y1="H - PB" :y2="H - PB" stroke-opacity=".2" />
    </g>
    <path v-if="geo.area" :d="geo.area" :fill="`url(#a${id})`" />
    <path :d="geo.line" fill="none" :stroke="color" stroke-width="2.500" stroke-linecap="round" stroke-linejoin="round" />
    <circle v-for="(p, i) in geo.xy" :key="i" :cx="p.x" :cy="p.y" :r="i === geo.xy.length - 1 ? 5 : 3" :fill="i === geo.xy.length - 1 ? color : '#0d2018'" :stroke="color" stroke-width="2" />
    <text :x="geo.xy.at(-1)!.x" :y="Math.max(geo.xy.at(-1)!.y - 10, 10)" :text-anchor="geo.xy.at(-1)!.x > W - 40 ? 'end' : 'middle'" fill="currentColor" font-size="11" font-weight="700">{{ fmt(geo.xy.at(-1)!.value) }} {{ unit }}</text>
    <text :x="PX" :y="H - 6" fill="currentColor" fill-opacity=".55" font-size="10">{{ short(geo.xy[0].date) }}</text>
    <text :x="W - PX" :y="H - 6" text-anchor="end" fill="currentColor" fill-opacity=".55" font-size="10">{{ short(geo.xy.at(-1)!.date) }}</text>
  </svg>
</template>
