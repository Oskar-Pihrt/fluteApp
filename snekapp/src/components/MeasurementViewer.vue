<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import Sheet from './Sheet.vue'
import { splinePath } from '@/lib/measure'
import { fmtDate } from '@/lib/dates'
import { locale, t } from '@/lib/i18n'
import type { Measurement } from '@/lib/types'

const props = defineProps<{ measurement: Measurement | null }>()
const emit = defineEmits<{ close: [] }>()
const url = ref('')

watch(() => props.measurement, (m) => {
  if (url.value) URL.revokeObjectURL(url.value)
  url.value = m ? URL.createObjectURL(m.photo) : ''
}, { immediate: true })
onBeforeUnmount(() => url.value && URL.revokeObjectURL(url.value))
</script>

<template>
  <Sheet :open="!!measurement" :title="measurement ? `${measurement.lengthCm.toFixed(1)} ${t('cm')} · ${fmtDate(measurement.date, locale)}` : ''" @close="emit('close')">
    <div v-if="measurement" class="relative overflow-hidden rounded-2xl bg-black">
      <img :src="url" class="block w-full" alt="" />
      <svg :viewBox="`0 0 ${measurement.imgW} ${measurement.imgH}`" class="absolute inset-0 h-full w-full">
        <line :x1="measurement.cal[0].x" :y1="measurement.cal[0].y" :x2="measurement.cal[1].x" :y2="measurement.cal[1].y" stroke="#e8c547" :stroke-width="measurement.imgW / 250" stroke-dasharray="6 6" />
        <path :d="splinePath(measurement.points)" fill="none" stroke="#5be37d" :stroke-width="measurement.imgW / 120" stroke-linecap="round" stroke-linejoin="round" opacity=".9" />
      </svg>
    </div>
  </Sheet>
</template>
