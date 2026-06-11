import { Flag, type Message } from './core/message'

const viewScriptFile = 'bundles/scripts/view-lark-docx-as-markdown.js'

const isViewMessage = (message: unknown): message is Message =>
  typeof message === 'object' &&
  message !== null &&
  'flag' in message &&
  message.flag === Flag.ExecuteViewScript

const executeViewScript = async (tabId: number): Promise<void> => {
  await chrome.scripting.executeScript({
    files: [viewScriptFile],
    target: { tabId },
    world: 'MAIN',
  })
}

chrome.runtime.onMessage.addListener(
  (message: unknown, _sender, sendResponse) => {
    if (!isViewMessage(message)) {
      return false
    }

    const executeScript = async () => {
      const activeTabs = await chrome.tabs.query({
        currentWindow: true,
        active: true,
      })

      const activeTabId = activeTabs.at(0)?.id

      if (activeTabs.length === 1 && activeTabId !== undefined) {
        await executeViewScript(activeTabId)
      }
    }

    executeScript().then(sendResponse).catch(console.error)

    return true
  },
)
