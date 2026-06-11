import type * as mdast from 'mdast'

export const isRootContent = (node: mdast.Nodes): node is mdast.RootContent =>
  node.type !== 'root'

export const isBlockquoteContent = (
  node: mdast.Nodes,
): node is mdast.BlockContent | mdast.DefinitionContent =>
  node.type === 'blockquote' ||
  node.type === 'code' ||
  node.type === 'definition' ||
  node.type === 'footnoteDefinition' ||
  node.type === 'heading' ||
  node.type === 'html' ||
  node.type === 'list' ||
  node.type === 'paragraph' ||
  node.type === 'table' ||
  node.type === 'thematicBreak'

export const isListItemContent: (
  node: mdast.Nodes,
) => node is mdast.BlockContent | mdast.DefinitionContent = isBlockquoteContent

export const isPhrasingContent = (
  node: mdast.Nodes,
): node is mdast.PhrasingContent =>
  node.type === 'break' ||
  node.type === 'delete' ||
  node.type === 'emphasis' ||
  node.type === 'footnoteReference' ||
  node.type === 'html' ||
  node.type === 'image' ||
  node.type === 'imageReference' ||
  node.type === 'inlineCode' ||
  node.type === 'inlineMath' ||
  node.type === 'link' ||
  node.type === 'linkReference' ||
  node.type === 'strong' ||
  node.type === 'text'

export const isTableCell = (node: mdast.Nodes): node is mdast.TableCell =>
  node.type === 'tableCell'
