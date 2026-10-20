<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import KeyChart from '@/components/KeyChart.vue'
import NoteBadge from '@/components/NoteBadge.vue'
import type { Fingering } from '@/domain/fingering'
import type { Instrument } from '@/instruments'

/**
 * Every note of the piece side by side with its fingering, swiped through
 * under the score. The note in focus — the one sounding, else the one
 * selected — is kept centred, so while playing the strip runs along with the
 * music.
 */

export interface StripEntry {
  id: string
  pitch: string
  fingering: Fingering | null
  /** A barline follows: drawn as a divider in the strip too. */
  barAfter: boolean
}

const props = defineProps<{
  entries: readonly StripEntry[]
  focusId: string | null
  flagged: readonly string[]
  instrument: Instrument
}>()

const emit = defineEmits<{ select: [id: string] }>()

const list = ref<HTMLOListElement | null>(null)

/** Bring the focused note to the middle of the strip, without moving the page. */
function centre(smooth: boolean) {
  const box = list.value
  const item = box?.querySelector<HTMLElement>(`[data-id="${CSS.escape(props.focusId ?? '')}"]`)
  if (!box || !item) return
  const left = item.offsetLeft - box.clientWidth / 2 + item.clientWidth / 2
  box.scrollTo({ left, behavior: smooth ? 'smooth' : 'auto' })
}

watch(
  () => props.focusId,
  () => nextTick(() => centre(true)),
)
watch(
  () => props.entries.length,
  () => nextTick(() => centre(false)),
  { immediate: true },
)
</script>

<template>
  <ol ref="list" class="strip relative flex gap-2 overflow-x-auto px-4 pt-1 pb-3" aria-label="Fingerings">
    <template v-for="entry in entries" :key="entry.id">
      <li class="shrink-0">
        <button
          type="button"
          :data-id="entry.id"
          class="flex min-w-16 flex-col items-center gap-2 border px-1.5 pt-2 pb-2.5 transition-colors"
          :class="
            entry.id === focusId
              ? 'border-accent-400 bg-ink-800'
              : flagged.includes(entry.id)
                ? 'border-amber-400/70'
                : 'border-ink-800 hover:border-ink-600'
          "
          :aria-label="`${entry.pitch}${entry.id === focusId ? ', current' : ''}`"
          :aria-current="entry.id === focusId ? 'true' : undefined"
          @click="emit('select', entry.id)"
        >
          <NoteBadge :note="entry.pitch" size="sm" />
          <KeyChart
            v-if="entry.fingering"
            :keys="entry.fingering.keys"
            :partial="entry.fingering.partial"
            :instrument="instrument"
            :height="118"
          />
          <span v-else class="flex h-[118px] w-12 items-center justify-center text-center text-[10px] text-amber-200">
            No fingering
          </span>
        </button>
      </li>
      <li v-if="entry.barAfter" class="w-px shrink-0 self-stretch bg-ink-700" aria-hidden="true" />
    </template>
  </ol>
</template>

<style scoped>
.strip {
  scrollbar-width: none;
  overscroll-behavior-x: contain;
}
.strip::-webkit-scrollbar {
  display: none;
}
</style>
