<script setup lang="ts">
import { computed } from 'vue'
import { days, t } from '@/lib/i18n'
import type { FeedStatus } from '@/lib/schedule'

const props = defineProps<{ status: FeedStatus }>()
const info = computed(() => {
  const s = props.status
  if (s.state === 'never') return { text: t('neverFed'), cls: 'bg-white/10 text-muted' }
  if (s.state === 'overdue') return { text: t('overdueBy', { d: days(s.daysUntil!) }), cls: 'bg-danger/20 text-danger' }
  if (s.state === 'today') return { text: t('dueToday'), cls: 'bg-amber/20 text-amber' }
  return { text: t('inDays', { d: days(s.daysUntil!) }), cls: 'bg-accent/15 text-accent' }
})
</script>

<template>
  <span class="inline-block rounded-full px-2.5 py-1 text-xs font-semibold" :class="info.cls">{{ info.text }}</span>
</template>
