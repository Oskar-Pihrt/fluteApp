<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import KeyChart from '@/components/KeyChart.vue'
import NoteBadge from '@/components/NoteBadge.vue'
import PlayButton from '@/components/PlayButton.vue'
import StaffPosition from '@/components/StaffPosition.vue'
import type { KeyId } from '@/domain/keys'
import {
  canonicalNote,
  hasEnharmonic,
  nearestFingerings,
  noteLabelWithEnharmonic,
  notesForKeys,
} from '@/domain/lookup'
import { useSettingsStore } from '@/stores/settings'

/**
 * Feature 1 — pick the keys you press, get the notes it produces.
 *
 * The first two octaves of the flute share fingerings, so a match commonly
 * returns two notes an octave apart. That is shown as a list rather than a
 * single answer, on purpose.
 */

const settings = useSettingsStore()
const selected = ref<KeyId[]>([])

const unavailable = computed<KeyId[]>(() =>
  settings.footJoint === 'B' ? [] : ['FOOT_B', 'GIZMO'],
)

const matches = computed(() => notesForKeys(selected.value, settings.fluteConfig))
const suggestions = computed(() =>
  matches.value.length || !selected.value.length
    ? []
    : nearestFingerings(selected.value, settings.fluteConfig),
)

function reset() {
  selected.value = []
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex items-baseline justify-between gap-4">
      <div>
        <h1 class="text-xl">What note is this?</h1>
        <p class="mt-1 text-sm text-ink-400">Tap the keys you hold down.</p>
      </div>
      <button
        v-if="selected.length"
        type="button"
        class="shrink-0 rounded-lg border border-ink-600 px-3 py-1.5 text-xs font-medium text-ink-200 transition-colors hover:border-ink-400"
        @click="reset"
      >
        Clear
      </button>
    </header>

    <!-- Stacked on a phone — the diagram is already tall, so putting the answer
         beside it narrows the results column too much. Side by side from `sm`
         up, where there's width to spare. -->
    <div class="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:gap-9">
      <div class="shrink-0">
        <KeyChart v-model:keys="selected" interactive size="lg" :unavailable="unavailable" />
      </div>

      <div class="w-full min-w-0 flex-1 space-y-4">
        <!-- No selection yet -->
        <p
          v-if="!selected.length"
          class="rounded-xl border border-dashed border-ink-700 px-3 py-8 text-center text-sm text-ink-400"
        >
          Your note appears here.
        </p>

        <!-- Matches -->
        <section v-else-if="matches.length" class="space-y-3">
          <h2 class="text-xs font-semibold uppercase tracking-wider text-ink-400">
            {{ matches.length === 1 ? 'This fingering plays' : `Plays ${matches.length} notes` }}
          </h2>

          <ul class="space-y-2.5">
            <li
              v-for="match in matches"
              :key="match.id"
              class="rounded-xl border border-ink-700 bg-ink-900 px-4 py-3.5"
            >
              <div class="flex items-center gap-3">
                <StaffPosition :note="match.note" size="sm" class="shrink-0" />
                <NoteBadge :note="match.note" size="lg" />
                <PlayButton :note="match.note" class="ml-auto shrink-0" />
              </div>

              <!-- Only worth a second line when it adds something: an
                   alternative spelling, or a non-standard fingering. -->
              <p
                v-if="hasEnharmonic(match.note) || match.kind !== 'primary'"
                class="mt-1.5 text-sm text-ink-400"
              >
                <span v-if="hasEnharmonic(match.note)">{{
                  noteLabelWithEnharmonic(match.note)
                }}</span>
                <span v-if="match.kind !== 'primary'" class="text-brass-400">
                  {{ hasEnharmonic(match.note) ? '· ' : '' }}{{ match.kind }} fingering
                </span>
              </p>

              <p v-if="match.comment" class="mt-2 text-xs leading-relaxed text-ink-400">
                {{ match.comment }}
              </p>

              <RouterLink
                :to="{ name: 'note', params: { note: canonicalNote(match.midi) } }"
                class="mt-3 inline-block text-xs font-medium text-brass-400 hover:text-brass-300"
              >
                All ways to play this note →
              </RouterLink>
            </li>
          </ul>
        </section>

        <!-- Near misses -->
        <section v-else class="space-y-3">
          <div class="rounded-xl border border-ink-700 bg-ink-900 px-4 py-4">
            <p class="text-sm text-ink-200">No documented note for this combination.</p>
            <p class="mt-1 text-xs text-ink-400">
              Plenty of key combinations produce no usable pitch on the flute.
            </p>
          </div>

          <div v-if="suggestions.length" class="space-y-2">
            <h2 class="text-xs font-semibold uppercase tracking-wider text-ink-400">Did you mean</h2>
            <ul class="space-y-2">
              <li v-for="suggestion in suggestions" :key="suggestion.fingering.id">
                <button
                  type="button"
                  class="flex w-full items-center gap-3 rounded-xl border border-ink-700 bg-ink-900 px-4 py-3 text-left transition-colors hover:border-brass-400"
                  @click="selected = [...suggestion.fingering.keys]"
                >
                  <NoteBadge :note="suggestion.fingering.note" />
                  <span class="ml-auto text-xs text-ink-400">
                    {{ suggestion.distance }}
                    {{ suggestion.distance === 1 ? 'key' : 'keys' }} away
                  </span>
                </button>
              </li>
            </ul>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>
