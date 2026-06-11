import type * as mdast from 'mdast'
import { BlockType } from './lark'

const listItemType = (
  listItem: mdast.ListItem,
): BlockType.TODO | BlockType.ORDERED | BlockType.BULLET => {
  if (typeof listItem.checked === 'boolean') {
    return BlockType.TODO
  }

  if (typeof listItem.data?.seq === 'number' || listItem.data?.seq === 'auto') {
    return BlockType.ORDERED
  }

  return BlockType.BULLET
}

const canMergeOrderedListItems = (
  current: mdast.ListItem,
  next: mdast.ListItem,
): boolean => {
  const seq = current.data?.seq
  const nextSeq = next.data?.seq

  if (!seq || !nextSeq) return false

  if (seq === 'auto') {
    return nextSeq === 'auto'
  }

  return nextSeq === 'auto' || seq + 1 === nextSeq
}

const canMergeListItems = (
  current: mdast.ListItem,
  next: mdast.ListItem,
): boolean => {
  const type = listItemType(current)

  if (type !== listItemType(next)) {
    return false
  }

  return type === BlockType.ORDERED
    ? canMergeOrderedListItems(current, next)
    : true
}

const createList = (children: mdast.ListItem[]): mdast.List => {
  const first = children[0]
  const ordered = listItemType(first) === BlockType.ORDERED
  const start = ordered
    ? typeof first.data?.seq === 'number'
      ? first.data.seq
      : 1
    : null

  const normalizedChildren = children.map<mdast.ListItem>(child => ({
    type: 'listItem',
    spread: child.children.filter(node => node.type === 'paragraph').length > 1,
    checked: typeof child.checked === 'boolean' ? child.checked : null,
    children: child.children,
  }))

  return {
    type: 'list',
    ordered,
    start,
    spread: false,
    children: normalizedChildren,
  }
}

export const mergeListItems = (nodes: mdast.Nodes[]): mdast.Nodes[] => {
  const merged: mdast.Nodes[] = []
  let listItems: mdast.ListItem[] = []

  const flushListItems = () => {
    if (listItems.length === 0) return
    merged.push(createList(listItems))
    listItems = []
  }

  for (const node of nodes) {
    if (node.type !== 'listItem') {
      flushListItems()
      merged.push(node)
      continue
    }

    const previous = listItems.at(-1)
    if (previous && !canMergeListItems(previous, node)) {
      flushListItems()
    }

    listItems.push(node)
  }

  flushListItems()

  return merged
}
