<script setup lang="ts">
import { INSTRUMENT_IDS, INSTRUMENTS } from '@/instruments'
import { useSettingsStore } from '@/stores/settings'

/** Segmented switch that flips the whole app between instruments. */

const settings = useSettingsStore()
</script>

<template>
  <div
    role="radiogroup"
    aria-label="Instrument"
    class="grid grid-cols-2 gap-0.5 rounded-lg border border-ink-700 bg-ink-950 p-0.5"
  >
    <button
      v-for="id in INSTRUMENT_IDS"
      :key="id"
      type="button"
      role="radio"
      :aria-checked="settings.instrumentId === id"
      class="rounded-md px-3 py-1.5 text-xs font-semibold transition-colors"
      :class="
        settings.instrumentId === id
          ? 'bg-accent-400 text-ink-950'
          : 'text-ink-400 hover:text-ink-200'
      "
      @click="settings.instrumentId = id"
    >
      {{ INSTRUMENTS[id].shortName }}
    </button>
  </div>
</template>
