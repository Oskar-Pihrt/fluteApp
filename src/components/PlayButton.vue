<script setup lang="ts">
import { playNote } from '@/domain/audio'
import type { Instrument } from '@/instruments'
import { useSettingsStore } from '@/stores/settings'

/** Plays a written note at its sounding pitch on `instrument` (default: active). */
const props = defineProps<{ note: string; instrument?: Instrument }>()
const settings = useSettingsStore()
</script>

<template>
  <button
    v-if="settings.audioEnabled"
    type="button"
    class="inline-flex h-9 w-9 items-center justify-center rounded-full border border-ink-600 text-accent-400 transition-colors hover:border-accent-400 hover:bg-ink-800 active:bg-ink-700"
    :aria-label="`Play ${props.note}`"
    @click="playNote(props.note, props.instrument ?? settings.instrument)"
  >
    <svg viewBox="0 0 24 24" class="h-4 w-4" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  </button>
</template>
