import { Flag, type Message } from './core/message'

const sharedDocumentUrlPatterns: string[] = [
  'https://*.feishu.cn/*',
  'https://*.feishu.net/*',
  'https://*.larksuite.com/*',
  'https://*.feishu-pre.net/*',
  'https://*.larkoffice.com/*',
  'https://*.larkenterprise.com/*',
]

const scriptByFlag = {
  [Flag.ExecuteViewScript]: 'bundles/scripts/view-lark-docx-as-markdown.js',
} satisfies Record<Flag, string>

const isExecutableFlag = (flag: unknown): flag is Flag =>
  typeof flag === 'string' && Object.hasOwn(scriptByFlag, flag)

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: Flag.ExecuteViewScript,
    title: 'View as Markdown',
    documentUrlPatterns: sharedDocumentUrlPatterns,
    contexts: ['page', 'editable'],
  })
})

const executeScriptByFlag = async (
  flag: string | number,
  tabId: number,
): Promise<void> => {
  if (!isExecutableFlag(flag)) {
    return
  }

  await chrome.scripting.executeScript({
    files: [scriptByFlag[flag]],
    target: { tabId },
    world: 'MAIN',
  })
}

chrome.contextMenus.onClicked.addListener(({ menuItemId }, tab) => {
  if (tab?.id !== undefined) {
    executeScriptByFlag(menuItemId, tab.id).catch(console.error)
  }
})

chrome.runtime.onMessage.addListener((_message, sender, sendResponse) => {
  const message = _message as Message

  const executeScript = async () => {
    const activeTabs = await chrome.tabs.query({
      currentWindow: true,
      active: true,
    })

    const activeTabId = activeTabs.at(0)?.id

    if (activeTabs.length === 1 && activeTabId !== undefined) {
      await executeScriptByFlag(message.flag, activeTabId)
    }
  }

  executeScript().then(sendResponse).catch(console.error)

  return true
})
