<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import InstrumentSwitch from '@/components/InstrumentSwitch.vue'
import { useSettingsStore } from '@/stores/settings'

/**
 * App shell. Bottom tab bar on phones, left sidebar from `md` up — one
 * breakpoint, because the content itself is identical either way.
 */

const route = useRoute()
const settings = useSettingsStore()

const TABS = [
  {
    name: 'finder',
    label: 'Fingering',
    icon: 'M5 3v18M12 3v18M19 3v18M2 8h20M2 16h20',
  },
  {
    name: 'notes',
    label: 'Notes',
    icon: 'M9 18V5l10-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm10-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  },
  {
    name: 'sheets',
    label: 'Sheets',
    icon: 'M5 3h9l5 5v13H5zM14 3v5h5',
  },
  {
    name: 'ear',
    label: 'Ear',
    // Headphones.
    icon: 'M4 15v-3a8 8 0 0 1 16 0v3M4 15h3v5H5a1 1 0 0 1-1-1zM20 15h-3v5h2a1 1 0 0 0 1-1z',
  },
  {
    name: 'settings',
    label: 'Setup',
    icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.7-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.7 14H3.4a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.2-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 10 3.7V3.4a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1A1.6 1.6 0 0 0 20.3 10h.3a2 2 0 1 1 0 4h-.2Z',
  },
] as const

/** A detail route keeps its parent tab lit. */
const activeTab = computed(
  () => (route.meta.parent as string | undefined) ?? (route.name as string | undefined),
)
</script>

<template>
  <div class="min-h-svh md:flex">
    <nav
      class="fixed inset-x-0 bottom-0 z-20 flex border-t border-ink-800 bg-ink-900/95 backdrop-blur md:static md:min-h-svh md:w-56 md:shrink-0 md:flex-col md:border-t-0 md:border-r"
      style="padding-bottom: var(--safe-bottom)"
      aria-label="Main navigation"
    >
      <div class="hidden space-y-3 px-5 py-6 md:block">
        <div>
          <p class="text-lg font-semibold text-ink-50">FluteApp</p>
          <p class="text-xs text-ink-400">{{ settings.instrument.name }} reference</p>
        </div>
        <InstrumentSwitch />
      </div>

      <RouterLink
        v-for="tab in TABS"
        :key="tab.name"
        :to="{ name: tab.name }"
        class="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors md:flex-none md:flex-row md:gap-3 md:px-5 md:py-3 md:text-sm"
        :class="
          activeTab === tab.name ? 'text-accent-400 md:bg-ink-800' : 'text-ink-400 hover:text-ink-200'
        "
      >
        <svg
          viewBox="0 0 24 24"
          class="h-5 w-5"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path :d="tab.icon" />
        </svg>
        <span>{{ tab.label }}</span>
      </RouterLink>
    </nav>

    <div class="min-w-0 flex-1">
      <!-- Phones have no sidebar, so the instrument switch lives in a top bar. -->
      <header
        class="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-ink-800 bg-ink-900/95 px-4 py-2.5 backdrop-blur md:hidden"
      >
        <p class="text-sm font-semibold text-ink-50">FluteApp</p>
        <InstrumentSwitch class="w-48" />
      </header>

      <main class="mx-auto w-full max-w-3xl px-4 pt-5 pb-28 md:max-w-4xl md:px-10 md:py-9">
        <RouterView />
      </main>
    </div>
  </div>
</template>
