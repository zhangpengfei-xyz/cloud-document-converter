import type * as mdast from 'mdast'
import { isNotNil } from 'es-toolkit/predicate'
import { getMentionUserName } from './lark'
import type { Attributes, Operation } from './lark'
import { trimTrailingLineBreak } from './utils'

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

const markAttributeNames = [
  'italic',
  'bold',
  'strikethrough',
] as const satisfies readonly (keyof Attributes)[]
type MarkAttributeName = (typeof markAttributeNames)[number]
type MarkNodeType = 'emphasis' | 'strong' | 'delete' | 'link'

const markAttributeToNodeType: Record<
  MarkAttributeName,
  Exclude<MarkNodeType, 'link'>
> = {
  italic: 'emphasis',
  bold: 'strong',
  strikethrough: 'delete',
}

const hasAttribute = (
  attributes: Attributes,
  name: keyof Attributes,
): boolean => Object.hasOwn(attributes, name)

const isRenderableOperation = (operation: Operation): boolean => {
  // Feishu stores the block-ending newline as fixEnter, but in-paragraph line
  // breaks can be standalone "\n" operations that should remain in Markdown.
  return !isNotNil(operation.attributes.fixEnter)
}

const parseInlineComponent = (value?: string): InlineComponent | null => {
  if (!value) return null

  try {
    return JSON.parse(value) as InlineComponent
  } catch {
    return null
  }
}

const decodeUrl = (url: string): string => {
  try {
    return decodeURIComponent(url)
  } catch {
    return url
  }
}

const resolveOperationLink = (op: Operation): string | null => {
  if (hasAttribute(op.attributes, 'link')) {
    return decodeUrl(op.attributes.link ?? '')
  }

  if (hasAttribute(op.attributes, 'link-id')) {
    return decodeUrl(op.insert.trim())
  }

  return null
}

const normalizeInlineComponentOperation = (op: Operation): Operation => {
  const inlineComponent = parseInlineComponent(
    op.attributes['inline-component'],
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
    const { uid } = inlineComponent.data
    const name = getMentionUserName(uid)

    return {
      attributes: op.attributes,
      insert: `@${name ?? uid}`,
    }
  }

  return op
}

const getOperationMarks = (op: Operation): MarkNodeType[] => [
  ...markAttributeNames
    .filter(attr => hasAttribute(op.attributes, attr))
    .map(attr => markAttributeToNodeType[attr]),
  ...(resolveOperationLink(op) === null ? [] : ['link' as const]),
]

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

const splitTextLineBreaks = (value: string): mdast.PhrasingContent[] =>
  value
    .split('\n')
    .flatMap((part, index, parts) => [
      ...(part.length > 0
        ? [{ type: 'text', value: part } satisfies mdast.Text]
        : []),
      ...(index < parts.length - 1
        ? [{ type: 'break' } satisfies mdast.Break]
        : []),
    ])

const createLiteralNodes = (op: Operation): mdast.PhrasingContent[] => {
  const { attributes, insert } = op
  const { inlineCode, equation, underline } = attributes

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

  if (underline) {
    return [
      { type: 'html', value: '<u>' },
      ...splitTextLineBreaks(insert),
      { type: 'html', value: '</u>' },
    ]
  }

  return splitTextLineBreaks(insert)
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
          url: resolveOperationLink(op) ?? '',
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
): mdast.PhrasingContent[] => {
  const literal = createLiteralNodes(op)

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
    return true
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
): mdast.PhrasingContent[] => {
  const operations = ops
    .filter(isRenderableOperation)
    .map(normalizeInlineComponentOperation)
  const marksByIndex = operations.map(getOperationMarks)
  const nodes = operations.flatMap((op, index) =>
    transformOperationToPhrasingContents(
      op,
      sortOperationMarks(marksByIndex[index], index, marksByIndex, operations),
    ),
  )

  return mergePhrasingContents(nodes)
}
