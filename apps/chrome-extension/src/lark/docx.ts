import type * as mdast from 'mdast'
import { chunk } from 'es-toolkit/array'
import { isDefined, OneHundred } from '../shared'
import { toMarkdown, type Options } from 'mdast-util-to-markdown'
import { gfmStrikethroughToMarkdown } from 'mdast-util-gfm-strikethrough'
import { gfmTaskListItemToMarkdown } from 'mdast-util-gfm-task-list-item'
import { mathToMarkdown, type InlineMath } from 'mdast-util-math'
import { PageMain, isDoc, isDocx } from './env'
import {
  isBlockquoteContent,
  isPhrasingContent,
  isRootContent,
  isTableCell,
  isListItemContent,
} from './utils/mdast'
import { isString } from 'es-toolkit/compat'
import { escape } from 'es-toolkit/compat'
import { toCamelCaseKeys } from 'es-toolkit/object'

declare module 'mdast' {
  interface ListItemData {
    seq?: number | 'auto'
  }

  interface TableData {
    type?: BlockType.TABLE | BlockType.GRID
    colWidths?: number[]
    invalid?: boolean
    cellSet?: Record<string, CellData>
  }

  interface TableCellData {
    width?: number
    invalidChildren?: mdast.Nodes[]
    rowSpan?: number
    colSpan?: number
  }

  interface InlineCodeData {
    mentionUserId?: string
    parentBlockRecordId?: string
  }
}

/**
 * @see https://open.feishu.cn/document/client-docs/docs-add-on/06-data-structure/BlockType
 */
export enum BlockType {
  PAGE = 'page',
  BITABLE = 'bitable',
  CALLOUT = 'callout',
  CHAT_CARD = 'chat_card',
  CODE = 'code',
  DIAGRAM = 'diagram',
  DIVIDER = 'divider',
  FILE = 'file',
  GRID = 'grid',
  GRID_COLUMN = 'grid_column',
  HEADING1 = 'heading1',
  HEADING2 = 'heading2',
  HEADING3 = 'heading3',
  HEADING4 = 'heading4',
  HEADING5 = 'heading5',
  HEADING6 = 'heading6',
  HEADING7 = 'heading7',
  HEADING8 = 'heading8',
  HEADING9 = 'heading9',
  IFRAME = 'iframe',
  IMAGE = 'image',
  ISV = 'isv',
  MINDNOTE = 'mindnote',
  BULLET = 'bullet',
  ORDERED = 'ordered',
  TODO = 'todo',
  QUOTE = 'quote',
  QUOTE_CONTAINER = 'quote_container',
  SHEET = 'sheet',
  TABLE = 'table',
  CELL = 'table_cell',
  TEXT = 'text',
  VIEW = 'view',
  SYNCED_SOURCE = 'synced_source',
  SYNCED_REFERENCE = 'synced_reference',
  WHITEBOARD = 'whiteboard',
  FALLBACK = 'fallback',
}

interface Attributes {
  fixEnter?: string

  italic?: string
  bold?: string
  strikethrough?: string
  underline?: string

  inlineCode?: string
  equation?: string
  textHighlight?: string
  textHighlightBackground?: string
  'inline-component'?: string

  link?: string
  mentionUserId?: string

  [attrName: string]: unknown
}

interface Operation {
  attributes?: Attributes
  insert: string
}

interface BlockZoneState {
  allText: string
  content: {
    ops: Operation[]
  }
}

interface BlockSnapshot {
  type: BlockType | 'pending'
}

interface Block<T extends Blocks = Blocks> {
  id: number
  type: BlockType
  zoneState?: BlockZoneState
  record?: { id: string }
  snapshot: BlockSnapshot
  children: T[]
}

export interface PageBlock extends Block {
  type: BlockType.PAGE
}

interface DividerBlock extends Block {
  type: BlockType.DIVIDER
}

