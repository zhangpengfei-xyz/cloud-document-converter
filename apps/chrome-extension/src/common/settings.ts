export enum SettingKey {
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
  [SettingKey.Theme]: (typeof Theme)[keyof typeof Theme]
  [SettingKey.Table]: (typeof Table)[keyof typeof Table]
  [SettingKey.Grid]: (typeof Grid)[keyof typeof Grid]
  [SettingKey.TextHighlight]: boolean
}

export const fallbackSettings: Settings = {
  [SettingKey.Theme]: Theme.System,
  [SettingKey.Table]: Table.ToHTML,
  [SettingKey.Grid]: Grid.Flatten,
  [SettingKey.TextHighlight]: true,
}
