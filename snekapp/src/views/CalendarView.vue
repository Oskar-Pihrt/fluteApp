<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import EventSheet from '@/components/EventSheet.vue'
import TaskSheet from '@/components/TaskSheet.vue'
import Icon from '@/components/Icon.vue'
import { snakes, events, tasks, toggleTask } from '@/lib/store'
import { monthGrid } from '@/lib/calendar'
import { feedingStatus } from '@/lib/schedule'
import { eventMeta } from '@/lib/eventTypes'
import { eventSummary } from '@/lib/format'
import { fmtDate, localeTag, todayISO } from '@/lib/dates'
import { locale, t, type MsgKey } from '@/lib/i18n'

const today = todayISO()
const now = new Date()
const year = ref(now.getFullYear())
const month = ref(now.getMonth())
const selected = ref(today)

const grid = computed(() => monthGrid(year.value, month.value))
const monthLabel = computed(() => new Date(year.value, month.value, 1).toLocaleDateString(localeTag(locale.value), { month: 'long', year: 'numeric' }))
const weekdays = computed(() => Array.from({ length: 7 }, (_, i) => new Date(2024, 0, 1 + i).toLocaleDateString(localeTag(locale.value), { weekday: 'short' })))

function shift(delta: number) {
  const d = new Date(year.value, month.value + delta, 1)
  year.value = d.getFullYear()
  month.value = d.getMonth()
}
function goToday() {
  year.value = now.getFullYear()
  month.value = now.getMonth()
  selected.value = today
}

const nameOf = (id?: number) => snakes.value.find((s) => s.id === id)?.name ?? ''

const dueFeeds = computed(() =>
  snakes.value.flatMap((snake) => {
    const st = feedingStatus(events.value.filter((e) => e.snakeId === snake.id), snake.feedEveryDays, today)
    return st.dueDate ? [{ snake, date: st.dueDate, overdue: st.state === 'overdue' }] : []
  }),
)

type Marker = { key: string; color: string; hollow?: boolean }
const markers = computed(() => {
  const map = new Map<string, Marker[]>()
  const push = (iso: string, m: Marker) => {
    const list = map.get(iso) ?? map.set(iso, []).get(iso)!
    if (!list.some((x) => x.key === m.key)) list.push(m)
  }
  for (const e of events.value) push(e.date, { key: e.type, color: eventMeta(e.type).color })
  for (const d of dueFeeds.value) push(d.date, { key: 'due', color: '#f59e0b', hollow: true })
  for (const tk of tasks.value) if (!tk.done) push(tk.date, { key: 'task', color: '#e9f7ee', hollow: true })
  return map
})

const dayEvents = computed(() => events.value.filter((e) => e.date === selected.value))
const dayTasks = computed(() => tasks.value.filter((tk) => tk.date === selected.value))
const dayDue = computed(() => dueFeeds.value.filter((d) => d.date === selected.value))
const empty = computed(() => !dayEvents.value.length && !dayTasks.value.length && !dayDue.value.length)

const eventOpen = ref(false)
const taskOpen = ref(false)
const selectedLabel = computed(() => fmtDate(selected.value, locale.value, { weekday: 'long', day: 'numeric', month: 'long' }))
</script>

