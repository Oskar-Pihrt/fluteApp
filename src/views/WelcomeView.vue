<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLogo from '@/components/AppLogo.vue'
import InstrumentPicker from '@/components/InstrumentPicker.vue'
import type { InstrumentId } from '@/instruments'
import { TABS } from '@/navigation'
import { installed, installPlatform, installPrompt, promptInstall, runsInstalled } from '@/platform/install'
import { useSettingsStore } from '@/stores/settings'

/**
 * First launch, in three short steps: what the app is and what each tab does,
 * how to install it, and which instruments the player plays. Only those go in
 * the switch and get downloaded; the rest of the catalog stays one tap away
 * in Setup. The install step is skipped when the app already runs installed.
 */

const router = useRouter()
const settings = useSettingsStore()

type Step = 'about' | 'install' | 'instruments'
const steps: Step[] = runsInstalled() ? ['about', 'instruments'] : ['about', 'install', 'instruments']
const stepIndex = ref(0)
const step = computed(() => steps[stepIndex.value])

const platform = installPlatform()

const chosen = ref<InstrumentId[]>([...settings.visibleInstruments])
const working = ref(false)
const failed = ref(false)

function toggle(id: InstrumentId, on: boolean) {
  chosen.value = on ? [...chosen.value, id] : chosen.value.filter((other) => other !== id)
}

async function install() {
  if (await promptInstall()) stepIndex.value++
}

async function start() {
  working.value = true
  failed.value = false
  try {
    for (const id of chosen.value) await settings.setVisible(id, true)
    for (const id of [...settings.visibleInstruments]) {
      if (!chosen.value.includes(id)) await settings.setVisible(id, false)
    }
    await settings.selectInstrument(settings.visibleInstruments[0])
    settings.onboarded = true
    await router.replace({ name: 'finder' })
  } catch {
    failed.value = true
  } finally {
    working.value = false
  }
}
</script>

