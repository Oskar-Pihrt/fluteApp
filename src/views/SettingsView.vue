<script setup lang="ts">
import { ref } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import { useSheetsStore } from '@/stores/sheets'

/** Instrument setup, audio preference, and the backup that stands in for cloud sync. */

const settings = useSettingsStore()
const sheets = useSheetsStore()

const importInput = ref<HTMLInputElement | null>(null)
const status = ref<{ kind: 'ok' | 'error'; message: string } | null>(null)
const working = ref(false)

async function exportBackup() {
  working.value = true
  status.value = null
  try {
    const blob = await sheets.exportBackup()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `fluteapp-backup-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    status.value = { kind: 'ok', message: 'Backup downloaded.' }
  } catch (cause) {
    status.value = {
      kind: 'error',
      message: cause instanceof Error ? cause.message : 'Export failed.',
    }
  } finally {
    working.value = false
  }
}

async function onImport(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  working.value = true
  status.value = null
  try {
    const added = await sheets.importBackup(file)
    status.value = {
      kind: 'ok',
      message: added
        ? `Restored ${added} ${added === 1 ? 'sheet' : 'sheets'}.`
        : 'Nothing new to restore — those sheets are already here.',
    }
  } catch (cause) {
    status.value = {
      kind: 'error',
      message: cause instanceof Error ? cause.message : 'Import failed.',
    }
  } finally {
    working.value = false
  }
}
</script>

<template>
  <div class="space-y-7">
    <header>
      <h1 class="text-xl">Setup</h1>
      <p class="mt-1 text-sm text-ink-400">
        Tell the app about your {{ settings.instrument.noun }}. Switch instrument at the top.
      </p>
    </header>

    <template v-if="settings.instrumentId === 'flute'">
    <section class="space-y-3">
      <h2 class="text-xs font-semibold uppercase tracking-wider text-ink-400">Footjoint</h2>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="option in (['C', 'B'] as const)"
          :key="option"
          type="button"
          class="rounded-xl border px-4 py-3 text-left transition-colors"
          :class="
            settings.footJoint === option
              ? 'border-accent-400 bg-ink-800'
              : 'border-ink-700 hover:border-ink-400'
          "
          @click="settings.footJoint = option"
        >
          <span class="block text-sm font-semibold text-ink-50">{{ option }} foot</span>
          <span class="mt-0.5 block text-xs text-ink-400">
            {{ option === 'C' ? 'Lowest note C4' : 'Lowest note B3, plus gizmo key' }}
          </span>
        </button>
      </div>
    </section>

    <section class="space-y-3">
      <h2 class="text-xs font-semibold uppercase tracking-wider text-ink-400">Holes</h2>
      <label
        class="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-700 px-4 py-3 transition-colors hover:border-ink-400"
      >
        <input
          v-model="settings.openHole"
          type="checkbox"
          class="mt-0.5 h-4 w-4 shrink-0 accent-accent-400"
        />
        <span>
          <span class="block text-sm font-semibold text-ink-50">Open hole (French)</span>
          <span class="mt-0.5 block text-xs text-ink-400">
            Unlocks fingerings that need a partly uncovered tone hole.
          </span>
        </span>
      </label>
    </section>
    </template>

    <section v-else class="space-y-3">
      <h2 class="text-xs font-semibold uppercase tracking-wider text-ink-400">Keys</h2>
      <label
        class="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-700 px-4 py-3 transition-colors hover:border-ink-400"
      >
        <input
          v-model="settings.saxHighFSharp"
          type="checkbox"
          class="mt-0.5 h-4 w-4 shrink-0 accent-accent-400"
        />
        <span>
          <span class="block text-sm font-semibold text-ink-50">High F♯ key</span>
          <span class="mt-0.5 block text-xs text-ink-400">
            Adds the top F♯ (written F♯6) that needs the C5 key.
          </span>
        </span>
      </label>
    </section>

    <section class="space-y-3">
      <h2 class="text-xs font-semibold uppercase tracking-wider text-ink-400">Sound</h2>
      <label
        class="flex cursor-pointer items-start gap-3 rounded-xl border border-ink-700 px-4 py-3 transition-colors hover:border-ink-400"
      >
        <input
          v-model="settings.audioEnabled"
          type="checkbox"
          class="mt-0.5 h-4 w-4 shrink-0 accent-accent-400"
        />
        <span>
          <span class="block text-sm font-semibold text-ink-50">Play note previews</span>
          <span class="mt-0.5 block text-xs text-ink-400">
            A synthesised tone at the pitch the instrument sounds — for checking the pitch, not the timbre.
          </span>
        </span>
      </label>
    </section>

    <section class="space-y-3">
      <h2 class="text-xs font-semibold uppercase tracking-wider text-ink-400">Your library</h2>
      <p class="text-xs leading-relaxed text-ink-400">
        Everything is stored on this device only — nothing is uploaded anywhere. Export a backup to
        move your sheets to another phone or computer, or to keep them safe.
      </p>
      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 rounded-lg border border-ink-600 px-4 py-2.5 text-sm font-medium text-ink-200 transition-colors hover:border-accent-400 disabled:opacity-50"
          :disabled="working"
          @click="exportBackup"
        >
          Export backup
        </button>
        <button
          type="button"
          class="flex-1 rounded-lg border border-ink-600 px-4 py-2.5 text-sm font-medium text-ink-200 transition-colors hover:border-accent-400 disabled:opacity-50"
          :disabled="working"
          @click="importInput?.click()"
        >
          Import backup
        </button>
        <input
          ref="importInput"
          type="file"
          accept="application/json,.json"
          class="hidden"
          @change="onImport"
        />
      </div>
      <p
        v-if="status"
        class="rounded-lg border px-3 py-2 text-xs"
        :class="
          status.kind === 'ok'
            ? 'border-ink-600 text-ink-200'
            : 'border-red-500/40 bg-red-500/10 text-red-200'
        "
      >
        {{ status.message }}
      </p>
    </section>

    <section class="space-y-2 border-t border-ink-800 pt-5">
      <h2 class="text-xs font-semibold uppercase tracking-wider text-ink-400">Fingering data</h2>
      <p class="text-xs leading-relaxed text-ink-400">
        {{ settings.instrumentId === 'flute' ? 'Fingerings are transcribed from' : 'Fingerings follow the standard charts; compare with' }}
        <a
          :href="
            settings.instrumentId === 'flute'
              ? 'https://www.wfg.woodwind.org/flute/'
              : 'https://www.wfg.woodwind.org/sax/'
          "
          target="_blank"
          rel="noreferrer"
          class="text-accent-400"
          >The Woodwind Fingering Guide</a
        >
        basic charts for {{ settings.instrumentId === 'flute' ? 'flute, octaves 1–3' : 'saxophone' }}.
        Entries flagged
        <span class="text-amber-200">Needs checking</span> in the note library had an ambiguous
        source and are worth confirming against your own playing.
      </p>
    </section>
  </div>
</template>
