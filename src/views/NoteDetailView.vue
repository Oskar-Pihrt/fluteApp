<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
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
 *
 * On a phone it is one screen: one fingering at a time, Lower/Higher pinned
 * at the bottom. Wider screens list every fingering and scroll.
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

const wideQuery = window.matchMedia('(min-width: 768px)')
const wide = ref(wideQuery.matches)
const onWide = () => (wide.value = wideQuery.matches)
wideQuery.addEventListener('change', onWide)
onBeforeUnmount(() => wideQuery.removeEventListener('change', onWide))

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
  <div class="flex min-h-0 flex-1 flex-col gap-3 pb-3 md:block md:space-y-6 md:pb-0">
    <RouterLink
      :to="{ name: 'notes' }"
      class="inline-flex shrink-0 items-center gap-1 self-start text-xs font-medium text-ink-400 hover:text-ink-200"
    >
      <span aria-hidden="true">←</span> Note library
    </RouterLink>

    <NoteFingerings :note="note" :paged="!wide" />

    <nav class="flex shrink-0 gap-3">
      <RouterLink
        v-if="neighbours.prev"
        :to="{ name: 'note', params: { note: canonicalNote(Note.midi(neighbours.prev)!) } }"
        class="flex-1 rounded-xl border border-ink-700 px-4 py-2 text-sm text-ink-200 md:py-3 transition-colors hover:border-accent-400"
      >
        <span class="text-xs text-ink-400">Lower</span>
        <br />
        {{ noteLabelWithEnharmonic(neighbours.prev) }}
      </RouterLink>
      <RouterLink
        v-if="neighbours.next"
        :to="{ name: 'note', params: { note: canonicalNote(Note.midi(neighbours.next)!) } }"
        class="flex-1 rounded-xl border border-ink-700 px-4 py-2 text-right md:py-3 text-sm text-ink-200 transition-colors hover:border-accent-400"
      >
        <span class="text-xs text-ink-400">Higher</span>
        <br />
        {{ noteLabelWithEnharmonic(neighbours.next) }}
      </RouterLink>
    </nav>
  </div>
</template>
