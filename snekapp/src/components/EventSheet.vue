<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Sheet from './Sheet.vue'
import { db } from '@/lib/db'
import { snakes, events } from '@/lib/store'
import { EVENT_TYPES, PREY, PREY_SIZES } from '@/lib/eventTypes'
import { todayISO } from '@/lib/dates'
import { t, type MsgKey } from '@/lib/i18n'
import type { EventType, SnakeEvent } from '@/lib/types'

const props = defineProps<{ open: boolean; snakeId?: number; type?: EventType; date?: string }>()
const emit = defineEmits<{ close: [] }>()

const sid = ref<number | undefined>()
const type = ref<EventType>('feed')
const date = ref(todayISO())
const value = ref<number | null>(null)
const text = ref('')
const prey = ref('mouse')
const preySize = ref('small')
const frozen = ref(true)
const refused = ref(false)

watch(
  () => props.open,
  (open) => {
    if (!open) return
    sid.value = props.snakeId ?? snakes.value[0]?.id
    type.value = props.type ?? 'feed'
    date.value = props.date ?? todayISO()
    value.value = null
    text.value = ''
    refused.value = false
    applyLastMeal()
  },
)
watch([sid, type], applyLastMeal)

// Offer what this snake ate last time.
function applyLastMeal() {
  if (type.value !== 'feed' || sid.value == null) return
  const last = events.value.filter((e) => e.snakeId === sid.value && e.type === 'feed' && e.prey).at(-1)
  if (last) {
    prey.value = last.prey!
    preySize.value = last.preySize ?? preySize.value
    frozen.value = last.frozen ?? true
  }
}

const needsValue = computed(() => ['weight', 'length', 'eggs'].includes(type.value))
const valueLabel = computed<MsgKey>(() => (type.value === 'weight' ? 'weightG' : type.value === 'length' ? 'lengthCm' : 'eggCount'))
const canSave = computed(() => sid.value != null && (!needsValue.value || (value.value ?? 0) > 0))

async function save() {
  if (!canSave.value) return
  const e: Omit<SnakeEvent, 'id'> = { snakeId: sid.value!, type: type.value, date: date.value }
  if (needsValue.value) e.value = Number(value.value)
  if (text.value.trim()) e.text = text.value.trim()
  if (type.value === 'feed') {
    e.refused = refused.value
    if (!refused.value) Object.assign(e, { prey: prey.value, preySize: preySize.value, frozen: frozen.value })
  }
  await db.events.add(e as SnakeEvent)
  emit('close')
}
</script>

<template>
  <Sheet :open="open" :title="t('logEvent')" @close="emit('close')">
    <div class="space-y-4">
      <div v-if="!snakeId && snakes.length > 1">
        <label class="label">{{ t('snake') }}</label>
        <select v-model="sid" class="input">
          <option v-for="s in snakes" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
      </div>

      <div class="grid grid-cols-4 gap-2">
        <button
          v-for="e in EVENT_TYPES"
          :key="e.type"
          type="button"
          class="flex flex-col items-center gap-1 rounded-2xl border px-1 py-2.5 text-[11px] font-semibold transition"
          :class="type === e.type ? 'border-transparent text-bg' : 'border-line bg-black/20 text-muted'"
          :style="type === e.type ? { background: e.color } : {}"
          @click="type = e.type"
        >
          <span class="text-xl leading-none">{{ e.icon }}</span>
          {{ t(('ev_' + e.type) as MsgKey) }}
        </button>
      </div>

      <div>
        <label class="label">{{ t('date') }}</label>
        <input v-model="date" type="date" class="input" />
      </div>

      <template v-if="type === 'feed'">
        <div class="flex gap-2">
          <button type="button" class="chip flex-1 justify-center" :aria-pressed="!refused" @click="refused = false">{{ t('ate') }}</button>
          <button type="button" class="chip flex-1 justify-center" :aria-pressed="refused" @click="refused = true">{{ t('refused') }}</button>
        </div>
        <template v-if="!refused">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label">{{ t('prey') }}</label>
              <select v-model="prey" class="input"><option v-for="p in PREY" :key="p" :value="p">{{ t(p) }}</option></select>
            </div>
            <div>
              <label class="label">{{ t('preySize') }}</label>
              <select v-model="preySize" class="input"><option v-for="p in PREY_SIZES" :key="p" :value="p">{{ p }}</option></select>
            </div>
          </div>
          <div class="flex gap-2">
            <button type="button" class="chip flex-1 justify-center" :aria-pressed="frozen" @click="frozen = true">{{ t('frozen') }}</button>
            <button type="button" class="chip flex-1 justify-center" :aria-pressed="!frozen" @click="frozen = false">{{ t('live') }}</button>
          </div>
        </template>
      </template>

      <div v-if="needsValue">
        <label class="label">{{ t(valueLabel) }}</label>
        <input v-model.number="value" type="number" inputmode="decimal" min="0" step="any" class="input" />
      </div>

      <div>
        <label class="label">{{ t('notes') }} · {{ t('optional') }}</label>
        <textarea v-model="text" rows="2" class="input" />
      </div>

      <button class="btn btn-primary w-full" :disabled="!canSave" @click="save">{{ t('save') }}</button>
    </div>
  </Sheet>
</template>
