<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import Avatar from '@/components/Avatar.vue'
import FeedBadge from '@/components/FeedBadge.vue'
import EventSheet from '@/components/EventSheet.vue'
import SnakeForm from '@/components/SnakeForm.vue'
import LineChart from '@/components/LineChart.vue'
import Icon from '@/components/Icon.vue'
import MeasurementViewer from '@/components/MeasurementViewer.vue'
import { db } from '@/lib/db'
import { snakes, events, ready, deleteEvent, deleteSnake } from '@/lib/store'
import { feedingStatus } from '@/lib/schedule'
import { speciesByKey } from '@/lib/species'
import { eventMeta } from '@/lib/eventTypes'
import { ageText, eventSummary, relativeDays } from '@/lib/format'
import { diffDays, fmtDate, todayISO } from '@/lib/dates'
import { days, locale, t, type MsgKey } from '@/lib/i18n'
import type { EventType, Measurement } from '@/lib/types'

const props = defineProps<{ id: string }>()
const router = useRouter()

const snake = computed(() => snakes.value.find((s) => s.id === Number(props.id)))
const mine = computed(() => events.value.filter((e) => e.snakeId === Number(props.id)))
const sp = computed(() => (snake.value ? speciesByKey(snake.value.species) : null))
const status = computed(() => feedingStatus(mine.value, snake.value?.feedEveryDays ?? 10))

type Tab = 'timeline' | 'growth' | 'care' | 'info'
const tab = ref<Tab>('timeline')
const tabs: { id: Tab; label: MsgKey }[] = [
  { id: 'timeline', label: 'tabTimeline' }, { id: 'growth', label: 'tabGrowth' }, { id: 'care', label: 'tabCare' }, { id: 'info', label: 'tabInfo' },
]

const eventOpen = ref(false)
const eventType = ref<EventType>('feed')
const editOpen = ref(false)
function log(type: EventType) { eventType.value = type; eventOpen.value = true }

const timeline = computed(() => {
  const groups = new Map<string, typeof mine.value>()
  for (const e of [...mine.value].sort((a, b) => b.date.localeCompare(a.date) || (b.id ?? 0) - (a.id ?? 0))) {
    const key = e.date.slice(0, 7)
    ;(groups.get(key) ?? groups.set(key, []).get(key)!).push(e)
  }
  return [...groups].map(([key, items]) => ({ key, label: fmtDate(key + '-01', locale.value, { month: 'long', year: 'numeric' }), items }))
})

const series = (type: EventType) => mine.value.filter((e) => e.type === type && e.value).map((e) => ({ date: e.date, value: e.value! }))
const weights = computed(() => series('weight'))
const lengths = computed(() => series('length'))
const latest = (s: { date: string; value: number }[]) => [...s].sort((a, b) => a.date.localeCompare(b.date)).at(-1)

const measurements = ref<Measurement[]>([])
const viewing = ref<Measurement | null>(null)
const thumbs = ref<Record<number, string>>({})
watch([() => props.id, mine], async () => {
  Object.values(thumbs.value).forEach(URL.revokeObjectURL)
  const list = await db.measurements.where('snakeId').equals(Number(props.id)).reverse().sortBy('date')
  measurements.value = list
  thumbs.value = Object.fromEntries(list.map((m) => [m.id!, URL.createObjectURL(m.photo)]))
}, { immediate: true })

async function removeEvent(id: number) {
  const e = mine.value.find((x) => x.id === id)
  if (e && confirm(t('deleteEventConfirm'))) await deleteEvent(e)
}
async function removeSnake() {
  if (!snake.value || !confirm(t('deleteSnakeConfirm', { name: snake.value.name }))) return
  await deleteSnake(snake.value.id!)
  router.replace('/snakes')
}
const fmtRange = (r: [number, number], u: string) => (r[1] ? `${r[0]}–${r[1]} ${u}` : '—')
</script>

