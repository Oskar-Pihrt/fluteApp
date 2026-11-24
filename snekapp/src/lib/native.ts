import { Capacitor } from '@capacitor/core'
import { watch } from 'vue'
import type { Router } from 'vue-router'
import { events, snakes, tasks } from './store'
import { settings } from './settings'
import { isOurs, planReminders, type Reminder } from './reminders'
import { locale, t } from './i18n'

/**
 * Native-only wiring (Android app). Everything here no-ops in a browser, so
 * main.ts can call it unconditionally and the web build stays unaware of it.
 */
export const isNative = Capacitor.isNativePlatform()

const CHANNEL = 'reminders'

const notifications = () => import('@capacitor/local-notifications').then((m) => m.LocalNotifications)

export async function setupNative(router: Router): Promise<void> {
  if (!isNative) return
  const [{ App }, LN] = await Promise.all([import('@capacitor/app'), notifications()])

  // Android's back button would close the app outright; go back instead, and exit from Home.
  await App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack && router.currentRoute.value.name !== 'home') router.back()
    else void App.exitApp()
  })

  await LN.createChannel({ id: CHANNEL, name: 'Připomínky / Reminders', importance: 4, vibration: true }).catch(() => {})

  // Tapping a reminder opens the snake (or the calendar for a task).
  await LN.addListener('localNotificationActionPerformed', ({ notification }) => {
    const route = notification.extra?.route
    if (typeof route === 'string') void router.push(route)
  })

  // Re-plan whenever the data, the reminder settings or the language change.
  let timer: ReturnType<typeof setTimeout> | undefined
  watch([snakes, events, tasks, () => settings.notify, () => settings.time, locale], () => {
    clearTimeout(timer)
    timer = setTimeout(() => void syncReminders(), 400)
  }, { immediate: true })

  // Coming back to the app the next day re-plans the "still not fed" nudges.
  await App.addListener('resume', () => void syncReminders())
}

function text(r: Reminder): { title: string; body: string } {
  if (r.kind === 'task') return { title: r.title!, body: r.snakeName ?? t('taskTitle') }
  if (r.kind === 'feedOverdue') return { title: `🐭 ${r.snakeName}`, body: t('notifyOverdue') }
  return { title: `🐭 ${r.snakeName}`, body: t('notifyDue') }
}

export async function syncReminders(): Promise<void> {
  if (!isNative) return
  const LN = await notifications()
  const pending = await LN.getPending().catch(() => ({ notifications: [] }))
  const ours = pending.notifications.filter((n) => isOurs(n.id))
  if (ours.length) await LN.cancel({ notifications: ours.map((n) => ({ id: n.id })) })

  if (!settings.notify) return
  if ((await LN.checkPermissions()).display !== 'granted') return

  const plan = planReminders(snakes.value, events.value, tasks.value, settings.time)
  if (!plan.length) return
  await LN.schedule({
    notifications: plan.map((r) => ({
      id: r.id,
      ...text(r),
      channelId: CHANNEL,
      schedule: { at: r.at, allowWhileIdle: true },
      extra: { route: r.route },
    })),
  })
}

/** Asks for permission; returns whether reminders can be shown. */
export async function enableReminders(): Promise<boolean> {
  if (!isNative) return false
  const LN = await notifications()
  let perm = await LN.checkPermissions()
  if (perm.display !== 'granted') perm = await LN.requestPermissions()
  const ok = perm.display === 'granted'
  settings.notify = ok
  return ok
}

/** A test notification a few seconds from now, to check that reminders arrive. */
export async function testReminder(): Promise<void> {
  if (!isNative) return
  const LN = await notifications()
  await LN.schedule({
    notifications: [{ id: 999, title: '🐍 snekapp', body: t('notifyTestBody'), channelId: CHANNEL, schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true } }],
  })
}
