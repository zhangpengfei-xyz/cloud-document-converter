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

const sortObjectKeys = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys) as T
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map(key => [key, sortObjectKeys(value[key as keyof typeof value])]),
  ) as T
}

const stringifyMarkdownRoot = (root: mdast.Root): string =>
  JSON.stringify(sortObjectKeys(root), null, 2)

const stripPositions = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map(stripPositions) as T
  }

  if (!value || typeof value !== 'object') {
    return value
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== 'position')
      .map(([key, nestedValue]) => [key, stripPositions(nestedValue)]),
  ) as T
}

export const normalizeMarkdown = (root: mdast.Root): mdast.Root => {
  const markdown = toMarkdownString(root)

  return stripPositions(fromMarkdown(markdown, markdownParseOptions))
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