<template>
  <template v-if="snake && sp">
    <header class="relative -mx-4 -mt-4 mb-5 overflow-hidden rounded-b-[2.25rem] border-b border-line px-4 pt-[max(1.5rem,var(--sat))] pb-8" :style="{ background: `radial-gradient(90% 120% at 50% 0%, ${snake.color}44, transparent 70%)` }">
      <RouterLink to="/snakes" class="btn btn-sm !px-3"><Icon name="back" /> {{ t('snakes') }}</RouterLink>
      <div class="mt-3 flex flex-col items-center text-center">
        <Avatar :snake="snake" class="h-32 w-32" />
        <h1 class="mt-4 text-4xl font-extrabold">{{ snake.name }}</h1>
        <p class="mt-1 text-muted">{{ locale === 'cs' ? sp.cs : sp.en }}<template v-if="snake.morph"> · {{ snake.morph }}</template></p>
        <p class="mt-0.5 text-sm text-muted">{{ ageText(snake.birthDate) }} · {{ t(('sex_' + snake.sex) as 'sex_m') }}</p>
        <div class="mt-3"><FeedBadge :status="status" /></div>
      </div>

      <div class="mt-5 grid grid-cols-4 gap-2">
        <button v-for="a in (['feed', 'shed', 'weight'] as EventType[])" :key="a" class="card flex flex-col items-center gap-1 py-3 text-xs font-semibold active:scale-95" @click="log(a)">
          <span class="text-2xl">{{ eventMeta(a).icon }}</span>{{ t(('ev_' + a) as MsgKey) }}
        </button>
        <RouterLink :to="{ name: 'measure', query: { snake: snake.id } }" class="card flex flex-col items-center gap-1 py-3 text-xs font-semibold active:scale-95">
          <span class="text-2xl">📏</span>{{ t('measure') }}
        </RouterLink>
      </div>
    </header>

    <div class="mb-4 flex gap-1 rounded-full border border-line bg-black/20 p-1" role="tablist">
      <button v-for="x in tabs" :key="x.id" role="tab" :aria-selected="tab === x.id" class="flex-1 rounded-full py-2 text-sm font-semibold transition" :class="tab === x.id ? 'bg-accent text-accent-ink' : 'text-muted'" @click="tab = x.id">{{ t(x.label) }}</button>
    </div>

    <!-- timeline -->
    <section v-if="tab === 'timeline'">
      <div v-if="!timeline.length" class="card p-6 text-center text-muted">
        {{ t('noEvents') }}
        <button class="btn btn-primary mt-4" @click="log('feed')">{{ t('logSomething') }}</button>
      </div>
      <button v-else class="btn btn-sm mb-4 w-full" @click="log('feed')"><Icon name="plus" /> {{ t('logEvent') }}</button>
      <div v-for="g in timeline" :key="g.key" class="mb-5">
        <h3 class="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-muted">{{ g.label }}</h3>
        <ul class="card divide-y divide-line">
          <li v-for="e in g.items" :key="e.id" class="flex items-center gap-3 px-3.5 py-3">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg" :style="{ background: eventMeta(e.type).color + '2e' }">{{ eventMeta(e.type).icon }}</span>
            <div class="min-w-0 flex-1">
              <div class="font-semibold">{{ t(('ev_' + e.type) as MsgKey) }}</div>
              <div class="truncate text-sm text-muted">{{ eventSummary(e) || '—' }}</div>
            </div>
            <div class="text-right text-xs text-muted">
              <div>{{ fmtDate(e.date, locale) }}</div>
              <div>{{ relativeDays(Math.max(0, diffDays(e.date, todayISO()))) }}</div>
            </div>
            <button class="p-1 text-muted/60 hover:text-danger" :aria-label="t('delete')" @click="removeEvent(e.id!)"><Icon name="trash" /></button>
          </li>
        </ul>
      </div>
    </section>

    <!-- growth -->
    <section v-else-if="tab === 'growth'" class="space-y-4">
      <p v-if="!weights.length && !lengths.length" class="card p-6 text-center text-muted">{{ t('noGrowth') }}</p>
      <div v-if="weights.length" class="card p-4">
        <div class="mb-2 flex items-baseline justify-between">
          <h3 class="font-bold">⚖️ {{ t('weight') }}</h3>
          <span class="text-sm text-muted">{{ t('latest') }}: <b class="text-ink">{{ latest(weights)!.value }} {{ t('g') }}</b></span>
        </div>
        <LineChart :points="weights" color="#38bdf8" :unit="t('g')" id="w" />
      </div>
      <div v-if="lengths.length" class="card p-4">
        <div class="mb-2 flex items-baseline justify-between">
          <h3 class="font-bold">📏 {{ t('length') }}</h3>
          <span class="text-sm text-muted">{{ t('latest') }}: <b class="text-ink">{{ latest(lengths)!.value }} {{ t('cm') }}</b></span>
        </div>
        <LineChart :points="lengths" color="#5be37d" :unit="t('cm')" id="l" />
      </div>
      <div v-if="measurements.length">
        <h3 class="mb-2 px-1 text-xs font-bold uppercase tracking-widest text-muted">{{ t('measuredPhotos') }}</h3>
        <div class="flex gap-3 overflow-x-auto pb-2">
          <button v-for="m in measurements" :key="m.id" class="card relative h-28 w-28 shrink-0 overflow-hidden" @click="viewing = m">
            <img :src="thumbs[m.id!]" class="h-full w-full object-cover" alt="" />
            <span class="absolute inset-x-0 bottom-0 bg-black/60 py-1 text-center text-xs font-bold">{{ m.lengthCm.toFixed(1) }} {{ t('cm') }}</span>
          </button>
        </div>
      </div>
    </section>

    <!-- care -->
    <section v-else-if="tab === 'care'" class="space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <div class="card p-4"><div class="label">🌡️ {{ t('hotspot') }}</div><div class="font-display text-2xl font-extrabold text-amber">{{ sp.hotspot[0] }}–{{ sp.hotspot[1] }}°C</div></div>
        <div class="card p-4"><div class="label">❄️ {{ t('coolSide') }}</div><div class="font-display text-2xl font-extrabold text-sky-300">{{ sp.cool[0] }}–{{ sp.cool[1] }}°C</div></div>
        <div class="card p-4"><div class="label">💧 {{ t('humidity') }}</div><div class="font-display text-2xl font-extrabold text-accent">{{ sp.humidity[0] }}–{{ sp.humidity[1] }}%</div></div>
        <div class="card p-4"><div class="label">📏 {{ t('adultSize') }}</div><div class="font-display text-2xl font-extrabold">{{ fmtRange(sp.adultCm, t('cm')) }}</div></div>
      </div>
      <div class="card space-y-1 p-4 text-sm">
        <div><b>{{ t('feeding') }}:</b> {{ t('juvenile') }} {{ t('everyN', { d: days(sp.feedJuvenileDays) }) }}, {{ t('adult') }} {{ t('everyN', { d: days(sp.feedAdultDays) }) }}</div>
        <div v-if="sp.lifespanYears[1]"><b>{{ t('lifespan') }}:</b> {{ sp.lifespanYears[0] }}–{{ sp.lifespanYears[1] }} {{ t('yrs') }}</div>
        <div><b>{{ sp.latin }}</b> · {{ t(('level_' + sp.difficulty) as MsgKey) }}</div>
      </div>
      <p class="px-1 text-xs text-muted">{{ t('disclaimer') }}</p>
    </section>

    <!-- info -->
    <section v-else class="space-y-3">
      <div class="card divide-y divide-line">
        <div v-for="row in [
          [t('birthDate'), snake.birthDate ? fmtDate(snake.birthDate, locale, { day: 'numeric', month: 'long', year: 'numeric' }) : '—'],
          [t('acquiredDate'), snake.acquiredDate ? fmtDate(snake.acquiredDate, locale, { day: 'numeric', month: 'long', year: 'numeric' }) : '—'],
          [t('feedEvery'), days(snake.feedEveryDays)],
        ]" :key="row[0]" class="flex justify-between px-4 py-3"><span class="text-muted">{{ row[0] }}</span><span class="font-semibold">{{ row[1] }}</span></div>
      </div>
      <div v-if="snake.notes" class="card p-4 text-sm whitespace-pre-wrap">{{ snake.notes }}</div>
      <div class="flex gap-2 pt-2">
        <button class="btn flex-1" @click="editOpen = true">{{ t('edit') }}</button>
        <button class="btn btn-danger flex-1" @click="removeSnake"><Icon name="trash" /> {{ t('delete') }}</button>
      </div>
    </section>

    <EventSheet :open="eventOpen" :snake-id="snake.id" :type="eventType" @close="eventOpen = false" />
    <SnakeForm :open="editOpen" :snake="snake" @close="editOpen = false" />
    <MeasurementViewer :measurement="viewing" @close="viewing = null" />
  </template>
  <p v-else-if="ready" class="card mt-10 p-6 text-center text-muted">{{ t('noSnakes') }} <RouterLink to="/snakes" class="text-accent underline">{{ t('snakes') }}</RouterLink></p>
</template>