<template>
  <div class="mx-auto flex min-h-[calc(100svh-6rem)] max-w-md flex-col gap-6">
    <!-- Progress: one dot per step. -->
    <div class="flex justify-center gap-1.5" aria-hidden="true">
      <span
        v-for="(_, index) in steps"
        :key="index"
        class="h-1.5 rounded-full transition-all"
        :class="index === stepIndex ? 'w-6 bg-accent-400' : 'w-1.5 bg-ink-700'"
      />
    </div>

    <!-- 1 — What this is. -->
    <section v-if="step === 'about'" class="space-y-6">
      <header class="flex flex-col items-center gap-4 text-center">
        <AppLogo :size="88" />
        <div>
          <h1 class="text-2xl">Welcome to TimbreMap</h1>
          <p class="mt-1.5 text-sm leading-relaxed text-ink-400">
            A fingering reference and practice companion for wind instruments. Everything runs on
            your device — no account, nothing uploaded, and it works offline.
          </p>
        </div>
      </header>

      <ul class="space-y-2">
        <li
          v-for="tab in TABS"
          :key="tab.name"
          class="flex items-start gap-3 rounded-xl border border-ink-700 px-4 py-3"
        >
          <svg
            viewBox="0 0 24 24"
            class="mt-0.5 h-5 w-5 shrink-0 text-accent-400"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path :d="tab.icon" />
          </svg>
          <span>
            <span class="block text-sm font-semibold text-ink-50">{{ tab.label }}</span>
            <span class="mt-0.5 block text-xs leading-relaxed text-ink-400">{{ tab.about }}</span>
          </span>
        </li>
      </ul>
    </section>

    <!-- 2 — Put it on the home screen. -->
    <section v-else-if="step === 'install'" class="space-y-5">
      <header>
        <h1 class="text-2xl">Install it</h1>
        <p class="mt-1.5 text-sm leading-relaxed text-ink-400">
          TimbreMap is a web app you can install like any other: it gets its own icon, opens full
          screen and works without a connection. Nothing to download from a store.
        </p>
      </header>

      <p
        v-if="installed"
        class="rounded-xl border border-accent-400 bg-ink-800 px-4 py-3 text-sm text-ink-50"
      >
        Installed — you’ll find TimbreMap with your other apps.
      </p>

      <button
        v-else-if="installPrompt"
        type="button"
        class="w-full rounded-lg border border-accent-400 px-4 py-3 text-sm font-semibold text-accent-400 transition-colors hover:bg-ink-800"
        @click="install"
      >
        Install TimbreMap
      </button>

      <div class="space-y-2">
        <h2 class="text-xs font-semibold uppercase tracking-wider text-ink-400">
          {{ installPrompt ? 'Or by hand' : 'How' }}
        </h2>
        <ol class="space-y-2 text-sm leading-relaxed text-ink-200">
          <template v-if="platform === 'ios'">
            <li class="rounded-xl border border-ink-700 px-4 py-3">
              <strong class="text-ink-50">iPhone / iPad (Safari):</strong> tap
              <strong class="text-ink-50">Share</strong> (the square with an arrow), then
              <strong class="text-ink-50">Add to Home Screen</strong>.
            </li>
          </template>
          <template v-else-if="platform === 'android'">
            <li class="rounded-xl border border-ink-700 px-4 py-3">
              <strong class="text-ink-50">Android (Chrome):</strong> open the
              <strong class="text-ink-50">⋮</strong> menu and choose
              <strong class="text-ink-50">Install app</strong> (or
              <strong class="text-ink-50">Add to Home screen</strong>).
            </li>
          </template>
          <template v-else>
            <li class="rounded-xl border border-ink-700 px-4 py-3">
              <strong class="text-ink-50">Chrome or Edge:</strong> click the install icon at the
              right end of the address bar, or open the menu and choose
              <strong class="text-ink-50">Install TimbreMap</strong>.
            </li>
            <li class="rounded-xl border border-ink-700 px-4 py-3">
              <strong class="text-ink-50">Safari on a Mac:</strong>
              <strong class="text-ink-50">File → Add to Dock</strong>.
            </li>
          </template>
        </ol>
        <p class="text-xs leading-relaxed text-ink-400">
          Only the instruments you pick next are downloaded. Your sheets stay on this device — back
          them up from Setup.
        </p>
      </div>
    </section>

    <!-- 3 — Which instruments. -->
    <section v-else class="space-y-5">
      <header>
        <h1 class="text-2xl">What do you play?</h1>
        <p class="mt-1.5 text-sm leading-relaxed text-ink-400">
          Pick your instruments. They go in the switch at the top, and only they are downloaded —
          you can add or remove them any time in Setup.
        </p>
      </header>

      <InstrumentPicker :selected="chosen" @toggle="toggle" />

      <p v-if="failed" role="alert" class="text-xs text-red-300">
        Couldn’t download your instruments — check your connection and try again.
      </p>
    </section>

    <div class="mt-auto flex gap-2 pb-4">
      <button
        v-if="stepIndex > 0"
        type="button"
        class="rounded-lg border border-ink-600 px-4 py-3 text-sm font-medium text-ink-200 transition-colors hover:border-ink-400"
        @click="stepIndex--"
      >
        Back
      </button>
      <button
        v-if="step !== 'instruments'"
        type="button"
        class="flex-1 rounded-lg bg-accent-400 px-4 py-3 text-sm font-semibold text-ink-950 transition-colors hover:bg-accent-300"
        @click="stepIndex++"
      >
        {{ step === 'install' ? 'Next' : 'Get started' }}
      </button>
      <button
        v-else
        type="button"
        class="flex-1 rounded-lg bg-accent-400 px-4 py-3 text-sm font-semibold text-ink-950 transition-colors hover:bg-accent-300 disabled:opacity-50"
        :disabled="working || !chosen.length"
        @click="start"
      >
        {{ working ? 'Downloading…' : 'Start' }}
      </button>
    </div>
  </div>
</template>
