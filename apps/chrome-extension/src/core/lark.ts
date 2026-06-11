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

export interface Attributes {
  fixEnter?: string

  italic?: string
  bold?: string
  strikethrough?: string
  underline?: string

  inlineCode?: string
  equation?: string
  'inline-component'?: string

  link?: string
  mentionUserId?: string
}

export interface Operation {
  attributes?: Attributes
  insert: string
}

export interface BlockZoneState {
  allText: string
  content: {
    ops: Operation[]
  }
}

export interface BlockSnapshot {
  type: BlockType | 'pending'
}

export interface Block<T extends Blocks = Blocks> {
  id?: string
  type: BlockType
  zoneState?: BlockZoneState
  record?: { id: string }
  snapshot: BlockSnapshot
  children: T[]
}

export interface PageBlock extends Block {
  type: BlockType.PAGE
}

export interface PageMain {
  blockManager: {
    rootBlockModel: PageBlock
  }

  locateBlockWithRecordIdImpl(
    recordId: string,
    options?: Record<string, unknown>,
  ): Promise<boolean>
}

declare global {
  interface Window {
    editor?: object
    PageMain?: PageMain
  }
}

export const getPageMain = (): PageMain | undefined =>
  typeof window === 'undefined' ? undefined : window.PageMain
export const isDoc = (): boolean =>
  typeof window !== 'undefined' && window.editor !== undefined
export const isDocx = (): boolean => getPageMain() !== undefined

export const getRootBlock = (): PageBlock | null =>
  getPageMain()?.blockManager.rootBlockModel ?? null

export const locateBlockWithRecordId = async (
  recordId: string,
): Promise<boolean> => {
  try {
    return (await getPageMain()?.locateBlockWithRecordIdImpl(recordId)) ?? false
  } catch (error) {
    console.error(error)
  }

  return false
}

export interface DividerBlock extends Block {
  type: BlockType.DIVIDER
}

export interface HeadingBlock extends Block<TextBlock> {
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

export interface CodeBlock extends Block<TextBlock> {
  type: BlockType.CODE
  language: string
}

export interface BulletBlock extends Block {
  type: BlockType.BULLET
}

export interface OrderedBlock extends Block<TextBlock> {
  type: BlockType.ORDERED
  snapshot: {
    type: BlockType.ORDERED
    seq: string
  }
}

export interface TodoBlock extends Block {
  type: BlockType.TODO
  snapshot: {
    type: BlockType.TODO
    done?: boolean
  }
}

export interface TextBlock extends Block {
  type: BlockType.TEXT
}

export interface Caption {
  text: {
    initialAttributedTexts: {
      text: { 0: string } | null
    }
  }
}

export interface ImageBlockData {
  token: string
  caption?: Caption
}

export interface ImageBlock extends Block {
  type: BlockType.IMAGE
  snapshot: {
    type: BlockType.IMAGE
    image: ImageBlockData
  }
}

export interface MergeInfo {
  row_span: number
  col_span: number
}

export interface ColumnData {
  column_width: number
}

export interface CellData {
  merge_info: MergeInfo
}

export interface TableBlock extends Block<TableCellBlock> {
  type: BlockType.TABLE
  snapshot: {
    type: BlockType.TABLE
    columns_id: string[]
    column_set: Record<string, ColumnData>
    cell_set: Record<string, CellData>
  }
}

export interface TableCellBlock extends Block {
  type: BlockType.CELL
  cellId: string
}

export interface Grid extends Block<GridColumn> {
  type: BlockType.GRID
}

export interface GridColumn extends Block {
  type: BlockType.GRID_COLUMN
  snapshot: {
    type: BlockType.GRID_COLUMN
    width_ratio?: number
  }
}

export interface BlockquoteContainerBlock extends Block {
  type: BlockType.QUOTE_CONTAINER | BlockType.CALLOUT
}

export interface SyncedSource extends Block {
  type: BlockType.SYNCED_SOURCE
}

export interface SyncedReference extends Block {
  type: BlockType.SYNCED_REFERENCE
  isAllDataReady: boolean
  innerBlockManager?: {
    rootBlockModel?: PageBlock
  }
}

export interface UnsupportedBlock extends Block {
  type:
    | BlockType.BITABLE
    | BlockType.CHAT_CARD
    | BlockType.DIAGRAM
    | BlockType.FALLBACK
    | BlockType.FILE
    | BlockType.MINDNOTE
    | BlockType.QUOTE
    | BlockType.SHEET
    | BlockType.VIEW
    | BlockType.WHITEBOARD
}

export interface IframeBlock extends Block {
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

export enum ISVBlockTypeId {
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
  Other = '',
}

export interface TextDrawingBlock extends Block {
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

export interface Timeline {
  time: string
  title: string
  text?: string
}

export interface TimelineBlock extends Block {
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

export interface OtherISVBlock extends Block {
  type: BlockType.ISV
  snapshot: {
    type: BlockType.ISV
    block_type_id: ISVBlockTypeId.Other
  }
}

export type Blocks =
  | PageBlock
  | DividerBlock
  | HeadingBlock
  | CodeBlock
  | BlockquoteContainerBlock
  | BulletBlock
  | OrderedBlock
  | TodoBlock
  | TextBlock
  | ImageBlock
  | TableBlock
  | TableCellBlock
  | Grid
  | GridColumn
  | SyncedSource
  | SyncedReference
  | UnsupportedBlock
  | IframeBlock
  | TextDrawingBlock
  | TimelineBlock
  | OtherISVBlock
