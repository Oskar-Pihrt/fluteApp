<script setup lang="ts">
defineProps<{ name: 'home' | 'snake' | 'calendar' | 'ruler' | 'more' | 'plus' | 'chevron' | 'close' | 'camera' | 'image' | 'undo' | 'trash' | 'check' | 'leaf' | 'back' }>()
</script>

<template>
  <svg viewBox="0 0 24 24" width="1.4em" height="1.4em" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <template v-if="name === 'home'"><path d="M3 11.5 12 4l9 7.5" /><path d="M5.5 10v9.5h13V10" /><path d="M10 19.5v-5h4v5" /></template>
    <template v-else-if="name === 'snake'"><path d="M4 18c-1.5-3 .5-5.5 4-5.5s5-2 3.5-4.2C10 6 12 4 15 4.5c2.7.5 4 2.600 3 5" /><circle cx="18.600" cy="11" r="1.500" fill="currentColor" stroke="none" /><path d="M4 18c2.500 2 6 2 8.500.500" /></template>
    <template v-else-if="name === 'calendar'"><rect x="3.500" y="5" width="17" height="15.500" rx="3" /><path d="M3.500 10h17M8 3v4M16 3v4" /></template>
    <template v-else-if="name === 'ruler'"><rect x="2.500" y="8" width="19" height="8" rx="1.800" transform="rotate(-30 12 12)" /><path d="m8 13.500 1.200-.7M10.800 12l1.200-.7m1.700-.8 1.200-.7M7 10.800l-.5.300" transform="rotate(-0 12 12)" /></template>
    <template v-else-if="name === 'more'"><circle cx="5" cy="12" r="1.400" fill="currentColor" /><circle cx="12" cy="12" r="1.400" fill="currentColor" /><circle cx="19" cy="12" r="1.400" fill="currentColor" /></template>
    <template v-else-if="name === 'plus'"><path d="M12 5v14M5 12h14" /></template>
    <template v-else-if="name === 'chevron'"><path d="m9 6 6 6-6 6" /></template>
    <template v-else-if="name === 'back'"><path d="m15 6-6 6 6 6" /></template>
    <template v-else-if="name === 'close'"><path d="M6 6l12 12M18 6 6 18" /></template>
    <template v-else-if="name === 'camera'"><path d="M4 8.500h3l1.500-2.500h7L17 8.500h3v10H4z" /><circle cx="12" cy="13.500" r="3.300" /></template>
    <template v-else-if="name === 'image'"><rect x="3.500" y="4.500" width="17" height="15" rx="3" /><circle cx="9" cy="10" r="1.700" /><path d="m4 17 5-4.500 4 3 3-2.500 4 3.500" /></template>
    <template v-else-if="name === 'undo'"><path d="M9 14 4 9l5-5" /><path d="M4 9h10a6 6 0 0 1 0 12h-3" /></template>
    <template v-else-if="name === 'trash'"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.500h10L18 7M9 7V4.500h6V7" /></template>
    <template v-else-if="name === 'check'"><path d="m5 12.500 4.500 4.500L19 7.500" /></template>
    <template v-else-if="name === 'leaf'"><path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14" /><path d="M5 19 13 11" /></template>
  </svg>
</template>
