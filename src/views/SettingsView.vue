<script setup lang="ts">
import { ref } from 'vue'
import BottomSheet from '@/components/BottomSheet.vue'
import InstrumentPicker from '@/components/InstrumentPicker.vue'
import { getMeta, type InstrumentId, type InstrumentOption } from '@/instruments'
import { useSettingsStore } from '@/stores/settings'
import { useSheetsStore } from '@/stores/sheets'

/**
 * Instrument setup, audio preference, and the backup that stands in for cloud
 * sync. Each instrument the player plays is a card; what is on it (footjoint,
 * open holes, extra keys) is set with the chips on the card itself.
 */

const settings = useSettingsStore()
const sheets = useSheetsStore()

const importInput = ref<HTMLInputElement | null>(null)
const status = ref<{ kind: 'ok' | 'error'; message: string } | null>(null)
const working = ref(false)
const adding = ref(false)
const switchFailed = ref<InstrumentId | null>(null)

/** One chip per choice of a choice option, one per toggle option. */
function chips(id: InstrumentId) {
  return getMeta(id).options.flatMap((option: InstrumentOption) =>
    option.kind === 'choice'
      ? option.choices.map((choice, index) => ({
          key: `${option.heading}-${choice.label}`,
          label: choice.label,
          description: choice.description,
          on: settings.choiceIndex(id, option) === index,
          toggle: () => settings.setChoice(id, option, index),
        }))
      : [
          {
            key: option.heading,
            label: option.label,
            description: option.description,
            on: settings.hasRequirement(id, option.requirement),
            toggle: () => settings.setRequirement(id, option.requirement, !settings.hasRequirement(id, option.requirement)),
          },
        ],
  )
}

async function use(id: InstrumentId) {
  switchFailed.value = null
  try {
    await settings.selectInstrument(id)
  } catch {
    switchFailed.value = id
  }
}

async function exportBackup() {
  working.value = true
  status.value = null
  try {
    const blob = await sheets.exportBackup()
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `timbremap-backup-${new Date().toISOString().slice(0, 10)}.json`
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
  <div class="space-y-6">
    <header>
      <h1 class="text-2xl">Setup</h1>
      <p class="mt-0.5 text-sm text-ink-400">Your instruments, sound and backups</p>
    </header>

    <section id="instruments" class="scroll-mt-20 space-y-2.5" aria-label="Instruments">
      <article
        v-for="id in settings.visibleInstruments"
        :key="id"
        class="border bg-ink-900 p-4"
        :class="id === settings.instrumentId ? 'border-accent-400' : 'border-ink-800'"
      >
        <div class="flex items-center gap-3">
          <h2 class="min-w-0 flex-1 text-base">{{ getMeta(id).name }}</h2>
          <span
            v-if="id === settings.instrumentId"
            class="text-[11px] font-semibold tracking-wider text-accent-400 uppercase"
          >
            In use
          </span>
          <button
            v-else
            type="button"
            class="h-9 border border-ink-700 px-3 text-xs font-semibold text-ink-200 transition-colors hover:border-accent-400"
            @click="use(id)"
          >
            Use
          </button>
        </div>
        <p v-if="switchFailed === id" role="alert" class="mt-1 text-xs text-red-300">
          Couldn’t download it — you seem to be offline.
        </p>
        <div v-if="chips(id).length" class="mt-3 flex flex-wrap gap-1.5">
          <button
            v-for="chip in chips(id)"
            :key="chip.key"
            type="button"
            class="h-9 border px-3 text-xs transition-colors"
            :class="chip.on ? 'border-accent-400 bg-ink-800 text-ink-50' : 'border-ink-700 text-ink-400 hover:border-ink-400'"
            :aria-pressed="chip.on"
            :title="chip.description"
            @click="chip.toggle()"
          >
            {{ chip.label }}
          </button>
        </div>
        <button
          v-if="settings.visibleInstruments.length > 1"
          type="button"
          class="mt-3 text-xs text-ink-400 hover:text-red-300"
          @click="settings.setVisible(id, false)"
        >
          Remove
        </button>
      </article>

      <button
        type="button"
        class="flex h-12 w-full items-center justify-center gap-2 border border-dashed border-ink-600 text-sm text-accent-400 transition-colors hover:border-accent-400"
        @click="adding = true"
      >
        <svg viewBox="0 0 24 24" class="h-4 w-4" fill="none" stroke="currentColor" stroke-width="2.2" aria-hidden="true">
          <path d="M12 5v14M5 12h14" />
        </svg>
        Add an instrument
      </button>
    </section>

    <section class="grid grid-cols-2 gap-2" aria-label="Sound and backups">
      <label
        class="col-span-2 flex min-h-14 cursor-pointer items-center gap-3 border border-ink-800 px-4 transition-colors hover:border-ink-600"
      >
        <span class="min-w-0 flex-1">
          <span class="block text-sm text-ink-50">Note previews</span>
          <span class="block text-xs text-ink-400">A tone at the pitch the instrument sounds</span>
        </span>
        <input v-model="settings.audioEnabled" type="checkbox" class="h-5 w-5 shrink-0 accent-accent-400" />
      </label>
      <button
        type="button"
        class="h-14 border border-ink-800 text-sm text-ink-50 transition-colors hover:border-accent-400 disabled:opacity-50"
        :disabled="working"
        @click="exportBackup"
      >
        Export backup
      </button>
      <button
        type="button"
        class="h-14 border border-ink-800 text-sm text-ink-50 transition-colors hover:border-accent-400 disabled:opacity-50"
        :disabled="working"
        @click="importInput?.click()"
      >
        Import backup
      </button>
      <input ref="importInput" type="file" accept="application/json,.json" class="hidden" @change="onImport" />
      <p
        v-if="status"
        class="col-span-2 border px-3 py-2 text-xs"
        :class="status.kind === 'ok' ? 'border-ink-600 text-ink-200' : 'border-red-500/40 bg-red-500/10 text-red-200'"
      >
        {{ status.message }}
      </p>
      <p class="col-span-2 text-xs leading-relaxed text-ink-400">
        Everything stays on this device — nothing is uploaded. A backup moves your sheets to another phone or computer.
      </p>
    </section>

    <details class="border-t border-ink-800 pt-4">
      <summary class="cursor-pointer text-sm text-ink-200">About the fingering data</summary>
      <p class="mt-2 text-xs leading-relaxed text-ink-400">
        {{ settings.instrument.source.intro }}
        <a :href="settings.instrument.source.url" target="_blank" rel="noreferrer" class="text-accent-400">{{
          settings.instrument.source.linkText
        }}</a>
        {{ settings.instrument.source.outro }}
        Entries flagged <span class="text-amber-200">Needs checking</span> had an ambiguous source and are worth
        confirming against your own playing.
      </p>
    </details>

    <BottomSheet :open="adding" label="Instruments" @close="adding = false">
      <div class="space-y-3 px-4">
        <h2 class="text-lg">Your instruments</h2>
        <p class="text-xs leading-relaxed text-ink-400">
          Tick the ones you play — only they are downloaded to this device.
        </p>
        <InstrumentPicker
          :selected="settings.visibleInstruments"
          @toggle="(id, on) => settings.setVisible(id, on)"
        />
        <button
          type="button"
          class="h-12 w-full bg-accent-400 text-sm font-semibold text-ink-950 hover:bg-accent-300"
          @click="adding = false"
        >
          Done
        </button>
      </div>
    </BottomSheet>
  </div>
</template>