interface HeadingBlock extends Block<TextBlock> {
  type:
    | BlockType.HEADING1
    | BlockType.HEADING2
    | BlockType.HEADING3
    | BlockType.HEADING4
    | BlockType.HEADING5
    | BlockType.HEADING6
    | BlockType.HEADING7
    | BlockType.HEADING8
    | BlockType.HEADING9
  depth: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
  snapshot: {
    type:
      | BlockType.HEADING1
      | BlockType.HEADING2
      | BlockType.HEADING3
      | BlockType.HEADING4
      | BlockType.HEADING5
      | BlockType.HEADING6
      | BlockType.HEADING7
      | BlockType.HEADING8
      | BlockType.HEADING9
    /**
     * sequence value
     */
    seq?: string
    seq_level?: string
  }
}

interface CodeBlock extends Block<TextBlock> {
  type: BlockType.CODE
  language: string
}

interface QuoteContainerBlock extends Block {
  type: BlockType.QUOTE_CONTAINER
}

interface BulletBlock extends Block {
  type: BlockType.BULLET
}

interface OrderedBlock extends Block<TextBlock> {
  type: BlockType.ORDERED
  snapshot: {
    type: BlockType.ORDERED
    seq: string
  }
}

interface TodoBlock extends Block {
  type: BlockType.TODO
  snapshot: {
    type: BlockType.TODO
    done?: boolean
  }
}

interface TextBlock extends Block {
  type: BlockType.TEXT
}

interface Caption {
  text: {
    initialAttributedTexts: {
      text: { 0: string } | null
    }
  }
}

interface ImageBlockData {
  token: string
  width: number
  height: number
  mimeType: string
  name: string
  caption?: Caption
}

interface ImageBlock extends Block {
  type: BlockType.IMAGE
  snapshot: {
    type: BlockType.IMAGE
    image: ImageBlockData
  }
}

interface MergeInfo {
  row_span: number
  col_span: number
}

interface ColumnData {
  column_width: number
}

interface CellData {
  merge_info: MergeInfo
}

interface TableBlock extends Block<TableCellBlock> {
  type: BlockType.TABLE
  snapshot: {
    type: BlockType.TABLE
    rows_id: string[]
    columns_id: string[]
    column_set: Record<string, ColumnData>
    cell_set: Record<string, CellData>
  }
}

interface TableCellBlock extends Block {
  type: BlockType.CELL
  cellId: string
}

interface Grid extends Block<GridColumn> {
  type: BlockType.GRID
}

interface GridColumn extends Block {
  type: BlockType.GRID_COLUMN
  snapshot: {
    type: BlockType.GRID_COLUMN
    width_ratio?: number
  }
}

interface Callout extends Block {
  type: BlockType.CALLOUT
}

interface SyncedSource extends Block {
  type: BlockType.SYNCED_SOURCE
}

interface SyncedReferenceInnerBlockManager {
  rootBlockModel?: PageBlock
}

interface SyncedReference extends Block {
  type: BlockType.SYNCED_REFERENCE
  isAllDataReady: boolean
  innerBlockManager?: SyncedReferenceInnerBlockManager
}

interface Whiteboard extends Block {
  type: BlockType.WHITEBOARD
  snapshot: {
    type: BlockType.WHITEBOARD
    caption?: Caption
  }
}

interface DiagramBlock extends Block {
  type: BlockType.DIAGRAM
  snapshot: {
    type: BlockType.DIAGRAM
  }
}

interface View extends Block {
  type: BlockType.VIEW
}

enum ISVBlockTypeId {
  /**
   * Text Drawing
   */
  TextDrawing = 'blk_631fefbbae02400430b8f9f4',

  /**
   * Timeline
   */
  Timeline = 'blk_6358a421bca0001c22536e4c',
  /**
   * Other ISV block (type inference)
   */
  _Other = '',
}

interface OtherISVBlock extends Block {
  type: BlockType.ISV
  snapshot: {
    type: BlockType.ISV
    /**
     * ISV block type id
     */
    block_type_id: ISVBlockTypeId._Other
    /**
     * ISV block data
     */
    data: unknown
  }
}

interface TextDrawingBlock extends Block {
  type: BlockType.ISV
  snapshot: {
    type: BlockType.ISV
    /**
     * ISV block type id
     */
    block_type_id: ISVBlockTypeId.TextDrawing
    /**
     * ISV block data
     */
    data: {
      /**
       * Mermaid code
       */
      data: string
    }
  }
}

interface Timeline {
  time: string
  title: string
  text?: string
}