<template>
  <header class="mb-4 flex items-center justify-between pt-2">
    <h1 class="text-4xl font-extrabold">{{ t('calendar') }}</h1>
    <button class="btn btn-sm" @click="goToday">{{ t('today') }}</button>
  </header>

  <section class="card p-3">
    <div class="mb-2 flex items-center justify-between px-1">
      <button class="btn btn-sm !w-10 !px-0" aria-label="previous month" @click="shift(-1)"><Icon name="back" /></button>
      <h2 class="text-lg font-bold capitalize">{{ monthLabel }}</h2>
      <button class="btn btn-sm !w-10 !px-0" aria-label="next month" @click="shift(1)"><Icon name="chevron" /></button>
    </div>
    <div class="grid grid-cols-7 text-center text-[11px] font-bold uppercase tracking-wide text-muted">
      <div v-for="w in weekdays" :key="w" class="py-1">{{ w }}</div>
    </div>
    <div class="grid grid-cols-7 gap-y-1">
      <template v-for="week in grid" :key="week[0].iso">
        <button
          v-for="c in week" :key="c.iso"
          class="relative flex h-12 flex-col items-center justify-start rounded-2xl pt-1.5 text-sm font-semibold transition"
          :class="[
            c.iso === selected ? 'bg-accent text-accent-ink' : c.inMonth ? 'hover:bg-white/5' : 'text-muted/40',
            c.iso === today && c.iso !== selected ? 'ring-1 ring-accent' : '',
          ]"
          @click="selected = c.iso"
        >
          {{ c.day }}
          <span class="mt-0.5 flex h-1.5 gap-0.5">
            <span
              v-for="m in (markers.get(c.iso) ?? []).slice(0, 4)" :key="m.key"
              class="h-1.5 w-1.5 rounded-full"
              :style="m.hollow ? { border: `1.5px solid ${c.iso === selected ? '#052412' : m.color}` } : { background: c.iso === selected ? '#052412' : m.color }"
            />
          </span>
        </button>
      </template>
    </div>
    <div class="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 border-t border-line pt-3 text-[11px] text-muted">
      <span class="flex items-center gap-1.5"><i class="h-2 w-2 rounded-full bg-accent" />{{ t('loggedLegend') }}</span>
      <span class="flex items-center gap-1.5"><i class="h-2 w-2 rounded-full border-[1.5px] border-[#f59e0b]" />{{ t('dueLegend') }}</span>
      <span class="flex items-center gap-1.5"><i class="h-2 w-2 rounded-full border-[1.5px] border-ink" />{{ t('taskLegend') }}</span>
    </div>
  </section>

  <section class="mt-5">
    <h2 class="mb-3 text-lg font-bold first-letter:uppercase">{{ selectedLabel }}</h2>
    <p v-if="empty" class="card p-4 text-center text-muted">{{ t('nothingToday') }}</p>
    <div class="space-y-2.5">
      <RouterLink v-for="d in dayDue" :key="'d' + d.snake.id" :to="`/snake/${d.snake.id}`" class="card flex items-center gap-3 p-3">
        <span class="grid h-10 w-10 place-items-center rounded-full border-2 border-dashed border-[#f59e0b] text-lg">🐭</span>
        <div class="flex-1"><div class="font-semibold">{{ t('mealDue') }}</div><div class="text-sm text-muted">{{ d.snake.name }}</div></div>
        <Icon name="chevron" class="text-muted" />
      </RouterLink>

      <button v-for="tk in dayTasks" :key="'t' + tk.id" class="card flex w-full items-center gap-3 p-3 text-left" @click="toggleTask(tk, today)">
        <span class="grid h-10 w-10 shrink-0 place-items-center">
          <span class="grid h-7 w-7 place-items-center rounded-full border-2" :class="tk.done ? 'border-accent bg-accent text-accent-ink' : 'border-accent/60'"><Icon v-if="tk.done" name="check" class="!h-4 !w-4" /></span>
        </span>
        <div class="min-w-0 flex-1">
          <div class="truncate font-semibold" :class="tk.done && 'text-muted line-through'">{{ tk.title }}</div>
          <div class="text-sm text-muted">{{ nameOf(tk.snakeId) }}</div>
        </div>
      </button>

      <div v-for="e in dayEvents" :key="'e' + e.id" class="card flex items-center gap-3 p-3">
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-lg" :style="{ background: eventMeta(e.type).color + '2e' }">{{ eventMeta(e.type).icon }}</span>
        <div class="min-w-0 flex-1">
          <div class="font-semibold">{{ t(('ev_' + e.type) as MsgKey) }} · {{ nameOf(e.snakeId) }}</div>
          <div class="truncate text-sm text-muted">{{ eventSummary(e) || '—' }}</div>
        </div>
      </div>
    </div>

    <div class="mt-4 grid grid-cols-2 gap-2">
      <button class="btn btn-primary" :disabled="!snakes.length" @click="eventOpen = true"><Icon name="plus" /> {{ t('addEvent') }}</button>
      <button class="btn" @click="taskOpen = true"><Icon name="plus" /> {{ t('addTask') }}</button>
    </div>
  </section>

  <EventSheet :open="eventOpen" :date="selected" @close="eventOpen = false" />
  <TaskSheet :open="taskOpen" :date="selected" @close="taskOpen = false" />
</template>
