import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { locale } from './lib/i18n'
import './style.css'

document.documentElement.lang = locale.value
createApp(App).use(router).mount('#app')
