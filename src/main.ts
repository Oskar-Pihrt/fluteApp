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

createApp(App).use(createPinia()).use(router).mount('#app')

// No-ops in a browser; wires up the Android back button and status bar in the app.
void setupNativePlatform(router)
