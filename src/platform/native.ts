import { Capacitor } from '@capacitor/core'
import type { Router } from 'vue-router'

/**
 * Native-only wiring, kept out of the views so the web build stays unaware of it.
 *
 * Everything here no-ops in a browser, so `main.ts` can call it unconditionally.
 */
export async function setupNativePlatform(router: Router): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  const [{ App }, { StatusBar, Style }] = await Promise.all([
    import('@capacitor/app'),
    import('@capacitor/status-bar'),
  ])

  // Dark UI, so light status bar icons.
  await StatusBar.setStyle({ style: Style.Dark }).catch(() => {})
  await StatusBar.setBackgroundColor({ color: '#191A19' }).catch(() => {})

  // Android's hardware back button defaults to closing the app outright, which
  // loses the user's place. Navigate back instead, and only exit from the root.
  await App.addListener('backButton', ({ canGoBack }) => {
    if (canGoBack && router.currentRoute.value.name !== 'finder') {
      router.back()
    } else {
      void App.exitApp()
    }
  })
}
