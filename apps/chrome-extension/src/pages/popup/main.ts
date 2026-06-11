import { createApp } from 'vue'
import App from './popup.vue'
import '../shared/shared.css'
import './main.css'

const colorScheme = window.matchMedia('(prefers-color-scheme: dark)')

const updateTheme = (): void => {
  document.documentElement.classList.toggle('dark', colorScheme.matches)
}

createApp(App).mount('#app')

updateTheme()
colorScheme.addEventListener('change', updateTheme, { passive: true })
