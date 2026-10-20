<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { getMeta, type InstrumentId } from '@/instruments'

/**
 * A drop-down list of instruments: the current one on the button, the rest a
 * tap away. Used for the app-wide switch and for the instrument a sheet is
 * written for.
 */
const props = withDefaults(
  defineProps<{
    current: InstrumentId
    options: readonly InstrumentId[]
    /** Accessible name of the control. */
    label: string
    /** Offer a link to Setup, where the list itself is chosen. */
    editLink?: boolean
    /** Which edge the menu lines up with. */
    align?: 'left' | 'right'
  }>(),
  { editLink: false, align: 'left' },
)

const emit = defineEmits<{ select: [InstrumentId] }>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
const currentMeta = computed(() => getMeta(props.current))

function choose(id: InstrumentId) {
  open.value = false
  if (id !== props.current) emit('select', id)
}

function onPointerDown(event: PointerEvent) {
  if (root.value && !root.value.contains(event.target as Node)) open.value = false
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') open.value = false
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeydown)
  } else {
    document.removeEventListener('pointerdown', onPointerDown)
    document.removeEventListener('keydown', onKeydown)
  }
})

onBeforeUnmount(() => (open.value = false))
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="flex w-full items-center justify-between gap-2 rounded-lg border border-ink-700 bg-ink-950 px-3 py-1.5 text-left text-xs font-semibold text-ink-50 transition-colors hover:border-ink-400"
      :aria-label="`${props.label}: ${currentMeta.name}`"
      aria-haspopup="listbox"
      :aria-expanded="open"
      @click="open = !open"
    >
      <span class="truncate">{{ currentMeta.name }}</span>
      <svg viewBox="0 0 12 12" class="h-3 w-3 shrink-0 text-ink-400" aria-hidden="true">
        <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" stroke-width="1.5" />
      </svg>
    </button>

    <div
      v-if="open"
      class="absolute top-full z-30 mt-1 max-h-[70vh] w-max min-w-full max-w-[18rem] overflow-y-auto rounded-lg border border-ink-700 bg-ink-900 p-1 shadow-xl"
      :class="props.align === 'right' ? 'right-0' : 'left-0'"
    >
      <ul role="listbox" :aria-label="props.label">
        <li v-for="id in props.options" :key="id">
          <button
            type="button"
            role="option"
            :aria-selected="id === props.current"
            class="flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-ink-800"
            :class="id === props.current ? 'text-accent-400' : 'text-ink-200'"
            @click="choose(id)"
          >
            <span>{{ getMeta(id).name }}</span>
            <span v-if="id === props.current" aria-hidden="true">✓</span>
          </button>
        </li>
      </ul>
      <RouterLink
        v-if="props.editLink"
        :to="{ name: 'settings', hash: '#instruments' }"
        class="mt-1 block rounded-md border-t border-ink-800 px-3 pt-2.5 pb-2 text-xs font-medium text-ink-400 hover:text-ink-200"
        @click="open = false"
      >
        Choose instruments…
      </RouterLink>
    </div>
  </div>
</template>
