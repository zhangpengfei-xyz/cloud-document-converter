import type * as mdast from 'mdast'
import { escape } from 'es-toolkit/string'
import type { IframeBlock, ImageBlock, Timeline } from './lark'
import { trimTrailingLineBreak } from './utils'

const DEFAULT_IFRAME_HEIGHT = 400

export const imageToMarkdownImage = (block: ImageBlock): mdast.Image => {
  const { caption, token } = block.snapshot.image
  const alt =
    trimTrailingLineBreak(
      caption.text.initialAttributedTexts.text?.[0] ?? '',
    ) || token

  return {
    type: 'image',
    url: `https://internal-api-drive-stream.larkoffice.com/space/api/box/stream/download/preview/${encodeURIComponent(token)}?preview_type=16`,
    alt,
    title: null,
  }
}

export const iframeToHtml = (iframe: IframeBlock): mdast.Html | null => {
  const { height = DEFAULT_IFRAME_HEIGHT, component = {} } =
    iframe.snapshot.iframe
  const { url } = component

  if (!url) {
    return null
  }

  const html = `<iframe src="${escape(url)}" sandbox="allow-scripts allow-same-origin allow-presentation allow-forms allow-popups allow-downloads" allowfullscreen allow="encrypted-media; fullscreen; autoplay" referrerpolicy="strict-origin-when-cross-origin" frameborder="0" style="width: 100%; min-height: ${height.toFixed()}px; border-radius: 8px;"></iframe>`

  return {
    type: 'html',
    value: html,
  }
}

export const generateMermaidTimeline = (items: Timeline[]): string => {
  let chart = 'timeline\n'

  items.forEach(item => {
    const cleanTitle = (item.title || '').replace(/:/g, '：')
    const time = item.time || ''

    if (item.text) {
      const cleanText = item.text.replace(/\n/g, '<br>')
      chart += `    ${time} : ${cleanTitle} : ${cleanText}\n`
    } else {
      chart += `    ${time} : ${cleanTitle}\n`
    }
  })

  return chart
}