interface TimelineBlock extends Block {
  type: BlockType.ISV
  snapshot: {
    type: BlockType.ISV
    /**
     * ISV block type id
     */
    block_type_id: ISVBlockTypeId.Timeline
    /**
     * ISV block data
     */
    data: {
      /**
       * Mermaid code
       */
      items: Timeline[]
    }
  }
}

type ISVBlocks = TextDrawingBlock | TimelineBlock | OtherISVBlock

interface NotSupportedBlock extends Block {
  type:
    | BlockType.QUOTE
    | BlockType.BITABLE
    | BlockType.CHAT_CARD
    | BlockType.FILE
    | BlockType.MINDNOTE
    | BlockType.SHEET
    | BlockType.FALLBACK
  children: []
}

type Blocks =
  | PageBlock
  | DividerBlock
  | HeadingBlock
  | CodeBlock
  | QuoteContainerBlock
  | BulletBlock
  | OrderedBlock
  | TodoBlock
  | TextBlock
  | ImageBlock
  | TableBlock
  | TableCellBlock
  | Grid
  | GridColumn
  | Callout
  | SyncedSource
  | SyncedReference
  | Whiteboard
  | DiagramBlock
  | View
  | IframeBlock
  | ISVBlocks
  | NotSupportedBlock

interface IframeBlock extends Block {
  type: BlockType.IFRAME
  snapshot: {
    type: BlockType.IFRAME
    iframe: Partial<{
      height: number
      component: Partial<{
        url: string
      }>
    }>
  }
}

const iframeToHTML = (iframe: IframeBlock): mdast.Html | null => {
  const { height = 4 * OneHundred, component = {} } = iframe.snapshot.iframe
  const { url } = component

  if (!url) {
    return null
  }

  const html = `<iframe src="${url}" sandbox="allow-scripts allow-same-origin allow-presentation allow-forms allow-popups allow-downloads" allowfullscreen allow="encrypted-media; fullscreen; autoplay" referrerpolicy="strict-origin-when-cross-origin" frameborder="0" style="width: 100%; min-height: ${height.toFixed()}px; border-radius: 8px;"></iframe>`

  return {
    type: 'html',
    value: html,
  }
}

/**
 * @description Removes an enter from the end of this string if it exists.
 */
const trimEndEnter = (input: string) =>
  input.length > 0 && input.endsWith('\n') ? input.slice(0, -1) : input

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

  return {
    type: 'list',
    ...(typeof first.data?.seq === 'number'
      ? {
          ordered: true,
          start: first.data.seq,
        }
      : null),
    children,
  }
}

const mergeListItems = (nodes: mdast.Nodes[]): mdast.Nodes[] => {
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
    return current.url === next.url
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

      return next && current.type === next.type
        ? [current, { type: 'text', value: ' ' } satisfies mdast.Text]
        : [current]
    })

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
  if (isDefined(operation.attributes?.fixEnter)) {
    return false
  }

  return isDefined(operation.attributes) || operation.insert !== '\n'
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

const createLiteralNode = (
  op: Operation,
): mdast.Text | mdast.InlineCode | InlineMath | mdast.Html => {
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
    return {
      type: 'inlineCode',
      value: insert,
      data: {
        mentionUserId,
      },
    }
  }

  if (inlineCode) {
    return {
      type: 'inlineCode',
      value: insert,
    }
  }

  if (equation && equation.length > 0) {
    return {
      type: 'inlineMath',
      value: trimEndEnter(equation),
    }
  }

  if (textHighlight || textHighlightBackground) {
    const highlighted = `<span style="color: ${textHighlight ?? 'inherit'}; background-color: ${textHighlightBackground ?? 'inherit'}">${escape(insert)}</span>`

    return {
      type: 'html',
      value: underline ? `<u>${highlighted}</u>` : highlighted,
    }
  }

  if (underline) {
    return {
      type: 'html',
      value: `<u>${escape(insert)}</u>`,
    }
  }

  return {
    type: 'text',
    value: insert,
  }
}

