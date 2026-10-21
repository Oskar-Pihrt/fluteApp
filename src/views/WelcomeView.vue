<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppLogo from '@/components/AppLogo.vue'
import BottomSheet from '@/components/BottomSheet.vue'
import InstrumentPicker from '@/components/InstrumentPicker.vue'
import { CATALOG, getMeta, type InstrumentId } from '@/instruments'
import { installed, installPlatform, installPrompt, promptInstall, runsInstalled } from '@/platform/install'
import { useSettingsStore } from '@/stores/settings'

/**
 * First launch, on one screen: what the app is, which instruments the player
 * plays, and Start. The common instruments are a tap each; the whole catalog
 * is behind "All instruments". Only the chosen ones go in the switch and get
 * downloaded — the rest stay one tap away in Setup.
 */

const router = useRouter()
const settings = useSettingsStore()

/** The instruments most players are looking for. */
const COMMON: InstrumentId[] = ['flute', 'altoSax', 'clarinetBb', 'recorderSopranoBaroque', 'trumpetBb', 'oboe']
/** Short names that still say which instrument it is ("Alto" alone doesn't). */
const LABELS: Partial<Record<InstrumentId, string>> = { altoSax: 'Alto sax', recorderSopranoBaroque: 'Recorder' }
function label(id: InstrumentId): string {
  return LABELS[id] ?? getMeta(id).shortName
}
const total = Object.keys(CATALOG).length

const chosen = ref<InstrumentId[]>([...settings.visibleInstruments])
const browsing = ref(false)
const working = ref(false)
const failed = ref(false)

const platform = installPlatform()
const showInstall = !runsInstalled()

function toggle(id: InstrumentId, on: boolean) {
  chosen.value = on ? [...chosen.value, id] : chosen.value.filter((other) => other !== id)
}

const startLabel = computed(() => {
  if (working.value) return 'Downloading…'
  if (chosen.value.length === 1) return `Start with ${label(chosen.value[0])}`
  return `Start · ${chosen.value.length} instruments`
})

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
  <div class="mx-auto flex min-h-[calc(100svh-2.75rem)] max-w-md flex-col gap-7">
    <header>
      <AppLogo :size="56" />
      <h1 class="mt-4 text-[28px] leading-tight font-bold">Fingerings for every note you read</h1>
      <p class="mt-2 text-sm leading-relaxed text-ink-400">
        Look up a fingering, photograph your sheet music, train your ear. No account, nothing uploaded, works
        offline.
      </p>
    </header>

    <section class="space-y-2.5">
      <h2 class="text-base">What do you play?</h2>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="id in COMMON"
          :key="id"
          type="button"
          class="flex h-14 items-center gap-2.5 border px-3 text-left text-sm text-ink-50 transition-colors"
          :class="chosen.includes(id) ? 'border-accent-400 bg-ink-800' : 'border-ink-700 hover:border-ink-400'"
          :aria-pressed="chosen.includes(id)"
          :disabled="chosen.length === 1 && chosen.includes(id)"
          @click="toggle(id, !chosen.includes(id))"
        >
          <span
            class="flex h-[18px] w-[18px] shrink-0 items-center justify-center border-2"
            :class="chosen.includes(id) ? 'border-accent-400 bg-accent-400 text-ink-950' : 'border-ink-600'"
            aria-hidden="true"
          >
            <svg v-if="chosen.includes(id)" viewBox="0 0 24 24" class="h-3 w-3" fill="none" stroke="currentColor" stroke-width="4">
              <path d="M5 12l5 5L20 7" />
            </svg>
          </span>
          {{ label(id) }}
        </button>
      </div>
      <button type="button" class="py-1 text-sm text-accent-400 hover:text-accent-300" @click="browsing = true">
        All {{ total }} instruments<template v-if="chosen.some((id) => !COMMON.includes(id))">
          · {{ chosen.filter((id) => !COMMON.includes(id)).length }} more chosen</template
        >
        →
      </button>
    </section>

    <div class="mt-auto space-y-3 pb-4">
      <p v-if="showInstall && !installed" class="text-xs leading-relaxed text-ink-400">
        <button
          v-if="installPrompt"
          type="button"
          class="font-semibold text-accent-400 hover:text-accent-300"
          @click="promptInstall()"
        >
          Install TimbreMap
        </button>
        <template v-else-if="platform === 'ios'">Tip: Share → Add to Home Screen installs it like an app.</template>
        <template v-else-if="platform === 'android'">Tip: ⋮ → Install app puts it on your home screen.</template>
        <template v-else>Tip: the install icon in the address bar makes it an app.</template>
        <template v-if="installPrompt"> — its own icon, full screen, works offline.</template>
      </p>
      <p class="text-xs text-ink-400">Only the instruments you pick are downloaded. Add more later in Setup.</p>
      <p v-if="failed" role="alert" class="text-xs text-red-300">
        Couldn’t download your instruments — check your connection and try again.
      </p>
      <button
        type="button"
        class="h-14 w-full bg-accent-400 text-base font-bold text-ink-950 transition-colors hover:bg-accent-300 disabled:opacity-50"
        :disabled="working || !chosen.length"
        @click="start"
      >
        {{ startLabel }}
      </button>
    </div>

    <BottomSheet :open="browsing" label="All instruments" @close="browsing = false">
      <div class="space-y-3 px-4">
        <h2 class="text-lg">All instruments</h2>
        <InstrumentPicker :selected="chosen" @toggle="toggle" />
        <button
          type="button"
          class="h-12 w-full bg-accent-400 text-sm font-semibold text-ink-950 hover:bg-accent-300"
          @click="browsing = false"
        >
          Done
        </button>
      </div>
    </BottomSheet>
  </div>
</template>
