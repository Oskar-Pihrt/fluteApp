<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ color: string; id?: number }>()
// Unique gradient id per instance so several snakes on a page don't share one.
const uid = computed(() => `sa${props.id ?? 0}${props.color.replace('#', '')}`)
const BODY = 'M64 66c-6-5-1-14 8-13 13 1 17 17 6 26-13 11-34 6-40-9-7-19 8-38 30-40 26-2 44 18 38 43-4 15-17 25-33 27'
</script>

<template>
  <svg viewBox="0 0 120 120" class="h-full w-full" aria-hidden="true">
    <defs>
      <radialGradient :id="uid + 'bg'" cx=".5" cy=".4" r=".7">
        <stop offset="0" :stop-color="color" stop-opacity=".35" />
        <stop offset="1" :stop-color="color" stop-opacity="0" />
      </radialGradient>
      <linearGradient :id="uid + 'b'" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" :stop-color="color" />
        <stop offset="1" :stop-color="color" stop-opacity=".62" />
      </linearGradient>
    </defs>
    <circle cx="60" cy="60" r="58" :fill="`url(#${uid}bg)`" />
    <g fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path :d="BODY" stroke="#000" stroke-opacity=".28" stroke-width="15" transform="translate(1.500 3)" />
      <path :d="BODY" :stroke="`url(#${uid}b)`" stroke-width="14" />
      <path :d="BODY" stroke="#fff" stroke-opacity=".35" stroke-width="3.500" stroke-dasharray=".1 9" />
      <path :d="BODY" stroke="#fff" stroke-opacity=".18" stroke-width="2.200" transform="translate(-2.500 -2.500)" />
    </g>
    <g transform="translate(60 112) rotate(30)">
      <path d="M-2 -1 7 -1 12 -3M7 -1l5 2" stroke="#ff5a6a" stroke-width="1.300" fill="none" stroke-linecap="round" />
      <ellipse cx="-5" cy="0" rx="10" ry="8" :fill="color" />
      <ellipse cx="-5" cy="0" rx="10" ry="8" fill="#000" fill-opacity=".1" />
      <circle cx="-8" cy="-4.200" r="2.600" fill="#071a10" /><circle cx="-8" cy="4.200" r="2.600" fill="#071a10" />
      <circle cx="-8.600" cy="-4.800" r=".9" fill="#e8c547" /><circle cx="-8.600" cy="3.600" r=".9" fill="#e8c547" />
    </g>
  </svg>
</template>
