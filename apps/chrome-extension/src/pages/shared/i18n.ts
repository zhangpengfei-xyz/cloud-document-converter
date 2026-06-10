import { watch } from 'vue'
import { createI18n, useI18n } from 'vue-i18n'
import { SettingKey } from '@/common/settings'
import { defaultSettings, useSettings } from './settings'

export const i18n = createI18n({
  locale:
    localStorage.getItem('cache.locale') ?? defaultSettings[SettingKey.Locale],
  fallbackLocale: 'en-US',
  messages: {
    'en-US': {
      general: 'General',
      save: 'Save',
      settings: 'Settings',
      home: 'Home',
      'language.en-US': 'English (American)',
      'language.zh-CN': 'Chinese (simplified)',
      'general.language': 'Language',
      'general.language.placeholder': 'Select language',
      'general.theme': 'Theme',
      'general.theme.placeholder': 'Select theme',
      'general.theme.light': 'Light',
      'general.theme.dark': 'Dark',
      'general.theme.system': 'System',
      'general.table': 'Handling of tables',
      'general.table.placeholder': 'Select handling',
      'general.table.filtered': 'Filter non-phrasing content',
      'general.table.non_phrasing_content_to_html':
        'Convert table with non-phrasing content to HTML',
      'general.table.to_html': 'Convert all tables to HTML',
      'general.grid': 'Handling of grids',
      'general.grid.placeholder': 'Select handling',
      'general.grid.flatten': 'Flatten',
      'general.grid.to_table': 'To Table',
      'general.grid.to_html': 'To HTML',
      'general.text_highlight':
        'Preserve text highlighting (font color, font background color)',
      'lark.docx.view': 'View as Markdown',
      'help.and.feedback': 'Help and Feedback',
    },
    'zh-CN': {
      general: '通用',
      save: '保存',
      settings: '设置',
      home: '首页',
      'language.en-US': '英语（美式）',
      'language.zh-CN': '中文（简体）',
      'general.language': '语言',
      'general.language.placeholder': '选择语言',
      'general.theme': '主题',
      'general.theme.placeholder': '选择主题',
      'general.theme.light': '浅色',
      'general.theme.dark': '深色',
      'general.theme.system': '跟随系统',
      'general.table': '如何处理表格',
      'general.table.placeholder': '选择处理方式',
      'general.table.filtered': '过滤块级内容',
      'general.table.non_phrasing_content_to_html':
        '将含有块级内容的表格转换为 HTML',
      'general.table.to_html': '所有表格都转换为 HTML',
      'general.grid': '分栏的处理方式',
      'general.grid.placeholder': '选择处理方式',
      'general.grid.flatten': '平铺分栏',
      'general.grid.to_table': '转换成表格',
      'general.grid.to_html': '转换成 HTML',
      'general.text_highlight': '保留文本高亮（字体颜色、字体背景颜色）',
      'lark.docx.view': '查看为 Markdown',
      'help.and.feedback': '帮助和反馈',
    },
  },
})

export const useInitLocale = () => {
  const i18n = useI18n()
  const { locale, availableLocales } = i18n

  const { query } = useSettings()
  watch(query.data, newSettings => {
    if (newSettings !== undefined) {
      const newLocale = newSettings[SettingKey.Locale]
      const isAvailable = (
        input: string,
      ): input is (typeof availableLocales.value)[number] =>
        availableLocales.value.includes(input)

      locale.value = isAvailable(newLocale)
        ? newLocale
        : defaultSettings[SettingKey.Locale]
    }
  })

  return i18n
}
