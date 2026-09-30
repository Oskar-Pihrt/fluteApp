<script setup lang="ts">
import { computed, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Note } from 'tonal'
import NoteFingerings from '@/components/NoteFingerings.vue'
import { canonicalNote, noteLabelWithEnharmonic, noteRange } from '@/domain/lookup'
import { useSettingsStore } from '@/stores/settings'

/**
 * Feature 2, detail — every documented fingering for one note, as a standalone
 * page. Reached from links elsewhere in the app (the fingering finder, a
 * sheet's note picker) rather than from the note library itself, which
 * unfolds the same content inline instead of navigating here.
 */

const route = useRoute()
const router = useRouter()
const settings = useSettingsStore()

const note = computed(() => String(route.params.note))
const midi = computed(() => Note.midi(note.value))

/** Previous/next within the playable range, for thumbing through the library. */
const neighbours = computed(() => {
  const range = noteRange(settings.context)
  const index = range.findIndex((entry) => entry.midi === midi.value)
  if (index === -1) return { prev: null, next: null }
  return {
    prev: index > 0 ? range[index - 1].note : null,
    next: index < range.length - 1 ? range[index + 1].note : null,
  }
})

// Switching instrument on a note page: that note may not exist on the other one.
watch(
  () => settings.instrumentId,
  () => {
    if (!noteRange(settings.context).some((entry) => entry.midi === midi.value)) {
      void router.replace({ name: 'notes' })
    }
  },
)
</script>

<template>
  <div class="space-y-6">
    <RouterLink
      :to="{ name: 'notes' }"
      class="inline-flex items-center gap-1 text-xs font-medium text-ink-400 hover:text-ink-200"
    >
      <span aria-hidden="true">←</span> Note library
    </RouterLink>

    <NoteFingerings :note="note" />

    <nav class="flex gap-3">
      <RouterLink
        v-if="neighbours.prev"
        :to="{ name: 'note', params: { note: canonicalNote(Note.midi(neighbours.prev)!) } }"
        class="flex-1 rounded-xl border border-ink-700 px-4 py-3 text-sm text-ink-200 transition-colors hover:border-accent-400"
      >
        <span class="text-xs text-ink-400">Lower</span>
        <br />
        {{ noteLabelWithEnharmonic(neighbours.prev) }}
      </RouterLink>
      <RouterLink
        v-if="neighbours.next"
        :to="{ name: 'note', params: { note: canonicalNote(Note.midi(neighbours.next)!) } }"
        class="flex-1 rounded-xl border border-ink-700 px-4 py-3 text-right text-sm text-ink-200 transition-colors hover:border-accent-400"
      >
        <span class="text-xs text-ink-400">Higher</span>
        <br />
        {{ noteLabelWithEnharmonic(neighbours.next) }}
      </RouterLink>
    </nav>
  </div>
</template>
