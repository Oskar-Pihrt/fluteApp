import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './style.css'
import App from './App.vue'
import { router } from './router'
import { setupNativePlatform } from './platform/native'

createApp(App).use(createPinia()).use(router).mount('#app')

// No-ops in a browser; wires up the Android back button and status bar in the app.
void setupNativePlatform(router)
