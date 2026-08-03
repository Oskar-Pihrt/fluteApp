<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Note } from 'tonal'
import NoteBadge from '@/components/NoteBadge.vue'
import NoteFingerings from '@/components/NoteFingerings.vue'
import { fingeringsForNote, noteRange } from '@/domain/lookup'
import { useSettingsStore } from '@/stores/settings'

/** Feature 2 — the whole range, grouped by octave. Tapping a note unfolds its
 *  fingerings in place rather than navigating to a new page. */

const settings = useSettingsStore()

const octaves = computed(() => {
  const groups = new Map<number, { note: string; midi: number; count: number }[]>()
  for (const entry of noteRange(settings.fluteConfig)) {
    const octave = Note.get(entry.note).oct ?? 0
    const count = fingeringsForNote(entry.note, settings.fluteConfig).length
    const bucket = groups.get(octave)
    const item = { ...entry, count }
    if (bucket) bucket.push(item)
    else groups.set(octave, [item])
  }
  return [...groups.entries()].map(([octave, notes]) => ({ octave, notes }))
})

/** Registers are how flutists actually think about the range. */
const REGISTER_NAMES: Record<number, string> = {
  3: 'Low register',
  4: 'Low register',
  5: 'Middle register',
  6: 'High register',
  7: 'High register',
}

/** Only one note unfolded at a time — opening another folds the previous one. */
const expanded = ref<string | null>(null)

function toggle(note: string) {
  expanded.value = expanded.value === note ? null : note
}

function octaveOf(note: string): number {
  return Note.get(note).oct ?? 0
}
</script>

<template>
  <div class="space-y-7">
    <header>
      <h1 class="text-xl">Note library</h1>
      <p class="mt-1 text-sm text-ink-400">
        Every note in range, with all the documented ways to play it.
      </p>
    </header>

    <section v-for="group in octaves" :key="group.octave" class="space-y-3">
      <h2 class="flex items-baseline gap-2 text-xs font-semibold uppercase tracking-wider text-ink-400">
        Octave {{ group.octave }}
        <span class="font-normal normal-case tracking-normal text-ink-600">
          {{ REGISTER_NAMES[group.octave] }}
        </span>
      </h2>

      <ul class="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        <li v-for="entry in group.notes" :key="entry.midi">
          <button
            type="button"
            class="flex w-full flex-col items-center gap-0.5 rounded-xl border px-2 py-3 transition-colors"
            :class="
              expanded === entry.note
                ? 'border-brass-400 bg-ink-800'
                : 'border-ink-700 bg-ink-900 hover:border-brass-400'
            "
            :aria-expanded="expanded === entry.note"
            @click="toggle(entry.note)"
          >
            <NoteBadge :note="entry.note" />
            <span class="text-[11px] text-ink-400">
              {{ entry.count }} {{ entry.count === 1 ? 'way' : 'ways' }}
            </span>
          </button>
        </li>
      </ul>

      <!-- Unfolds in place — a CSS grid-rows trick gives a smooth height
           transition without measuring the panel in JS. -->
      <div
        class="grid transition-[grid-template-rows] duration-300 ease-in-out"
        :class="expanded && octaveOf(expanded) === group.octave ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'"
      >
        <div class="overflow-hidden">
          <NoteFingerings
            v-if="expanded && octaveOf(expanded) === group.octave"
            :note="expanded"
            class="rounded-xl border border-ink-700 bg-ink-900/60 p-4"
          />
        </div>
      </div>
    </section>

    <p class="rounded-xl border border-ink-800 px-4 py-3 text-xs leading-relaxed text-ink-400">
      Showing the range for a
      <strong class="text-ink-200">{{ settings.footJoint }} footjoint</strong>
      flute. Change it in
      <RouterLink :to="{ name: 'settings' }" class="text-brass-400">Setup</RouterLink>
      to include low B and the gizmo key.
    </p>
  </div>
</template>
