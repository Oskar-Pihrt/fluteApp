<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import AppLogo from '@/components/AppLogo.vue'
import InstrumentSwitch from '@/components/InstrumentSwitch.vue'
import { TABS } from '@/navigation'
import { useSettingsStore } from '@/stores/settings'

/**
 * App shell. Bottom tab bar on phones, left sidebar from `md` up — one
 * breakpoint, because the content itself is identical either way.
 */

const route = useRoute()
const settings = useSettingsStore()

/** A detail route keeps its parent tab lit. */
const activeTab = computed(
  () => (route.meta.parent as string | undefined) ?? (route.name as string | undefined),
)
/** First-launch screens stand alone, without navigation or the switch. */
const bare = computed(() => route.meta.bare === true)
/**
 * Full-screen pages (a sheet being read or edited) have their own top bar and
 * no tab bar on a phone: the score needs every pixel, and leaving is the back
 * arrow. The sidebar stays on wider screens.
 */
const immersive = computed(() => route.meta.immersive === true)
</script>

<template>
  <div class="min-h-svh md:flex">
    <nav
      v-if="!bare"
      class="fixed inset-x-0 bottom-0 z-20 border-t border-ink-800 bg-ink-900/95 backdrop-blur md:sticky md:top-0 md:flex md:h-svh md:overflow-y-auto md:w-56 md:shrink-0 md:flex-col md:border-t-0 md:border-r"
      :class="immersive ? 'hidden' : 'flex'"
      style="padding-bottom: var(--safe-bottom)"
      aria-label="Main navigation"
    >
      <div class="hidden space-y-3 px-5 py-6 md:block">
        <div class="flex items-center gap-3">
          <AppLogo :size="36" />
          <div class="min-w-0">
            <p class="text-lg font-semibold text-ink-50">TimbreMap</p>
            <p class="text-xs text-ink-400">{{ settings.instrument.name }} reference</p>
          </div>
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
        v-if="!bare && !immersive"
        class="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-ink-800 bg-ink-900/95 px-4 py-2.5 backdrop-blur md:hidden"
      >
        <p class="flex items-center gap-2 text-sm font-semibold text-ink-50">
          <AppLogo :size="22" aria-hidden="true" alt="" />
          TimbreMap
        </p>
        <InstrumentSwitch class="w-52" align="right" />
      </header>

      <main
        class="mx-auto w-full md:max-w-4xl md:px-10"
        :class="immersive ? '' : bare ? 'max-w-3xl px-4 pt-5 pb-6 md:py-9' : 'max-w-3xl px-4 pt-5 pb-28 md:py-9'"
      >
        <RouterView />
      </main>
    </div>
  </div>
</template>
