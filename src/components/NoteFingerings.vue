<script setup lang="ts">
import { computed } from 'vue'
import FingeringCard from '@/components/FingeringCard.vue'
import NoteBadge from '@/components/NoteBadge.vue'
import PlayButton from '@/components/PlayButton.vue'
import StaffPosition from '@/components/StaffPosition.vue'
import {
  fingeringsForNote,
  noteFrequency,
  noteLabel,
  noteLabelWithEnharmonic,
  soundingNote,
} from '@/domain/lookup'
import { useSettingsStore } from '@/stores/settings'

/**
 * One note's full detail — staff position, badge, and every documented
 * fingering. Shared by the note library's inline panel and the standalone
 * note page, so the two present the same information.
 */
const props = defineProps<{ note: string }>()

const settings = useSettingsStore()
const fingerings = computed(() => fingeringsForNote(props.note, settings.context))
const frequency = computed(() => noteFrequency(props.note, settings.instrument))
/** Only shown for transposing instruments, where it differs from the note. */
const sounding = computed(() => {
  if (!settings.instrument.transposeSemitones) return null
  const note = soundingNote(props.note, settings.instrument)
  return note && noteLabel(note)
})
</script>

<template>
  <div class="space-y-5">
    <header class="flex items-start gap-4">
      <StaffPosition :note="note" size="sm" class="shrink-0" />
      <div class="min-w-0 flex-1">
        <NoteBadge :note="note" size="lg" />
        <p class="mt-1 text-sm text-ink-400">
          {{ noteLabelWithEnharmonic(note) }}
          <span v-if="sounding"> · sounds {{ sounding }}</span>
          <span v-if="frequency"> · {{ frequency.toFixed(1) }} Hz</span>
        </p>
      </div>
      <PlayButton :note="note" class="mt-1 shrink-0" />
    </header>

    <section v-if="fingerings.length" class="space-y-3">
      <h3 class="text-xs font-semibold uppercase tracking-wider text-ink-400">
        {{ fingerings.length }} {{ fingerings.length === 1 ? 'fingering' : 'fingerings' }}
      </h3>
      <!-- The diagram is tall, so pair cards up once there's width for it. -->
      <div class="grid gap-3 sm:grid-cols-2">
        <FingeringCard
          v-for="fingering in fingerings"
          :key="fingering.id"
          :fingering="fingering"
          size="md"
        />
      </div>
    </section>

    <p v-else class="rounded-xl border border-ink-700 bg-ink-900 px-4 py-6 text-sm text-ink-400">
      No fingering on record for {{ noteLabelWithEnharmonic(note) }} with your current instrument
      setup.
    </p>
  </div>
</template>
