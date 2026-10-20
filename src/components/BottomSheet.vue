<script setup lang="ts">
import { onBeforeUnmount, watch } from 'vue'

/**
 * A panel that slides up from the bottom edge over a dimmed page — where a
 * phone keeps its secondary choices, within reach of the thumb. On wider
 * screens it sits centred at the bottom, no wider than a phone.
 */
const props = defineProps<{ open: boolean; label: string }>()
const emit = defineEmits<{ close: [] }>()

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}

watch(
  () => props.open,
  (open) => {
    if (open) document.addEventListener('keydown', onKeydown)
    else document.removeEventListener('keydown', onKeydown)
  },
  { immediate: true },
)

onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="fixed inset-0 z-40 flex items-end justify-center">
        <button type="button" class="absolute inset-0 bg-black/60" aria-label="Close" @click="emit('close')" />
        <section
          role="dialog"
          aria-modal="true"
          :aria-label="label"
          class="sheet-panel relative max-h-[88svh] w-full max-w-md overflow-y-auto border-t border-ink-700 bg-ink-900 pt-2.5"
          style="padding-bottom: calc(var(--safe-bottom) + 1.25rem)"
        >
          <div class="mx-auto mb-3 h-1 w-10 bg-ink-600" aria-hidden="true" />
          <slot />
        </section>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.sheet-enter-active,
.sheet-leave-active {
  transition: opacity 0.18s ease;
}
.sheet-enter-active .sheet-panel,
.sheet-leave-active .sheet-panel {
  transition: transform 0.22s ease;
}
.sheet-enter-from,
.sheet-leave-to {
  opacity: 0;
}
.sheet-enter-from .sheet-panel,
.sheet-leave-to .sheet-panel {
  transform: translateY(100%);
}
</style>
