<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import InstrumentPicker from '@/components/InstrumentPicker.vue'
import type { InstrumentId } from '@/instruments'
import { useSettingsStore } from '@/stores/settings'

/**
 * First launch: which instruments the player plays. Only those are put in the
 * switch and downloaded; the rest of the catalog stays one tap away in Setup.
 */

const router = useRouter()
const settings = useSettingsStore()

const chosen = ref<InstrumentId[]>([...settings.visibleInstruments])
const working = ref(false)
const failed = ref(false)

function toggle(id: InstrumentId, on: boolean) {
  chosen.value = on ? [...chosen.value, id] : chosen.value.filter((other) => other !== id)
}

async function start() {
  working.value = true
  failed.value = false
  try {
    for (const id of chosen.value) await settings.setVisible(id, true)
    for (const id of [...settings.visibleInstruments]) {
      if (!chosen.value.includes(id)) await settings.setVisible(id, false)
    }
    await settings.selectInstrument(settings.visibleInstruments[0])
    settings.onboarded = true
    await router.replace({ name: 'finder' })
  } catch {
    failed.value = true
  } finally {
    working.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-md space-y-6">
    <header>
      <h1 class="text-2xl">What do you play?</h1>
      <p class="mt-1.5 text-sm leading-relaxed text-ink-400">
        Pick your instruments. They go in the switch at the top, and only they are downloaded — you
        can add or remove them any time in Setup.
      </p>
    </header>

    <InstrumentPicker :selected="chosen" @toggle="toggle" />

    <p v-if="failed" role="alert" class="text-xs text-red-300">
      Couldn’t download your instruments — check your connection and try again.
    </p>

    <button
      type="button"
      class="w-full rounded-lg bg-accent-400 px-4 py-3 text-sm font-semibold text-ink-950 transition-colors hover:bg-accent-300 disabled:opacity-50"
      :disabled="working || !chosen.length"
      @click="start"
    >
      {{ working ? 'Downloading…' : 'Start' }}
    </button>
  </div>
</template>
