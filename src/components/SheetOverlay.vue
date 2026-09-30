<script setup lang="ts">
import { computed } from 'vue'
import type { Box } from '@/omr/types'

/**
 * Boxes drawn over the sheet image, one per detected note.
 *
 * This is what makes reviewing detection quick: instead of comparing a list of
 * note names against a printed page by eye, you tap a note and see exactly which
 * mark on the page it came from — and mistakes become obvious rather than
 * needing to be hunted for.
 *
 * Boxes arrive normalised 0–1 against the stored image, so the overlay works at
 * any display size with no measuring, and stays correct through zoom.
 */

const props = defineProps<{
  boxes: (Box | undefined)[]
  selectedIndex: number | null
  /** Indices worth a second look — low confidence, or flagged by a warning. */
  flagged?: number[]
}>()

const emit = defineEmits<{ select: [index: number] }>()

const flaggedSet = computed(() => new Set(props.flagged ?? []))

const drawable = computed(() =>
  props.boxes
    .map((box, index) => ({ box, index }))
    .filter((entry): entry is { box: Box; index: number } => entry.box != null),
)
</script>

<template>
  <svg
    class="pointer-events-none absolute inset-0 h-full w-full"
    viewBox="0 0 1 1"
    preserveAspectRatio="none"
    aria-hidden="true"
  >
    <rect
      v-for="entry in drawable"
      :key="entry.index"
      :x="entry.box.x"
      :y="entry.box.y"
      :width="entry.box.width"
      :height="entry.box.height"
      class="note-box pointer-events-auto"
      :class="{
        'note-box--selected': entry.index === selectedIndex,
        'note-box--flagged': flaggedSet.has(entry.index),
      }"
      @click="emit('select', entry.index)"
    />
  </svg>
</template>

<style scoped>
/* Stroke width is in viewBox units, and the viewBox is 1×1 with a non-uniform
   aspect, so a plain stroke-width would be stretched. vector-effect keeps it a
   constant screen width instead. */
.note-box {
  fill: transparent;
  stroke: var(--color-accent-400);
  stroke-width: 2;
  vector-effect: non-scaling-stroke;
  opacity: 0.55;
  cursor: pointer;
  transition:
    opacity 120ms ease,
    stroke 120ms ease;
}

.note-box:hover {
  opacity: 1;
}

.note-box--flagged {
  stroke: #fbbf24;
  opacity: 0.9;
}

.note-box--selected {
  fill: color-mix(in srgb, var(--color-accent-400) 25%, transparent);
  stroke-width: 3;
  opacity: 1;
}
</style>
