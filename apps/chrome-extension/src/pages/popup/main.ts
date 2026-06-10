import { createApp } from 'vue'
import { VueQueryPlugin } from '@tanstack/vue-query'
import App from './popup.vue'
import { initTheme } from '../shared/theme'
import '../shared/shared.css'
import './main.css'

createApp(App).use(VueQueryPlugin).mount('#app')

initTheme()
