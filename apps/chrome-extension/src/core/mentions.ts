import type * as mdast from 'mdast'
import { locateBlockWithRecordId } from './lark'

const getMentionUserElement = (userId: string): HTMLElement | null =>
  Array.from(document.querySelectorAll<HTMLElement>('a[data-token]')).find(
    element => element.dataset['token'] === userId,
  ) ?? null

export const transformMentionUsers = async (
  mentionUsers: mdast.InlineCode[],
): Promise<void> => {
  for (const user of mentionUsers) {
    const parentBlockRecordId = user.data?.parentBlockRecordId
    const mentionUserId = user.data?.mentionUserId

    if (!parentBlockRecordId || !mentionUserId) {
      continue
    }

    const located = await locateBlockWithRecordId(parentBlockRecordId)
    if (!located) {
      continue
    }

    const el = getMentionUserElement(mentionUserId)
    if (el?.innerText) {
      user.value = `@${el.innerText}`
    }
  }
}
