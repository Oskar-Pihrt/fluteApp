<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Sheet from './Sheet.vue'
import Avatar from './Avatar.vue'
import { db } from '@/lib/db'
import { SPECIES, SNAKE_COLORS, speciesByKey } from '@/lib/species'
import { defaultFeedInterval } from '@/lib/schedule'
import { resizeImage } from '@/lib/image'
import { todayISO } from '@/lib/dates'
import { locale, t } from '@/lib/i18n'
import type { Sex, Snake } from '@/lib/types'

const props = defineProps<{ open: boolean; snake?: Snake }>()
const emit = defineEmits<{ close: []; saved: [id: number] }>()

const blank = (): Snake => ({
  name: '', species: 'ball-python', morph: '', sex: 'u', birthDate: '', acquiredDate: todayISO(),
  color: SNAKE_COLORS[0], feedEveryDays: 10, notes: '', createdAt: Date.now(),
})
const form = ref<Snake>(blank())
const feedTouched = ref(false)

watch(() => props.open, (o) => {
  if (!o) return
  form.value = props.snake ? { ...props.snake } : blank()
  feedTouched.value = !!props.snake
  if (!props.snake) form.value.feedEveryDays = defaultFeedInterval(form.value.species, '')
})

// Until the keeper sets it by hand, follow the species and age.
watch(() => [form.value.species, form.value.birthDate], () => {
  if (!feedTouched.value) form.value.feedEveryDays = defaultFeedInterval(form.value.species, form.value.birthDate)
})

const speciesName = (k: string) => (locale.value === 'cs' ? speciesByKey(k).cs : speciesByKey(k).en)
const sexes: Sex[] = ['f', 'm', 'u']
const valid = computed(() => form.value.name.trim().length > 0 && form.value.feedEveryDays > 0)

async function pickPhoto(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  try { form.value = { ...form.value, photo: (await resizeImage(f, 900)).blob } } catch { /* unreadable image */ }
  ;(e.target as HTMLInputElement).value = ''
}

async function save() {
  if (!valid.value) return
  const data = { ...form.value, name: form.value.name.trim(), morph: form.value.morph.trim() }
  let id = data.id
  if (id != null) await db.snakes.put(data)
  else id = (await db.snakes.add(data)) as number
  emit('saved', id!)
  emit('close')
}
</script>

<template>
  <Sheet :open="open" :title="snake ? t('editSnake') : t('newSnake')" @close="emit('close')">
    <div class="space-y-4">
      <div class="flex items-center gap-4">
        <Avatar :snake="form" class="h-20 w-20 shrink-0" />
        <div class="flex flex-wrap gap-2">
          <label class="btn btn-sm cursor-pointer">
            {{ t('choosePhoto') }}
            <input type="file" accept="image/*" class="hidden" @change="pickPhoto" />
          </label>
          <button v-if="form.photo" type="button" class="btn btn-sm btn-danger" @click="form = { ...form, photo: undefined }">{{ t('removePhoto') }}</button>
        </div>
      </div>

      <div>
        <label class="label">{{ t('name') }}</label>
        <input v-model="form.name" class="input" maxlength="40" autocomplete="off" />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label">{{ t('species') }}</label>
          <select v-model="form.species" class="input"><option v-for="s in SPECIES" :key="s.key" :value="s.key">{{ speciesName(s.key) }}</option></select>
        </div>
        <div>
          <label class="label">{{ t('morph') }}</label>
          <input v-model="form.morph" class="input" maxlength="40" />
        </div>
      </div>

      <div>
        <label class="label">{{ t('sex') }}</label>
        <div class="flex gap-2">
          <button v-for="s in sexes" :key="s" type="button" class="chip flex-1 justify-center" :aria-pressed="form.sex === s" @click="form.sex = s">{{ t(('sex_' + s) as 'sex_m') }}</button>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label">{{ t('birthDate') }}</label>
          <input v-model="form.birthDate" type="date" class="input" :max="todayISO()" />
        </div>
        <div>
          <label class="label">{{ t('acquiredDate') }}</label>
          <input v-model="form.acquiredDate" type="date" class="input" :max="todayISO()" />
        </div>
      </div>

      <div>
        <label class="label">{{ t('feedEvery') }}</label>
        <div class="flex items-center gap-3">
          <input v-model.number="form.feedEveryDays" type="number" min="1" max="90" class="input !w-24" @input="feedTouched = true" />
          <span class="text-muted">{{ locale === 'cs' ? 'dní' : 'days' }}</span>
        </div>
      </div>

      <div>
        <label class="label">{{ t('color') }}</label>
        <div class="flex flex-wrap gap-2.5">
          <button
            v-for="c in SNAKE_COLORS" :key="c" type="button" :aria-label="c"
            class="h-9 w-9 rounded-full border-2 transition" :style="{ background: c }"
            :class="form.color === c ? 'scale-110 border-white' : 'border-transparent opacity-80'"
            @click="form.color = c"
          />
        </div>
      </div>

      <div>
        <label class="label">{{ t('notes') }} · {{ t('optional') }}</label>
        <textarea v-model="form.notes" rows="2" class="input" />
      </div>

      <button class="btn btn-primary w-full" :disabled="!valid" @click="save">{{ t('save') }}</button>
    </div>
  </Sheet>
</template>
