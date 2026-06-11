import type * as mdast from 'mdast'
import { gfmStrikethroughToMarkdown } from 'mdast-util-gfm-strikethrough'
import { gfmTaskListItemToMarkdown } from 'mdast-util-gfm-task-list-item'
import { mathToMarkdown } from 'mdast-util-math'
import { toMarkdown, type Options } from 'mdast-util-to-markdown'

export type MarkdownStringifyOptions = Options

export const stringifyMarkdown = (
  root: mdast.Root,
  options?: MarkdownStringifyOptions,
): string =>
  toMarkdown(root, {
    ...options,
    extensions: [
      gfmStrikethroughToMarkdown(),
      gfmTaskListItemToMarkdown(),
      mathToMarkdown({
        singleDollarTextMath: false,
      }),
      ...(options?.extensions ?? []),
    ],
  })
