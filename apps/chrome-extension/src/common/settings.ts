import { pick } from 'es-toolkit'
import { defaultsDeep } from 'es-toolkit/compat'
import { EventName, portImpl } from './message'

export enum SettingKey {
  Locale = 'general.locale',
  Theme = 'general.theme',
  Table = 'general.table',
  Grid = 'general.grid',
  TextHighlight = 'general.text_highlight',
}

export enum Theme {
  Light = 'light',
  Dark = 'dark',
  System = 'system',
}

export enum Table {
  Filtered = 'filtered',
  NonPhrasingContentToHTML = 'nonPhrasingContentToHTML',
  ToHTML = 'toHTML',
}

export enum Grid {
  Flatten = 'flatten',
  ToTable = 'toTable',
  ToHTML = 'toHTML',
}

export interface Settings {
  [SettingKey.Locale]: string
  [SettingKey.Theme]: (typeof Theme)[keyof typeof Theme]
  [SettingKey.Table]: (typeof Table)[keyof typeof Table]
  [SettingKey.Grid]: (typeof Grid)[keyof typeof Grid]
  [SettingKey.TextHighlight]: boolean
}

export const fallbackSettings: Settings = {
  [SettingKey.Locale]: 'en-US',
  [SettingKey.Theme]: Theme.System,
  [SettingKey.Table]: Table.NonPhrasingContentToHTML,
  [SettingKey.Grid]: Grid.Flatten,
  [SettingKey.TextHighlight]: true,
}

export const getSettings = async <Key extends keyof Settings>(
  keys: Key[],
): Promise<Pick<Settings, Key>> => {
  try {
    const settings = await portImpl.sender.sendAsync(
      EventName.GetSettings,
      keys,
    )
    return pick(defaultsDeep(settings, fallbackSettings), keys)
  } catch (error) {
    console.error(error)

    return pick(fallbackSettings, keys)
  }
}
