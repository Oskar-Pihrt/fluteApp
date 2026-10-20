<script setup lang="ts">
import { computed } from 'vue'
import InstrumentOptions from '@/components/InstrumentOptions.vue'
import { CATALOG, CATALOG_GROUPS, type InstrumentId, loadStatus } from '@/instruments'

/**
 * The full catalog as a checklist, grouped by family — which instruments the
 * player wants in the switch, and under each one they tick, what is on it
 * (footjoint, extra keys). Used on first launch and in Setup. At least one
 * stays ticked.
 */
const props = defineProps<{ selected: readonly InstrumentId[] }>()

const emit = defineEmits<{ toggle: [id: InstrumentId, on: boolean] }>()

const groups = computed(() =>
  CATALOG_GROUPS.map((group) => {
    const ids = (Object.keys(CATALOG) as InstrumentId[]).filter((id) => CATALOG[id].group === group.id)
    return { ...group, ids, chosen: ids.filter((id) => props.selected.includes(id)).length }
  }).filter((group) => group.ids.length),
)

function status(id: InstrumentId): string | null {
  if (!props.selected.includes(id)) return null
  const state = loadStatus.get(id)
  if (state === 'loading') return 'Downloading…'
  if (state === 'error') return 'Not downloaded — connect to the internet'
  return null
}
</script>

<template>
  <div class="space-y-2">
    <details
      v-for="group in groups"
      :key="group.id"
      class="group rounded-xl border border-ink-700"
      :open="group.chosen > 0 || groups.length <= 3"
    >
      <summary
        class="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold text-ink-50"
      >
        <span>{{ group.label }}</span>
        <span class="text-xs font-normal text-ink-400">
          {{ group.chosen ? `${group.chosen} chosen` : '' }}
          <span class="ml-1 inline-block transition-transform group-open:rotate-90" aria-hidden="true">›</span>
        </span>
      </summary>
      <div class="space-y-1 px-2 pb-2">
        <div v-for="id in group.ids" :key="id">
          <label
            class="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-ink-800"
          >
            <input
              type="checkbox"
              class="mt-0.5 h-4 w-4 shrink-0 accent-accent-400"
              :checked="props.selected.includes(id)"
              :disabled="props.selected.length === 1 && props.selected.includes(id)"
              @change="emit('toggle', id, ($event.target as HTMLInputElement).checked)"
            />
            <span class="min-w-0">
              <span class="block text-sm text-ink-50">{{ CATALOG[id].name }}</span>
              <span v-if="status(id)" class="mt-0.5 block text-xs text-ink-400">{{ status(id) }}</span>
            </span>
          </label>
          <!-- What's on the player's instrument, only for the ones they play. -->
          <InstrumentOptions
            v-if="props.selected.includes(id)"
            :id="id"
            class="mb-2 ml-9 mr-2"
          />
        </div>
      </div>
    </details>
  </div>
</template>
