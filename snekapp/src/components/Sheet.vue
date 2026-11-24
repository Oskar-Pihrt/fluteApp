<script setup lang="ts">
import { watch } from 'vue'
import Icon from './Icon.vue'
import { t } from '@/lib/i18n'

const props = defineProps<{ open: boolean; title: string }>()
const emit = defineEmits<{ close: [] }>()

watch(() => props.open, (o) => { document.body.style.overflow = o ? 'hidden' : '' })
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" @keydown.esc="emit('close')">
        <div class="absolute inset-0 bg-black/65 backdrop-blur-sm" @click="emit('close')" />
        <div class="sheet-panel relative max-h-[92dvh] w-full max-w-xl overflow-y-auto rounded-t-[2rem] border-t border-line bg-surface px-5 pt-3 pb-[calc(1.25rem+var(--sab))] shadow-2xl">
          <div class="mx-auto mb-3 h-1 w-10 rounded-full bg-white/15" />
          <div class="mb-4 flex items-center justify-between">
            <h2 class="text-xl font-bold">{{ title }}</h2>
            <button class="btn btn-sm !min-h-9 !w-9 !p-0" :aria-label="t('close')" @click="emit('close')"><Icon name="close" /></button>
          </div>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
