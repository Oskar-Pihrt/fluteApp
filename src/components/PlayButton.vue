<script setup lang="ts">
import { playNote } from '@/domain/audio'
import { useSettingsStore } from '@/stores/settings'

const props = defineProps<{ note: string }>()
const settings = useSettingsStore()
</script>

<template>
  <button
    v-if="settings.audioEnabled"
    type="button"
    class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-600 text-brass-400 transition-colors hover:border-brass-400 hover:bg-ink-800 active:bg-ink-700"
    :aria-label="`Play ${props.note}`"
    @click="playNote(props.note)"
  >
    <svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  </button>
</template>
