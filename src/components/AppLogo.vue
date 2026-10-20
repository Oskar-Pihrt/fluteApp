<script setup lang="ts">
/** The TimbreMap logo (public/logo.png), `size` pixels tall. */
const props = withDefaults(defineProps<{ size?: number }>(), { size: 72 })
</script>

<template>
  <img
    src="/logo.png"
    alt="TimbreMap"
    class="shrink-0 object-contain"
    :style="{ height: `${props.size}px`, width: 'auto' }"
  />
</template>
