import type * as mdast from 'mdast'
import type { BlockType, CellData } from './lark'

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

export {}
