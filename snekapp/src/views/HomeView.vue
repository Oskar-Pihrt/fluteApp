<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import Avatar from '@/components/Avatar.vue'
import FeedBadge from '@/components/FeedBadge.vue'
import EventSheet from '@/components/EventSheet.vue'
import SnakeForm from '@/components/SnakeForm.vue'
import SnakeArt from '@/components/SnakeArt.vue'
import Icon from '@/components/Icon.vue'
import { snakes, events, tasks, ready, toggleTask } from '@/lib/store'
import { feedingStatus } from '@/lib/schedule'
import { addDays, diffDays, localeTag, todayISO } from '@/lib/dates'
import { relativeDays } from '@/lib/format'
import { loadDemoData } from '@/lib/seed'
import { locale, t } from '@/lib/i18n'

const router = useRouter()
const today = todayISO()
const feedOpen = ref(false)
const feedFor = ref<number | undefined>()
const formOpen = ref(false)

const rows = computed(() =>
  snakes.value
    .map((snake) => ({ snake, st: feedingStatus(events.value.filter((e) => e.snakeId === snake.id), snake.feedEveryDays, today) }))
    .sort((a, b) => (a.st.daysUntil ?? -999) - (b.st.daysUntil ?? -999)),
)
const attention = computed(() => rows.value.filter((r) => r.st.state !== 'ok'))
const soon = computed(() => rows.value.filter((r) => r.st.state === 'ok' && r.st.daysUntil! <= 7))
const dueTasks = computed(() => tasks.value.filter((tk) => !tk.done && tk.date <= today))

const since = (n: number) => addDays(today, -n)
const meals30 = computed(() => events.value.filter((e) => e.type === 'feed' && !e.refused && e.date >= since(30)).length)
const sheds90 = computed(() => events.value.filter((e) => e.type === 'shed' && e.date >= since(90)).length)
const dateLabel = new Date().toLocaleDateString(localeTag(locale.value), { weekday: 'long', day: 'numeric', month: 'long' })

function logFeed(id: number) {
  feedFor.value = id
  feedOpen.value = true
}
const snakeName = (id?: number) => snakes.value.find((s) => s.id === id)?.name
</script>

<template>
  <header class="mb-6 pt-2">
    <p class="text-sm font-semibold text-muted first-letter:uppercase">{{ dateLabel }}</p>
    <h1 class="mt-1 text-4xl font-extrabold">{{ t('greeting') }} <span class="inline-block origin-bottom-right">🐍</span></h1>
  </header>

  <template v-if="ready">
    <!-- first run -->
    <section v-if="!snakes.length" class="card overflow-hidden p-6 text-center">
      <div class="mx-auto mb-2 h-44 w-44"><SnakeArt color="#5be37d" /></div>
      <h2 class="text-2xl font-bold">{{ t('welcomeTitle') }}</h2>
      <p class="mx-auto mt-2 max-w-xs text-muted">{{ t('welcomeText') }}</p>
      <div class="mt-5 flex flex-col gap-2">
        <button class="btn btn-primary" @click="formOpen = true"><Icon name="plus" /> {{ t('addFirst') }}</button>
        <button class="btn" @click="loadDemoData">{{ t('tryDemo') }}</button>
      </div>
    </section>

    <template v-else>
      <section class="mb-6 grid grid-cols-3 gap-3">
        <div v-for="s in [{ n: snakes.length, l: t('statSnakes') }, { n: meals30, l: t('statFeeds') }, { n: sheds90, l: t('statSheds') }]" :key="s.l" class="card px-3 py-4 text-center">
          <div class="font-display text-3xl font-extrabold text-accent">{{ s.n }}</div>
          <div class="mt-0.5 text-[11px] font-semibold text-muted">{{ s.l }}</div>
        </div>
      </section>

      <section class="mb-6">
        <h2 class="mb-3 text-lg font-bold">{{ t('dueNow') }}</h2>
        <div v-if="!attention.length && !dueTasks.length" class="card flex items-center gap-3 p-4 text-muted">
          <span class="text-2xl">✨</span> {{ t('allGood') }}
        </div>
        <div class="space-y-2.5">
          <div v-for="r in attention" :key="r.snake.id" class="card flex items-center gap-3 p-3">
            <RouterLink :to="`/snake/${r.snake.id}`" class="flex min-w-0 flex-1 items-center gap-3">
              <Avatar :snake="r.snake" class="h-12 w-12 shrink-0" />
              <div class="min-w-0">
                <div class="truncate font-bold">{{ r.snake.name }}</div>
                <FeedBadge :status="r.st" />
              </div>
            </RouterLink>
            <button class="btn btn-sm btn-primary" @click="logFeed(r.snake.id!)">🐭 {{ t('fedBtn') }}</button>
          </div>
          <button v-for="tk in dueTasks" :key="tk.id" class="card flex w-full items-center gap-3 p-3 text-left" @click="toggleTask(tk, today)">
            <span class="grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 border-accent/60" />
            <div class="min-w-0 flex-1">
              <div class="truncate font-semibold">{{ tk.title }}</div>
              <div class="text-xs text-muted">{{ snakeName(tk.snakeId) }}<template v-if="snakeName(tk.snakeId)"> · </template>{{ relativeDays(Math.max(0, diffDays(tk.date, today))) }}</div>
            </div>
          </button>
        </div>
      </section>

      <section v-if="soon.length" class="mb-6">
        <h2 class="mb-3 text-lg font-bold">{{ t('upcoming') }}</h2>
        <div class="space-y-2.5">
          <RouterLink v-for="r in soon" :key="r.snake.id" :to="`/snake/${r.snake.id}`" class="card flex items-center gap-3 p-3">
            <Avatar :snake="r.snake" class="h-12 w-12 shrink-0" />
            <div class="min-w-0 flex-1">
              <div class="truncate font-bold">{{ r.snake.name }}</div>
              <div class="text-xs text-muted">{{ t('lastMeal') }}: {{ relativeDays(diffDays(r.st.lastFed!, today)) }}</div>
            </div>
            <FeedBadge :status="r.st" />
          </RouterLink>
        </div>
      </section>
    </template>
  </template>

  <EventSheet :open="feedOpen" :snake-id="feedFor" type="feed" @close="feedOpen = false" />
  <SnakeForm :open="formOpen" @close="formOpen = false" @saved="(id) => router.push(`/snake/${id}`)" />
</template>
