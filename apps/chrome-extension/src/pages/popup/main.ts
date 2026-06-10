import { createApp } from 'vue'
import App from './popup.vue'
import { fallbackSettings, SettingKey, Theme } from '@/common/settings'
import '../shared/shared.css'
import './main.css'

const preferredDark = (theme: Theme): boolean =>
  theme === Theme.System
    ? window.matchMedia('(prefers-color-scheme: dark)').matches
    : theme === Theme.Dark

const updateTheme = (): void => {
  document.documentElement.classList.toggle(
    'dark',
    preferredDark(fallbackSettings[SettingKey.Theme]),
  )
}

createApp(App).mount('#app')

updateTheme()

if (fallbackSettings[SettingKey.Theme] === Theme.System) {
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', updateTheme, { passive: true })
}
