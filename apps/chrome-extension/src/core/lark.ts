/**
 * Keep known unsupported values here too. Transformer handles them explicitly
 * as unsupported block types instead of collapsing them into unknown strings.
 *
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
}

export interface Operation {
  attributes: Attributes
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
  /**
   * Not consumed by the current transformer, but this is the stable link back
   * to the page block maps. The primary window.DATA map can be partial; the
   * fallback maps in window.docxClientvarFetchManager._clientvarMap may contain
   * records that are missing there. For persisted records, the matching entry
   * data is structurally equivalent to this snapshot, though it is not always
   * the same object reference:
   * block.snapshot ~= getClientVarsDataSources()
   *   .find(data => data.block_map[block.recordId])
   *   ?.block_map[block.recordId]?.data
   *
   * Keep this member in the model so future cleanups do not erase that
   * important runtime relationship.
   */
  recordId: string
  type: BlockType
  zoneState?: BlockZoneState
  snapshot: BlockSnapshot
  children: T[]
}

export interface BlockWithZoneState<T extends Blocks = Blocks>
  extends Block<T> {
  zoneState: BlockZoneState
}

export interface PageBlock extends BlockWithZoneState {
  type: BlockType.PAGE
}

export interface PageMain {
  blockManager: {
    rootBlockModel: PageBlock
  }
}

export interface ClientVarsData {
  block_map: Record<string, { data: BlockSnapshot } | undefined>
  user_map: Record<string, { name: string } | undefined>
}

export interface DocxClientvarFetchManager {
  _clientvarMap?: Map<unknown, { data: ClientVarsData }>
}

declare global {
  interface Window {
    DATA?: {
      clientVars: {
        data: ClientVarsData
      }
    }
    docxClientvarFetchManager?: DocxClientvarFetchManager
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

export const getClientVarsDataSources = (): ClientVarsData[] => {
  if (typeof window === 'undefined') return []

  return [
    window.DATA?.clientVars.data,
    ...Array.from(
      window.docxClientvarFetchManager?._clientvarMap?.values() ?? [],
      value => value.data,
    ),
  ].filter((data): data is ClientVarsData => data !== undefined)
}

export const getMentionUserName = (uid: string): string | undefined =>
  getClientVarsDataSources()
    .map(data => data.user_map[uid]?.name)
    .find((name): name is string => typeof name === 'string' && name.length > 0)

export interface DividerBlock extends Block {
  type: BlockType.DIVIDER
}

export interface HeadingBlock extends BlockWithZoneState<TextBlock> {
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

export interface CodeBlock extends BlockWithZoneState<TextBlock> {
  type: BlockType.CODE
  language: string
}

export interface BulletBlock extends BlockWithZoneState {
  type: BlockType.BULLET
}

export interface OrderedBlock extends BlockWithZoneState<TextBlock> {
  type: BlockType.ORDERED
  snapshot: {
    type: BlockType.ORDERED
    seq: string
  }
}

export interface TodoBlock extends BlockWithZoneState {
  type: BlockType.TODO
  snapshot: {
    type: BlockType.TODO
    done: boolean
  }
}

export interface TextBlock extends BlockWithZoneState {
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
  caption: Caption
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
    width_ratio: number
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

/**
 * These known block types are intentionally unsupported today. Keep the
 * explicit type and UnsupportedBlock model so future cleanups do not delete the
 * support boundary by accident.
 */
export type UnsupportedBlockType =
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

export interface UnsupportedBlock extends Block {
  type: UnsupportedBlockType
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
