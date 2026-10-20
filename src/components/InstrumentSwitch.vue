<script setup lang="ts">
import { ref } from 'vue'
import InstrumentMenu from '@/components/InstrumentMenu.vue'
import type { InstrumentId } from '@/instruments'
import { useSettingsStore } from '@/stores/settings'

/** The menu that flips the whole app between the player's instruments. */

const props = withDefaults(defineProps<{ align?: 'left' | 'right' }>(), { align: 'left' })

const settings = useSettingsStore()
const failed = ref(false)

async function select(id: InstrumentId) {
  failed.value = false
  try {
    await settings.selectInstrument(id)
  } catch {
    failed.value = true
  }
}
</script>

<template>
  <div>
    <InstrumentMenu
      :current="settings.instrumentId"
      :options="settings.visibleInstruments"
      label="Instrument"
      edit-link
      :align="props.align"
      @select="select"
    />
    <p v-if="failed" role="alert" class="mt-1 text-[11px] text-red-300">
      Couldn’t download it — you seem to be offline.
    </p>
  </div>
</template>
