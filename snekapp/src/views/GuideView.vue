<script setup lang="ts">
import { RouterLink } from 'vue-router'
import Icon from '@/components/Icon.vue'
import SnakeArt from '@/components/SnakeArt.vue'
import { SPECIES } from '@/lib/species'
import { days, locale, t, type MsgKey } from '@/lib/i18n'

const list = SPECIES.filter((s) => s.key !== 'other')
</script>

<template>
  <header class="mb-5 pt-2">
    <RouterLink to="/more" class="btn btn-sm !px-3"><Icon name="back" /> {{ t('more') }}</RouterLink>
    <h1 class="mt-3 text-4xl font-extrabold">{{ t('guide') }}</h1>
  </header>
  <div class="space-y-3">
    <article v-for="s in list" :key="s.key" class="card p-4">
      <div class="flex items-center gap-3">
        <div class="h-14 w-14 shrink-0"><SnakeArt :color="s.color" :id="list.indexOf(s)" /></div>
        <div class="min-w-0">
          <h2 class="truncate text-lg font-bold">{{ locale === 'cs' ? s.cs : s.en }}</h2>
          <div class="truncate text-xs italic text-muted">{{ s.latin }}</div>
        </div>
      </div>
      <dl class="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
        <div class="rounded-xl bg-black/25 p-2"><dt class="text-[10px] font-bold uppercase text-muted">{{ t('hotspot') }}</dt><dd class="font-bold text-amber">{{ s.hotspot[0] }}–{{ s.hotspot[1] }}°</dd></div>
        <div class="rounded-xl bg-black/25 p-2"><dt class="text-[10px] font-bold uppercase text-muted">{{ t('coolSide') }}</dt><dd class="font-bold text-sky-300">{{ s.cool[0] }}–{{ s.cool[1] }}°</dd></div>
        <div class="rounded-xl bg-black/25 p-2"><dt class="text-[10px] font-bold uppercase text-muted">{{ t('humidity') }}</dt><dd class="font-bold text-accent">{{ s.humidity[0] }}–{{ s.humidity[1] }}%</dd></div>
      </dl>
      <p class="mt-3 text-sm text-muted">
        {{ t('adultSize') }} {{ s.adultCm[0] }}–{{ s.adultCm[1] }} {{ t('cm') }} · {{ t('juvenile') }} {{ t('everyN', { d: days(s.feedJuvenileDays) }) }}, {{ t('adult') }} {{ t('everyN', { d: days(s.feedAdultDays) }) }} · {{ t(('level_' + s.difficulty) as MsgKey) }}
      </p>
    </article>
  </div>
  <p class="mt-4 px-2 text-center text-xs text-muted">{{ t('disclaimer') }}</p>
</template>
