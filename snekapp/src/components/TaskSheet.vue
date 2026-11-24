<script setup lang="ts">
import { ref, watch } from 'vue'
import Sheet from './Sheet.vue'
import { db } from '@/lib/db'
import { snakes } from '@/lib/store'
import { todayISO } from '@/lib/dates'
import { days, t } from '@/lib/i18n'

const props = defineProps<{ open: boolean; date?: string; snakeId?: number }>()
const emit = defineEmits<{ close: [] }>()

const title = ref('')
const date = ref(todayISO())
const sid = ref<number | ''>('')
const repeat = ref(0)

watch(() => props.open, (o) => {
  if (!o) return
  title.value = ''
  date.value = props.date ?? todayISO()
  sid.value = props.snakeId ?? ''
  repeat.value = 0
})

async function save() {
  if (!title.value.trim()) return
  await db.tasks.add({ title: title.value.trim(), date: date.value, snakeId: sid.value === '' ? undefined : sid.value, repeatDays: repeat.value || undefined })
  emit('close')
}
</script>

<template>
  <Sheet :open="open" :title="t('newTask')" @close="emit('close')">
    <div class="space-y-4">
      <div>
        <label class="label">{{ t('taskTitle') }}</label>
        <input v-model="title" class="input" maxlength="80" @keydown.enter="save" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label">{{ t('date') }}</label>
          <input v-model="date" type="date" class="input" />
        </div>
        <div>
          <label class="label">{{ t('repeat') }}</label>
          <select v-model.number="repeat" class="input">
            <option :value="0">{{ t('repeatNone') }}</option>
            <option v-for="d in [1, 3, 7, 14, 30, 90]" :key="d" :value="d">{{ t('repeatEvery', { d: d === 1 ? days(1) : days(d) }) }}</option>
          </select>
        </div>
      </div>
      <div>
        <label class="label">{{ t('forWhom') }}</label>
        <select v-model="sid" class="input">
          <option value="">{{ t('allSnakes') }}</option>
          <option v-for="s in snakes" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
      </div>
      <button class="btn btn-primary w-full" :disabled="!title.trim()" @click="save">{{ t('save') }}</button>
    </div>
  </Sheet>
</template>
