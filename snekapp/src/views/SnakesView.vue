<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import Avatar from '@/components/Avatar.vue'
import FeedBadge from '@/components/FeedBadge.vue'
import SnakeForm from '@/components/SnakeForm.vue'
import Icon from '@/components/Icon.vue'
import { snakes, events } from '@/lib/store'
import { feedingStatus } from '@/lib/schedule'
import { speciesByKey } from '@/lib/species'
import { ageText } from '@/lib/format'
import { locale, t } from '@/lib/i18n'

const router = useRouter()
const formOpen = ref(false)
const list = computed(() =>
  snakes.value.map((snake) => ({
    snake,
    st: feedingStatus(events.value.filter((e) => e.snakeId === snake.id), snake.feedEveryDays),
    sp: speciesByKey(snake.species),
  })),
)
</script>

<template>
  <header class="mb-5 flex items-center justify-between pt-2">
    <h1 class="text-4xl font-extrabold">{{ t('snakes') }}</h1>
    <button class="btn btn-primary btn-sm" @click="formOpen = true"><Icon name="plus" /> {{ t('add') }}</button>
  </header>

  <p v-if="!snakes.length" class="card p-6 text-center text-muted">{{ t('noSnakes') }}</p>

  <div class="grid grid-cols-2 gap-3">
    <RouterLink v-for="{ snake, st, sp } in list" :key="snake.id" :to="`/snake/${snake.id}`" class="card flex flex-col items-center p-4 text-center transition active:scale-[.98]">
      <Avatar :snake="snake" class="h-24 w-24" />
      <div class="mt-3 w-full truncate text-lg font-bold">{{ snake.name }}</div>
      <div class="w-full truncate text-xs text-muted">{{ locale === 'cs' ? sp.cs : sp.en }}<template v-if="snake.morph"> · {{ snake.morph }}</template></div>
      <div class="mt-1 text-xs text-muted">{{ ageText(snake.birthDate) }}</div>
      <div class="mt-3"><FeedBadge :status="st" /></div>
    </RouterLink>
  </div>

  <SnakeForm :open="formOpen" @close="formOpen = false" @saved="(id) => router.push(`/snake/${id}`)" />
</template>
