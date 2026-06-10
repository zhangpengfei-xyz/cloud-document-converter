import { Docx, docx, Toast } from '../lark'
import { reportBug } from '../common/issue'
import {
  transformMentionUsers,
  transformTableBySettings,
} from '../common/utils'
import { getSettings, SettingKey, Grid } from '../common/settings'

const message = {
  unknownError: 'Unknown error while opening preview',
  contentLoading:
    'Part of the content is still loading and cannot be previewed at the moment. Please wait for loading to complete and retry',
  notSupport:
    'This is not a lark document page and cannot be viewed as Markdown',
  notSupportDoc1:
    'This is a old version lark document page and cannot be viewed as Markdown',
  failedToOpenWindow: 'Failed to Open a new window to display markdown.',
}

const main = async () => {
  if (docx.isDoc) {
    Toast.warning({ content: message.notSupportDoc1 })

    return
  }

  if (!docx.isDocx) {
    Toast.warning({ content: message.notSupport })

    return
  }

  if (!docx.isReady()) {
    Toast.warning({
      content: message.contentLoading,
    })

    return
  }

  const settings = await getSettings([
    SettingKey.Table,
    SettingKey.Grid,
    SettingKey.TextHighlight,
  ])

  const { root, tableWithParents, mentionUsers } = docx.intoMarkdownAST({
    highlight: settings[SettingKey.TextHighlight],
    flatGrid: settings[SettingKey.Grid] === Grid.Flatten,
  })

  await transformMentionUsers(mentionUsers)
  transformTableBySettings(tableWithParents, settings)

  const markdown = Docx.stringify(root)

  const previewWindow = window.open('', '_blank', 'width=800,height=600')

  if (!previewWindow) {
    Toast.error({
      content: message.failedToOpenWindow,
    })

    return
  }

  previewWindow.document.title = 'Markdown Preview'

  const previewDocument = previewWindow.document

  const style = previewDocument.createElement('style')
  style.textContent = `
  body {
    font-family: monospace, system-ui, sans-serif;
    padding: 20px;
    background: #f9f9f9;
    color: #222;
  }
  pre {
    white-space: pre-wrap;
    word-break: break-word;
    background: #fff;
    padding: 1em;
    border: 1px solid #ddd;
    border-radius: 6px;
  }
  `
  previewDocument.head.appendChild(style)

  const heading = previewDocument.createElement('h2')
  heading.textContent = 'Markdown Preview'
  previewDocument.body.appendChild(heading)

  const pre = previewDocument.createElement('pre')
  pre.textContent = markdown // Safe, no need to escape
  previewDocument.body.appendChild(pre)
}

main().catch((error: unknown) => {
  Toast.error({
    content: message.unknownError,
    actionText: 'Report Bug',
    onActionClick: () => {
      reportBug(error)
    },
  })
})
