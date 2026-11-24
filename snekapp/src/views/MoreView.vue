<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import Icon from '@/components/Icon.vue'
import { exportBackup, importBackup, clearAll } from '@/lib/backup'
import { loadDemoData } from '@/lib/seed'
import { locale, setLocale, t } from '@/lib/i18n'
import { todayISO } from '@/lib/dates'
import { settings } from '@/lib/settings'
import { enableReminders, isNative, testReminder } from '@/lib/native'

const msg = ref('')
const denied = ref(false)

async function toggleReminders() {
  if (settings.notify) { settings.notify = false; return }
  denied.value = !(await enableReminders())
}

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
      <h2 class="label !mb-0">{{ t('reminders') }}</h2>
      <p v-if="!isNative" class="text-sm text-muted">🔔 {{ t('remindersWebOnly') }}</p>
      <template v-else>
        <button class="flex w-full items-center justify-between gap-3 text-left" role="switch" :aria-checked="settings.notify" @click="toggleReminders">
          <span class="font-semibold">🔔 {{ t('remindersOn') }}</span>
          <span class="relative h-7 w-12 shrink-0 rounded-full transition" :class="settings.notify ? 'bg-accent' : 'bg-white/15'">
            <span class="absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all" :class="settings.notify ? 'left-6' : 'left-1'" />
          </span>
        </button>
        <p v-if="denied" class="text-sm text-danger">{{ t('remindersDenied') }}</p>
        <div v-if="settings.notify" class="flex items-center gap-3">
          <label class="text-sm text-muted" for="rtime">{{ t('remindersTime') }}</label>
          <input id="rtime" v-model="settings.time" type="time" class="input !w-32" />
          <button class="btn btn-sm ml-auto" @click="testReminder">{{ t('notifyTest') }}</button>
        </div>
      </template>
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
