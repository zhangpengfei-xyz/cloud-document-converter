import {
  Docx,
  docx,
  transformMentionUsers,
  transformTablesToHtml,
} from '../core'

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

const logError = (content: string, error?: unknown): void => {
  if (error === undefined) {
    console.error(`[Feishu Doc2Md] ${content}`)
  } else {
    console.error(`[Feishu Doc2Md] ${content}`, error)
  }
}

const main = async () => {
  if (docx.isDoc) {
    logError(message.notSupportDoc1)

    return
  }

  if (!docx.isDocx) {
    logError(message.notSupport)

    return
  }

  if (!docx.isReady()) {
    logError(message.contentLoading)

    return
  }

  const { root, tableWithParents, mentionUsers } = docx.intoMarkdownAST()

  await transformMentionUsers(mentionUsers)
  transformTablesToHtml(tableWithParents)

  const markdown = Docx.stringify(root)

  const previewWindow = window.open('', '_blank', 'width=800,height=600')

  if (!previewWindow) {
    logError(message.failedToOpenWindow)

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
  logError(message.unknownError, error)
})
