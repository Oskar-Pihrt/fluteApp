import { createApp } from 'vue'
import { createPinia } from 'pinia'
import '@fontsource/noto-serif/400.css'
import '@fontsource/noto-serif/500.css'
import '@fontsource/noto-serif/600.css'
import '@fontsource/noto-serif/700.css'
import './style.css'
import App from './App.vue'
import { router } from './router'
import { setupNativePlatform } from './platform/native'
import { keepInstrumentsCached } from './platform/instrumentCache'
import { useSettingsStore } from './stores/settings'

const pinia = createPinia()
const app = createApp(App).use(pinia).use(router)

async function start() {
  const settings = useSettingsStore(pinia)
  // Every view reads the active instrument synchronously, so it has to be
  // loaded before anything renders.
  if (!(await settings.restoreInstrument())) {
    document.getElementById('app')!.innerHTML =
      '<p style="padding:2rem;font-family:serif;color:#ddd">Your instruments haven’t been ' +
      'downloaded yet. Connect to the internet and reload.</p>'
    return
  }
  app.mount('#app')
  keepInstrumentsCached(settings)
}

void start()

// No-ops in a browser; wires up the Android back button and status bar in the app.
void setupNativePlatform(router)
