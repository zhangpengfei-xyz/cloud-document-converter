import type * as mdast from 'mdast'
import type { CellData } from './lark'

declare module 'mdast' {
  interface ListItemData {
    seq?: number | 'auto'
  }

  interface TableData {
    type?: 'table' | 'grid'
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
}

export {}
