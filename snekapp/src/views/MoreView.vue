<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import Icon from '@/components/Icon.vue'
import { exportBackup, importBackup, clearAll } from '@/lib/backup'
import { loadDemoData } from '@/lib/seed'
import { locale, setLocale, t } from '@/lib/i18n'
import { todayISO } from '@/lib/dates'

const msg = ref('')

async function doExport() {
  const url = URL.createObjectURL(await exportBackup())
  const a = document.createElement('a')
  a.href = url
  a.download = `snekapp-backup-${todayISO()}.json`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
async function doImport(e: Event) {
  const input = e.target as HTMLInputElement
  const f = input.files?.[0]
  input.value = ''
  if (!f || !confirm(t('importConfirm'))) return
  try { await importBackup(f); msg.value = t('importDone') } catch { msg.value = t('importFail') }
}
async function doClear() {
  if (confirm(t('clearConfirm'))) await clearAll()
}
</script>

<template>
  <header class="mb-5 pt-2"><h1 class="text-4xl font-extrabold">{{ t('settings') }}</h1></header>

  <div class="space-y-4">
    <RouterLink to="/guide" class="card flex items-center gap-4 p-4">
      <span class="grid h-12 w-12 place-items-center rounded-2xl bg-accent/15 text-2xl">📖</span>
      <div class="flex-1"><div class="font-bold">{{ t('guide') }}</div><div class="text-sm text-muted">{{ t('guideSub') }}</div></div>
      <Icon name="chevron" class="text-muted" />
    </RouterLink>

    <section class="card p-4">
      <h2 class="label">{{ t('language') }}</h2>
      <div class="flex gap-2">
        <button class="chip flex-1 justify-center" :aria-pressed="locale === 'cs'" @click="setLocale('cs')">Čeština</button>
        <button class="chip flex-1 justify-center" :aria-pressed="locale === 'en'" @click="setLocale('en')">English</button>
      </div>
    </section>

    <section class="card space-y-3 p-4">
      <h2 class="label !mb-0">{{ t('data') }}</h2>
      <p class="text-sm text-muted">{{ t('localOnly') }}</p>
      <div class="grid grid-cols-2 gap-2">
        <button class="btn" @click="doExport">{{ t('exportData') }}</button>
        <label class="btn cursor-pointer">{{ t('importData') }}<input type="file" accept="application/json,.json" class="hidden" @change="doImport" /></label>
      </div>
      <p v-if="msg" class="text-sm text-accent">{{ msg }}</p>
      <div class="grid grid-cols-2 gap-2 border-t border-line pt-3">
        <button class="btn btn-sm" @click="loadDemoData">{{ t('demoData') }}</button>
        <button class="btn btn-sm btn-danger" @click="doClear">{{ t('clearAll') }}</button>
      </div>
    </section>

    <p class="px-2 text-center text-xs text-muted">{{ t('disclaimer') }}</p>
    <p class="pb-2 text-center text-xs text-muted/60">snekapp 0.1 🐍</p>
  </div>
</template>
