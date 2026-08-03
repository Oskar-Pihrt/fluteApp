<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { grayscaleToRgba } from '@/omr/bitmap'
import type { Bitmap } from '@/omr/types'

/**
 * The recogniser's intermediate bitmaps, side by side.
 *
 * Debugging a vision pipeline without being able to see its intermediate state is
 * guesswork — this exists to turn "detection missed some notes" into "the staff
 * removal ate them". Three stages tell you almost everything:
 *
 *  - **Binarised** — wrong here and nothing downstream can work. Filled
 *    noteheads showing as rings is the classic thresholding failure.
 *  - **Staff removed** — lines gone but noteheads and stems intact.
 *  - **Eroded** — should be one small blob per filled notehead and nothing else.
 *
 * Dev-only, and off by default: keeping three full-page bitmaps costs real memory.
 */

const props = defineProps<{
  binarised?: Bitmap
  staffRemoved?: Bitmap
  eroded?: Bitmap
}>()

const canvases = ref<Record<string, HTMLCanvasElement | null>>({})

const STAGES = [
  { key: 'binarised', label: 'Binarised', hint: 'Solid noteheads, even lighting' },
  { key: 'staffRemoved', label: 'Staff removed', hint: 'Lines gone, symbols intact' },
  { key: 'eroded', label: 'Eroded', hint: 'One blob per filled notehead' },
] as const

function paint() {
  for (const stage of STAGES) {
    const bitmap = props[stage.key]
    const canvas = canvases.value[stage.key]
    if (!bitmap || !canvas) continue
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) continue
    // Filled via createImageData rather than the ImageData constructor, which
    // insists on a non-shared ArrayBuffer and rejects a plain typed array.
    const imageData = context.createImageData(bitmap.width, bitmap.height)
    imageData.data.set(grayscaleToRgba(bitmap))
    context.putImageData(imageData, 0, 0)
  }
}

// Painted on mount, not via an `immediate` watcher: the component is created with
// its props already set, so an immediate callback runs before the template refs
// exist and nothing ever changes afterwards to trigger a second attempt. The
// watcher covers a later re-run of detection.
onMounted(paint)
watch(() => [props.binarised, props.staffRemoved, props.eroded], paint, { flush: 'post' })

onUnmounted(() => {
  canvases.value = {}
})
</script>

<template>
  <section class="space-y-3 rounded-xl border border-ink-700 bg-ink-900 p-4">
    <p class="text-[11px] font-semibold uppercase tracking-wider text-ink-400">
      Detection stages
    </p>
    <div v-for="stage in STAGES" :key="stage.key" class="space-y-1">
      <p class="text-xs text-ink-200">
        {{ stage.label }}
        <span class="text-ink-600">— {{ stage.hint }}</span>
      </p>
      <div class="overflow-auto rounded-lg border border-ink-700 bg-ink-50">
        <canvas
          :ref="(element) => (canvases[stage.key] = element as HTMLCanvasElement | null)"
          class="block w-full"
        />
      </div>
    </div>
  </section>
</template>
