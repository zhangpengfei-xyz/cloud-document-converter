import type * as mdast from 'mdast'
import {
  fromMarkdown,
  type Options as MarkdownParseOptions,
} from 'mdast-util-from-markdown'
import {
  gfmStrikethroughFromMarkdown,
  gfmStrikethroughToMarkdown,
} from 'mdast-util-gfm-strikethrough'
import {
  gfmTaskListItemFromMarkdown,
  gfmTaskListItemToMarkdown,
} from 'mdast-util-gfm-task-list-item'
import { mathFromMarkdown, mathToMarkdown } from 'mdast-util-math'
import {
  toMarkdown,
  type Options as MarkdownStringifyOptions,
} from 'mdast-util-to-markdown'
import { gfmStrikethrough } from 'micromark-extension-gfm-strikethrough'
import { gfmTaskListItem } from 'micromark-extension-gfm-task-list-item'
import { math } from 'micromark-extension-math'

const markdownStringifyOptions = {
  extensions: [
    gfmStrikethroughToMarkdown(),
    gfmTaskListItemToMarkdown(),
    mathToMarkdown({
      singleDollarTextMath: false,
    }),
  ],
} satisfies MarkdownStringifyOptions

const markdownParseOptions: MarkdownParseOptions = {
  extensions: [
    gfmStrikethrough(),
    gfmTaskListItem(),
    math({
      singleDollarTextMath: false,
    }),
  ],
  mdastExtensions: [
    gfmStrikethroughFromMarkdown(),
    gfmTaskListItemFromMarkdown(),
    mathFromMarkdown(),
  ],
}

const toMarkdownString = (root: mdast.Root): string =>
  toMarkdown(root, markdownStringifyOptions)

const stringifyMarkdownRoot = (root: mdast.Root): string =>
  JSON.stringify(root, null, 2)

export const normalizeMarkdown = (root: mdast.Root): mdast.Root => {
  const markdown = toMarkdownString(root)

  return fromMarkdown(markdown, markdownParseOptions)
}

export const stringifyMarkdown = (root: mdast.Root): string => {
  console.error(
    '[Feishu Doc2Md] Original mdast.Root string',
    stringifyMarkdownRoot(root),
  )

  const normalizedRoot = normalizeMarkdown(root)

  console.error(
    '[Feishu Doc2Md] Normalized mdast.Root string',
    stringifyMarkdownRoot(normalizedRoot),
  )

  return toMarkdownString(normalizedRoot)
}
