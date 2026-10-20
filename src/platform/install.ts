import { Capacitor } from '@capacitor/core'
import { ref } from 'vue'

/**
 * Installing the web app to the home screen. Chrome and Edge offer an install
 * prompt the page can trigger itself (`beforeinstallprompt`); Safari has none,
 * so iPhones and iPads get instructions instead.
 *
 * The browser fires the event once, early — usually before the welcome screen
 * mounts — so it is caught here, at import time, and kept.
 */

interface InstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/** Set while the browser is willing to install the app on request. */
export const installPrompt = ref<InstallPromptEvent | null>(null)
export const installed = ref(false)

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault()
    installPrompt.value = event as InstallPromptEvent
  })
  window.addEventListener('appinstalled', () => {
    installed.value = true
    installPrompt.value = null
  })
}

/** Already running as an installed app (or the native Android build). */
export function runsInstalled(): boolean {
  return (
    Capacitor.isNativePlatform() ||
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true
  )
}

export type InstallPlatform = 'ios' | 'android' | 'desktop'

export function installPlatform(): InstallPlatform {
  const ua = navigator.userAgent
  // iPadOS reports itself as a Mac; touch support gives it away.
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

/** Show the browser's own install dialog. True when the player accepted. */
export async function promptInstall(): Promise<boolean> {
  const event = installPrompt.value
  if (!event) return false
  await event.prompt()
  const { outcome } = await event.userChoice
  installPrompt.value = null
  return outcome === 'accepted'
}
