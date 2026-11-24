<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'
import Icon from './Icon.vue'
import { t, type MsgKey } from '@/lib/i18n'

const route = useRoute()
const tabs: { to: string; icon: 'home' | 'snake' | 'calendar' | 'ruler' | 'more'; label: MsgKey; match: string[] }[] = [
  { to: '/', icon: 'home', label: 'home', match: ['home'] },
  { to: '/snakes', icon: 'snake', label: 'snakes', match: ['snakes', 'snake'] },
  { to: '/calendar', icon: 'calendar', label: 'calendar', match: ['calendar'] },
  { to: '/measure', icon: 'ruler', label: 'measure', match: ['measure'] },
  { to: '/more', icon: 'more', label: 'more', match: ['more', 'guide'] },
]
</script>

<template>
  <nav class="fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
    <div class="flex w-full max-w-xl items-center justify-between rounded-full border border-line bg-surface/85 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl">
      <RouterLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="flex flex-1 flex-col items-center gap-0.5 rounded-full py-2 text-[11px] font-semibold transition-colors"
        :class="tab.match.includes(String(route.name)) ? 'bg-accent text-accent-ink' : 'text-muted'"
      >
        <Icon :name="tab.icon" />
        {{ t(tab.label) }}
      </RouterLink>
    </div>
  </nav>
</template>
