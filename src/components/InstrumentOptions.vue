<script setup lang="ts">
import { computed } from 'vue'
import { getMeta, type InstrumentId } from '@/instruments'
import { useSettingsStore } from '@/stores/settings'

/**
 * The optional hardware of one instrument — footjoint, open holes, extra
 * keys — as the player has it. Shown under the instrument in the picker.
 */
const props = defineProps<{ id: InstrumentId }>()

const settings = useSettingsStore()
const options = computed(() => getMeta(props.id).options)
</script>

<template>
  <div v-if="options.length" class="space-y-3">
    <div v-for="option in options" :key="option.heading" class="space-y-1.5">
      <p class="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
        {{ option.heading }}
      </p>
      <div v-if="option.kind === 'choice'" class="grid grid-cols-2 gap-2">
        <button
          v-for="(choice, index) in option.choices"
          :key="choice.label"
          type="button"
          class="rounded-lg border px-3 py-2 text-left transition-colors"
          :class="
            settings.choiceIndex(props.id, option) === index
              ? 'border-accent-400 bg-ink-800'
              : 'border-ink-700 hover:border-ink-400'
          "
          @click="settings.setChoice(props.id, option, index)"
        >
          <span class="block text-xs font-semibold text-ink-50">{{ choice.label }}</span>
          <span class="mt-0.5 block text-[11px] text-ink-400">{{ choice.description }}</span>
        </button>
      </div>
      <label
        v-else
        class="flex cursor-pointer items-start gap-3 rounded-lg border border-ink-700 px-3 py-2 transition-colors hover:border-ink-400"
      >
        <input
          type="checkbox"
          class="mt-0.5 h-4 w-4 shrink-0 accent-accent-400"
          :checked="settings.hasRequirement(props.id, option.requirement)"
          @change="
            settings.setRequirement(props.id, option.requirement, ($event.target as HTMLInputElement).checked)
          "
        />
        <span>
          <span class="block text-xs font-semibold text-ink-50">{{ option.label }}</span>
          <span class="mt-0.5 block text-[11px] text-ink-400">{{ option.description }}</span>
        </span>
      </label>
    </div>
  </div>
</template>
