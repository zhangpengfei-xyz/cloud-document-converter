import type * as mdast from 'mdast'
import { isNotNil } from 'es-toolkit/predicate'
import type { Operation } from './lark'

export const trimTrailingLineBreak = (input: string): string =>
  input.length > 0 && input.endsWith('\n') ? input.slice(0, -1) : input

type InlineComponent =
  | {
      type: 'mention_doc'
      data: {
        raw_url: string
        title: string
      }
    }
  | {
      type: 'user'
      data: {
        uid: string
      }
    }
  | {
      type: 'string'
      data: unknown
    }

const markAttributeNames = ['italic', 'bold', 'strikethrough', 'link'] as const
type MarkAttributeName = (typeof markAttributeNames)[number]
type MarkNodeType = 'emphasis' | 'strong' | 'delete' | 'link'

const markAttributeToNodeType: Record<MarkAttributeName, MarkNodeType> = {
  italic: 'emphasis',
  bold: 'strong',
  strikethrough: 'delete',
  link: 'link',
}

const isMarkAttributeName = (attr: string): attr is MarkAttributeName =>
  (markAttributeNames as readonly string[]).includes(attr)

const isRenderableOperation = (operation: Operation): boolean => {
  if (isNotNil(operation.attributes?.fixEnter)) {
    return false
  }

  return isNotNil(operation.attributes) || operation.insert !== '\n'
}

const parseInlineComponent = (value?: string): InlineComponent | null => {
  if (!value) return null

  try {
    return JSON.parse(value) as InlineComponent
  } catch {
    return null
  }
}

const normalizeInlineComponentOperation = (op: Operation): Operation => {
  const inlineComponent = parseInlineComponent(
    op.attributes?.['inline-component'],
  )

  if (!inlineComponent) {
    return op
  }

  if (inlineComponent.type === 'mention_doc') {
    return {
      attributes: {
        ...op.attributes,
        link: inlineComponent.data.raw_url,
      },
      insert: op.insert + inlineComponent.data.title,
    }
  }

  if (inlineComponent.type === 'user') {
    return {
      attributes: {
        ...op.attributes,
        mentionUserId: inlineComponent.data.uid,
      },
      insert: '',
    }
  }

  return op
}

const getOperationMarks = (op: Operation): MarkNodeType[] =>
  Object.keys(op.attributes ?? {})
    .filter(isMarkAttributeName)
    .map(attr => markAttributeToNodeType[attr])

const markSpanLength = (
  mark: MarkNodeType,
  index: number,
  marksByIndex: MarkNodeType[][],
  operations: Operation[],
): number => {
  let length = 0

  for (
    let start = index;
    start >= 0 && marksByIndex[start].includes(mark);
    start--
  ) {
    length += operations[start].insert.length
  }

  for (
    let end = index + 1;
    end < marksByIndex.length && marksByIndex[end].includes(mark);
    end++
  ) {
    length += operations[end].insert.length
  }

  return length
}

const sortOperationMarks = (
  marks: MarkNodeType[],
  index: number,
  marksByIndex: MarkNodeType[][],
  operations: Operation[],
): MarkNodeType[] =>
  marks
    .slice()
    .sort(
      (a, b) =>
        markSpanLength(a, index, marksByIndex, operations) -
        markSpanLength(b, index, marksByIndex, operations),
    )

const createHtmlWrapper = (
  tagName: string,
  attributes?: string,
): [mdast.Html, mdast.Html] => [
  {
    type: 'html',
    value: attributes ? `<${tagName} ${attributes}>` : `<${tagName}>`,
  },
  {
    type: 'html',
    value: `</${tagName}>`,
  },
]

const createLiteralNodes = (op: Operation): mdast.PhrasingContent[] => {
  const { attributes, insert } = op
  const {
    inlineCode,
    equation,
    textHighlight,
    textHighlightBackground,
    mentionUserId,
    underline,
  } = attributes ?? {}

  if (mentionUserId) {
    return [
      {
        type: 'inlineCode',
        value: insert,
        data: {
          mentionUserId,
        },
      },
    ]
  }

  if (inlineCode) {
    return [
      {
        type: 'inlineCode',
        value: insert,
      },
    ]
  }

  if (equation && equation.length > 0) {
    return [
      {
        type: 'inlineMath',
        value: trimTrailingLineBreak(equation),
      },
    ]
  }

  let nodes: mdast.PhrasingContent[] = [{ type: 'text', value: insert }]

  if (textHighlight || textHighlightBackground) {
    const [open, close] = createHtmlWrapper(
      'span',
      `style="color: ${textHighlight ?? 'inherit'}; background-color: ${textHighlightBackground ?? 'inherit'}"`,
    )

    nodes = [open, ...nodes, close]
  }

  if (underline) {
    const [open, close] = createHtmlWrapper('u')

    nodes = [open, ...nodes, close]
  }

  return nodes
}

