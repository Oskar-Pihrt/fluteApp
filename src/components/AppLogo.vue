<script setup lang="ts">
/**
 * The TimbreMap logo. Until the artwork is ready this is a placeholder of the
 * right size; replace the template with the logo (e.g. `<img src="/logo.svg">`)
 * and every place that shows it follows.
 */
const props = withDefaults(defineProps<{ size?: number }>(), { size: 72 })
</script>

<template>
  <div
    class="flex shrink-0 items-center justify-center rounded-2xl border border-dashed border-ink-600 text-[10px] font-semibold uppercase tracking-wider text-ink-400"
    :style="{ width: `${props.size}px`, height: `${props.size}px` }"
    role="img"
    aria-label="TimbreMap"
  >
    Logo
  </div>
</template>