const wrapWithMark = (
  node: mdast.PhrasingContent,
  mark: MarkNodeType,
  op: Operation,
): mdast.PhrasingContent => {
  switch (mark) {
    case 'link':
      return {
        type: 'link',
        url: decodeURIComponent(op.attributes?.link ?? ''),
        children: [node],
      }
    case 'emphasis':
      return {
        type: 'emphasis',
        children: [node],
      }
    case 'strong':
      return {
        type: 'strong',
        children: [node],
      }
    case 'delete':
      return {
        type: 'delete',
        children: [node],
      }
    default:
      return undefined as never
  }
}

const transformOperationToPhrasingContent = (
  op: Operation,
  marks: MarkNodeType[],
  mentionUsers: mdast.InlineCode[],
): mdast.PhrasingContent => {
  const literal = createLiteralNode(op)

  if (literal.type === 'inlineCode' && literal.data?.mentionUserId) {
    mentionUsers.push(literal)
  }

  return marks.reduce<mdast.PhrasingContent>(
    (node, mark) => wrapWithMark(node, mark, op),
    literal,
  )
}

const transformOperationsToPhrasingContents = (
  ops: Operation[],
): { contents: mdast.PhrasingContent[]; mentionUsers: mdast.InlineCode[] } => {
  const mentionUsers: mdast.InlineCode[] = []

  const operations = ops
    .filter(isRenderableOperation)
    .map(normalizeInlineComponentOperation)
  const marksByIndex = operations.map(getOperationMarks)
  const nodes = operations.map((op, index) =>
    transformOperationToPhrasingContent(
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

const generateMermaidTimeline = (items: Timeline[]): string => {
  let chart = 'timeline\n'

  items.forEach(item => {
    const cleanTitle = (item.title || '').replace(/:/g, '：')
    const time = item.time || ''

    if (item.text) {
      const cleanText = item.text.replace(/\n/g, '<br>')
      chart += `    ${time} : ${cleanTitle} : ${cleanText}\n`
    } else {
      chart += `    ${time} : ${cleanTitle}\n`
    }
  })

  return chart
}

const evaluateAlt = (caption?: Caption) =>
  trimEndEnter(caption?.text.initialAttributedTexts.text?.[0] ?? '')

export interface TableWithParent {
  inner: mdast.Table
  parent: mdast.Parent | null
}

interface TransformResult {
  root: mdast.Root
  tableWithParents: TableWithParent[]
  mentionUsers: mdast.InlineCode[]
}

class Transformer {
  private parent: mdast.Parent | null = null
  private mentionUsers: mdast.InlineCode[] = []
  private tableWithParents: TableWithParent[] = []
  /**
   * heading sequence state
   */
  private sequences: (string | undefined)[] = []

  private normalizeImage(image: mdast.Image): mdast.Image | mdast.Paragraph {
    return this.parent?.type === 'tableCell'
      ? image
      : { type: 'paragraph', children: [image] }
  }

  private isTextContainerBlock(
    block: Blocks,
  ): block is HeadingBlock | TextBlock {
    return (
      block.type === BlockType.HEADING1 ||
      block.type === BlockType.HEADING2 ||
      block.type === BlockType.HEADING3 ||
      block.type === BlockType.HEADING4 ||
      block.type === BlockType.HEADING5 ||
      block.type === BlockType.HEADING6 ||
      block.type === BlockType.HEADING7 ||
      block.type === BlockType.HEADING8 ||
      block.type === BlockType.HEADING9 ||
      block.type === BlockType.TEXT
    )
  }

  private flattenChildren(children: Blocks[]): Blocks[] {
    return children.flatMap(child => {
      if (child.type === BlockType.GRID) {
        return this.flattenChildren(
          child.children.map(column => column.children).flat(1),
        )
      }

      if (this.isTextContainerBlock(child)) {
        return [child, ...this.flattenChildren(child.children)]
      }

      if (child.type === BlockType.SYNCED_SOURCE) {
        return this.flattenChildren(child.children)
      }

      if (child.type === BlockType.SYNCED_REFERENCE) {
        return this.flattenChildren(
          child.innerBlockManager?.rootBlockModel?.children ?? child.children,
        )
      }

      return [child]
    })
  }

  private transformInlineContents(block: Block): mdast.PhrasingContent[] {
    const { contents, mentionUsers } = transformOperationsToPhrasingContents(
      block.zoneState?.content.ops ?? [],
    )

    mentionUsers.forEach(user => {
      if (user.data) {
        user.data.parentBlockRecordId = block.record?.id
      }
    })

    this.mentionUsers = this.mentionUsers.concat(mentionUsers)

    return contents
  }

  private createListItem(
    block: BulletBlock | OrderedBlock | TodoBlock,
  ): mdast.ListItem {
    const listItem: mdast.ListItem = {
      type: 'listItem',
      children: [],
    }

    if (block.type === BlockType.TODO) {
      listItem.checked = Boolean(block.snapshot.done)
    }

    if (block.type === BlockType.ORDERED) {
      listItem.data = {
        seq: /[0-9]+/.test(block.snapshot.seq)
          ? Number(block.snapshot.seq)
          : 'auto',
      }
    }

    return listItem
  }

  private createHeadingSequenceText(
    block: HeadingBlock,
    depth: mdast.Heading['depth'],
  ): mdast.Text | null {
    const { seq, seq_level: seqLevel } = block.snapshot

    if (typeof seq !== 'string') {
      return null
    }

    this.sequences = this.sequences.slice(0, depth)

    if (seq === 'auto') {
      const previousSequenceSibling = this.sequences[depth - 1] ?? '0'
      this.sequences[depth - 1] = String(
        parseInt(previousSequenceSibling, 10) + 1,
      )
    } else {
      this.sequences[depth - 1] = seq
    }

    const sequences =
      seqLevel === 'auto'
        ? this.sequences.slice(0, depth).filter(isString)
        : [seq]

    return {
      type: 'text',
      value: sequences.join('.') + (sequences.length === 1 ? '. ' : ' '),
    }
  }

  private transformHeading(block: HeadingBlock): mdast.Heading {
    const depth = Number(block.type.at(-1)) as mdast.Heading['depth']
    const sequenceText = this.createHeadingSequenceText(block, depth)

    return {
      type: 'heading',
      depth,
      children: [
        ...(sequenceText ? [sequenceText] : []),
        ...this.transformInlineContents(block),
      ],
    }
  }

  private createTable(block: TableBlock | Grid): mdast.Table {
    return {
      type: 'table',
      children: [],
      data: {
        type: block.type,
        ...(block.type === BlockType.TABLE
          ? { cellSet: block.snapshot.cell_set }
          : {}),
      },
    }
  }

  private resolveTableColumnWidths(
    block: TableBlock | Grid,
    cells: mdast.TableCell[],
  ): number[] | undefined {
    if (block.type === BlockType.TABLE) {
      return block.snapshot.columns_id.map(
        id => block.snapshot.column_set[id].column_width,
      )
    }

    const widths = cells.map(cell => cell.data?.width)

    return widths.every((width): width is number => typeof width === 'number')
      ? widths
      : undefined
  }

  private createTableRows(
    block: TableBlock | Grid,
    cells: mdast.TableCell[],
  ): mdast.TableRow[] {
    const rows =
      block.type === BlockType.GRID
        ? [cells]
        : chunk(cells, block.snapshot.columns_id.length)

    return rows.map(children => ({
      type: 'tableRow',
      children,
    }))
  }

  private updateTableData(
    table: mdast.Table,
    block: TableBlock | Grid,
    cells: mdast.TableCell[],
  ): void {
    const colWidths = this.resolveTableColumnWidths(block, cells)

    table.data = {
      ...table.data,
      type: block.type,
      ...(colWidths ? { colWidths } : {}),
      invalid: cells.some(cell => cell.data?.invalidChildren),
    }
  }

  private transformTable(block: TableBlock | Grid): mdast.Table {
    const table = this.createTable(block)

    this.transformParentBlock(block, table, nodes => {
      const cells = nodes.filter(isTableCell)
      this.updateTableData(table, block, cells)
      return this.createTableRows(block, cells)
    })

    this.tableWithParents.push({
      inner: table,
      parent: this.parent,
    })

    return table
  }

  private createTableCell(block: TableCellBlock | GridColumn): mdast.TableCell {
    return {
      type: 'tableCell',
      children: [],
      ...(block.type === BlockType.GRID_COLUMN
        ? { data: { width: block.snapshot.width_ratio } }
        : {
            data: {
              ...toCamelCaseKeys(
                (this.parent as mdast.Table).data?.cellSet?.[block.cellId]
                  ?.merge_info,
              ),
            },
          }),
    }
  }

  private flattenTableCellNode(
    node: mdast.Nodes,
    next?: mdast.Nodes,
  ): mdast.Nodes[] {
    return [
      ...(node.type === 'paragraph' ? node.children : [node]),
      ...(next && node.type === 'paragraph' && next.type === 'paragraph'
        ? [{ type: 'html', value: '<br />' } satisfies mdast.Html]
        : []),
    ]
  }

  private normalizeTableCellChildren(
    nodes: mdast.Nodes[],
    cell: mdast.TableCell,
  ): mdast.PhrasingContent[] {
    const normalizedNodes = mergeListItems(nodes).flatMap(
      (node, index, nodes) =>
        this.flattenTableCellNode(node, nodes.at(index + 1)),
    )

    if (normalizedNodes.every(isPhrasingContent)) {
      return normalizedNodes
    }

    cell.data = {
      ...cell.data,
      invalidChildren: normalizedNodes,
    }

    return normalizedNodes.filter(isPhrasingContent)
  }

  private transformTableCell(block: TableCellBlock | GridColumn) {
    const cell = this.createTableCell(block)

    return this.transformParentBlock(block, cell, nodes =>
      this.normalizeTableCellChildren(nodes, cell),
    )
  }

  private transformParentBlock<P extends mdast.Parent>(
    block: Block,
    currentParent: P,
    transformChildren: (children: mdast.Nodes[]) => P['children'],
  ): P {
    const previousParent = this.parent
    this.parent = currentParent

    try {
      currentParent.children = transformChildren(
        this.flattenChildren(block.children)
          .map(this._transform)
          .filter(isDefined),
      )

      return currentParent
    } finally {
      this.parent = previousParent
    }
  }

  private transformRoot(block: PageBlock): mdast.Root {
    const root: mdast.Root = {
      type: 'root',
      children: [],
    }

    return this.transformParentBlock(block, root, nodes =>
      mergeListItems(nodes).filter(isRootContent),
    )
  }

  private _transform = (block: Blocks): mdast.Nodes | null => {
    switch (block.type) {
      case BlockType.PAGE: {
        return this.transformRoot(block)
      }
      case BlockType.DIVIDER: {
        const thematicBreak: mdast.ThematicBreak = {
          type: 'thematicBreak',
        }
        return thematicBreak
      }
      case BlockType.HEADING1:
      case BlockType.HEADING2:
      case BlockType.HEADING3:
      case BlockType.HEADING4:
      case BlockType.HEADING5:
      case BlockType.HEADING6: {
        return this.transformHeading(block)
      }
      case BlockType.CODE: {
        const code: mdast.Code = {
          type: 'code',
          lang: block.language.toLocaleLowerCase(),
          value: trimEndEnter(block.zoneState?.allText ?? ''),
        }
        return code
      }
      case BlockType.QUOTE_CONTAINER:
      case BlockType.CALLOUT: {
        const blockquote: mdast.Blockquote = {
          type: 'blockquote',
          children: [],
        }

        return this.transformParentBlock(block, blockquote, nodes =>
          mergeListItems(nodes).filter(isBlockquoteContent),
        )
      }
      case BlockType.BULLET:
      case BlockType.ORDERED:
      case BlockType.TODO: {
        const paragraph: mdast.Paragraph = {
          type: 'paragraph',
          children: this.transformInlineContents(block),
        }
        return this.transformParentBlock(
          block,
          this.createListItem(block),
          nodes => [
            paragraph,
            ...mergeListItems(nodes).filter(isListItemContent),
          ],
        )
      }
      case BlockType.TEXT:
      case BlockType.HEADING7:
      case BlockType.HEADING8:
      case BlockType.HEADING9: {
        const paragraph: mdast.Paragraph = {
          type: 'paragraph',
          children: this.transformInlineContents(block),
        }
        return paragraph
      }
      case BlockType.IMAGE: {
        const { caption, token } = block.snapshot.image
        const image: mdast.Image = {
          type: 'image',
          url: token,
          alt: evaluateAlt(caption),
        }

        return this.normalizeImage(image)
      }
      case BlockType.WHITEBOARD: {
        return null
      }
      case BlockType.DIAGRAM: {
        return null
      }
      case BlockType.TABLE:
      case BlockType.GRID: {
        return this.transformTable(block)
      }
      case BlockType.CELL:
      case BlockType.GRID_COLUMN: {
        return this.transformTableCell(block)
      }
      case BlockType.VIEW: {
        return null
      }
      case BlockType.FILE: {
        return null
      }
      case BlockType.IFRAME: {
        return iframeToHTML(block)
      }
      case BlockType.ISV: {
        if (block.snapshot.block_type_id === ISVBlockTypeId.TextDrawing) {
          const code: mdast.Code = {
            type: 'code',
            lang: 'mermaid',
            value: block.snapshot.data.data,
          }

          return code
        } else if (block.snapshot.block_type_id === ISVBlockTypeId.Timeline) {
          const code: mdast.Code = {
            type: 'code',
            lang: 'mermaid',
            value: generateMermaidTimeline(block.snapshot.data.items),
          }

          return code
        }

        return null
      }
      default:
        return null
    }
  }

  private reset(): void {
    this.parent = null
    this.tableWithParents = []
    this.mentionUsers = []
    this.sequences = []
  }

  transform(block: PageBlock): TransformResult {
    const root = this.transformRoot(block)

    const result: TransformResult = {
      root,
      tableWithParents: this.tableWithParents,
      mentionUsers: this.mentionUsers,
    }

    this.reset()

    return result
  }
}

export class Docx {
  static stringify(root: mdast.Root, options?: Options): string {
    return toMarkdown(root, {
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
  }

  static async locateBlockWithRecordId(recordId: string): Promise<boolean> {
    try {
      if (!PageMain) {
        return false
      }

      return await PageMain.locateBlockWithRecordIdImpl(recordId)
    } catch (error) {
      console.error(error)
    }

    return false
  }

  get isDocx(): boolean {
    return isDocx()
  }

  get isDoc(): boolean {
    return !isDocx() && isDoc()
  }

  get rootBlock(): PageBlock | null {
    if (!PageMain) {
      return null
    }

    return PageMain.blockManager.rootBlockModel
  }

  get pageTitle(): string | undefined {
    if (!this.rootBlock?.zoneState) return undefined

    return trimEndEnter(this.rootBlock.zoneState.allText)
  }

  get container(): HTMLDivElement | null {
    const container = document.querySelector<HTMLDivElement>(
      '#mainBox .bear-web-x-container',
    )

    return container
  }

  isReady(
    options: {
      /**
       * @default false
       */
      checkWhiteboard?: boolean
    } = {},
  ): boolean {
    const { checkWhiteboard = false } = options

    return (
      !!this.rootBlock &&
      this.rootBlock.children.every(block => {
        const prerequisite = block.snapshot.type !== 'pending'

        const isWhiteboard = (block: Blocks): boolean =>
          block.type === BlockType.WHITEBOARD ||
          (block.type === BlockType.FALLBACK &&
            block.snapshot.type === BlockType.WHITEBOARD)

        const isSyncedReferenceReady = (block: Blocks): boolean =>
          block.type !== BlockType.SYNCED_REFERENCE || block.isAllDataReady

        if (checkWhiteboard && isWhiteboard(block)) {
          return prerequisite && block.type !== BlockType.FALLBACK
        }

        return prerequisite && isSyncedReferenceReady(block)
      })
    )
  }

  scrollTo(options: ScrollToOptions): void {
    const container = this.container
    if (container) {
      const {
        left,
        top = container.scrollHeight,
        behavior = 'smooth',
      } = options

      container.scrollTo({
        left,
        top: Math.min(top, container.scrollHeight),
        behavior,
      })
    }
  }

  intoMarkdownAST(): TransformResult {
    if (!this.rootBlock) {
      return {
        root: { type: 'root', children: [] },
        tableWithParents: [],
        mentionUsers: [],
      }
    }

    const transformer = new Transformer()

    return transformer.transform(this.rootBlock)
  }
}

export const docx: Docx = new Docx()
