<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import SnakeArt from './SnakeArt.vue'
import type { Snake } from '@/lib/types'

const props = defineProps<{ snake: Snake }>()
const url = ref<string | null>(null)

watch(
  () => props.snake.photo,
  (photo) => {
    if (url.value) URL.revokeObjectURL(url.value)
    url.value = photo ? URL.createObjectURL(photo) : null
  },
  { immediate: true },
)
onBeforeUnmount(() => url.value && URL.revokeObjectURL(url.value))
</script>

<template>
  <div class="overflow-hidden rounded-full bg-surface2 ring-2" :style="{ '--tw-ring-color': snake.color + '88' }">
    <img v-if="url" :src="url" :alt="snake.name" class="h-full w-full object-cover" />
    <SnakeArt v-else :color="snake.color" :id="snake.id" />
  </div>
</template>