const wrapWithMark = (
  children: mdast.PhrasingContent[],
  mark: MarkNodeType,
  op: Operation,
): mdast.PhrasingContent[] => {
  switch (mark) {
    case 'link':
      return [
        {
          type: 'link',
          title: null,
          url: decodeURIComponent(op.attributes?.link ?? ''),
          children,
        },
      ]
    case 'emphasis':
      return [
        {
          type: 'emphasis',
          children,
        },
      ]
    case 'strong':
      return [
        {
          type: 'strong',
          children,
        },
      ]
    case 'delete':
      return [
        {
          type: 'delete',
          children,
        },
      ]
    default:
      return undefined as never
  }
}

const transformOperationToPhrasingContents = (
  op: Operation,
  marks: MarkNodeType[],
  mentionUsers: mdast.InlineCode[],
): mdast.PhrasingContent[] => {
  const literal = createLiteralNodes(op)
  const mentionUser = literal.find(
    (node): node is mdast.InlineCode =>
      node.type === 'inlineCode' && Boolean(node.data?.mentionUserId),
  )

  if (mentionUser) {
    mentionUsers.push(mentionUser)
  }

  return marks.reduce<mdast.PhrasingContent[]>(
    (node, mark) => wrapWithMark(node, mark, op),
    literal,
  )
}

const hasPhrasingChildren = (
  node: mdast.PhrasingContent,
): node is mdast.PhrasingContent & { children: mdast.PhrasingContent[] } =>
  'children' in node && Array.isArray(node.children)

const hasStringValue = (
  node: mdast.PhrasingContent,
): node is mdast.PhrasingContent & { value: string } =>
  'value' in node && typeof node.value === 'string'

const canMergePhrasingContent = (
  current: mdast.PhrasingContent,
  next: mdast.PhrasingContent,
): boolean => {
  if (current.type !== next.type) {
    return false
  }

  if (current.type === 'link' && next.type === 'link') {
    return current.url === next.url && current.title === next.title
  }

  if (current.type === 'inlineCode' && next.type === 'inlineCode') {
    return !current.data?.mentionUserId
  }

  return (
    current.type === 'emphasis' ||
    current.type === 'strong' ||
    current.type === 'delete' ||
    current.type === 'text'
  )
}

const mergePhrasingContent = (
  current: mdast.PhrasingContent,
  next: mdast.PhrasingContent,
): mdast.PhrasingContent => {
  if (hasPhrasingChildren(current) && hasPhrasingChildren(next)) {
    return {
      ...current,
      ...next,
      children: current.children.concat(next.children),
    } as mdast.PhrasingContent
  }

  if (hasStringValue(current) && hasStringValue(next)) {
    return {
      ...current,
      ...next,
      value: current.value.concat(next.value),
    } as mdast.PhrasingContent
  }

  return current
}

const mergeAdjacentPhrasingContents = (
  nodes: mdast.PhrasingContent[],
): mdast.PhrasingContent[] => {
  const merged: mdast.PhrasingContent[] = []

  for (const node of nodes) {
    const previous = merged.at(-1)
    if (previous && canMergePhrasingContent(previous, node)) {
      merged[merged.length - 1] = mergePhrasingContent(previous, node)
    } else {
      merged.push(node)
    }
  }

  return merged
}

const mergePhrasingContents = (
  nodes: mdast.PhrasingContent[],
): mdast.PhrasingContent[] =>
  mergeAdjacentPhrasingContents(nodes)
    .map(node =>
      hasPhrasingChildren(node)
        ? ({
            ...node,
            children: mergePhrasingContents(node.children),
          } as mdast.PhrasingContent)
        : node,
    )
    .flatMap((current, index, merged) => {
      const next = merged.at(index + 1)
      const needsSeparator =
        next && current.type === next.type && current.type === 'inlineCode'

      return needsSeparator
        ? [current, { type: 'text', value: ' ' } satisfies mdast.Text]
        : [current]
    })

export const transformOperationsToPhrasingContents = (
  ops: Operation[],
): { contents: mdast.PhrasingContent[]; mentionUsers: mdast.InlineCode[] } => {
  const mentionUsers: mdast.InlineCode[] = []

  const operations = ops
    .filter(isRenderableOperation)
    .map(normalizeInlineComponentOperation)
  const marksByIndex = operations.map(getOperationMarks)
  const nodes = operations.flatMap((op, index) =>
    transformOperationToPhrasingContents(
      op,
      sortOperationMarks(marksByIndex[index], index, marksByIndex, operations),
      mentionUsers,
    ),
  )

  const contents = mergePhrasingContents(nodes)

  return {
    contents,
    mentionUsers,
  }
}
