interface Window {
  editor?: Object
  PageMain?: import('./env').PageMain
  Toast?: import('./env').Toast
  docsLocation?: Location
  local?: {
    apiHost?: string
    driveStreamApiHost?: string
  }
  globalConfig?: {
    space_api?: string[]
    drive_api?: string[]
  }
}
