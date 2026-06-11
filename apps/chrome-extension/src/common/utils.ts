import { toHast } from 'mdast-util-to-hast'
import { toHtml } from 'hast-util-to-html'
import {
  Docx,
  type TableWithParent,
  type mdast,
  type hast,
  BlockType,
} from '../lark'
import { Second, waitForFunction } from '../shared'

/**
 * Filters out redundant cells that are covered by rowSpan/colSpan
 * and adds appropriate HTML properties to the spanning cells.
 *
 * @param table The Markdown AST table to process
 */
const processTableSpans = (table: mdast.Table): void => {
  const occupied: boolean[][] = []

  for (let rowIndex = 0; rowIndex < table.children.length; rowIndex++) {
    const row = table.children[rowIndex]
    const newCells: mdast.TableCell[] = []

    for (
      let columnIndex = 0;
      columnIndex < row.children.length;
      columnIndex++
    ) {
      // If this position is covered by a previous spanning cell, skip it
      if (occupied[rowIndex]?.[columnIndex]) continue

      const cell = row.children[columnIndex]
      newCells.push(cell)

      const rowSpan = cell.data?.rowSpan ?? 1
      const colSpan = cell.data?.colSpan ?? 1

      if (rowSpan > 1 || colSpan > 1) {
        // Ensure data and hProperties objects exist
        cell.data ??= {}
        cell.data.hProperties ??= {}

        // Add HTML span properties for correct rendering
        if (rowSpan > 1) cell.data.hProperties['rowSpan'] = rowSpan
        if (colSpan > 1) cell.data.hProperties['colSpan'] = colSpan

        // Mark the area covered by this spanning cell as occupied
        for (let i = 0; i < rowSpan; i++) {
          for (let j = 0; j < colSpan; j++) {
            // Skip the current cell itself
            if (i === 0 && j === 0) continue
            const targetRow = rowIndex + i
            const targetCol = columnIndex + j
            occupied[targetRow] ??= []
            occupied[targetRow][targetCol] = true
          }
        }
      }
    }

    // Update row children with only the non-redundant cells
    row.children = newCells
  }
}

const replaceInvalidTableChildren = (table: mdast.Table): mdast.Table => {
  if (!table.data?.invalid) return table

  return {
    ...table,
    children: table.children.map(row => ({
      ...row,
      children: row.children.map(cell => ({
        ...cell,
        children: cell.data?.invalidChildren ?? cell.children,
      })),
    })),
  } as mdast.Table
}

export const transformTablesToHtml = (tables: TableWithParent[]): void => {
  tables.forEach(table => {
    const tableIndex = table.parent?.children.findIndex(
      child => child === table.inner,
    )
    if (tableIndex !== undefined && tableIndex !== -1) {
      const inner = replaceInvalidTableChildren(table.inner)

      processTableSpans(inner)

      const hastTable = toHast(inner, {
        allowDangerousHtml: true,
      })

      if (hastTable.type === 'element') {
        const hastColGroup: hast.Element = {
          type: 'element',
          tagName: 'colgroup',
          properties: {},
          children:
            inner.data?.colWidths?.map(width => ({
              type: 'element',
              tagName: 'col',
              properties: {
                width:
                  inner.data?.type === BlockType.GRID
                    ? `${width.toFixed(2)}%`
                    : width,
              },
              children: [],
            })) ?? [],
        }

        hastTable.children = ([hastColGroup] as hast.ElementContent[]).concat(
          hastTable.children,
        )
      }

      table.parent?.children.splice(tableIndex, 1, {
        type: 'html',
        value: toHtml(hastTable, {
          allowDangerousHtml: true,
        }),
      })
    }
  })
}

export const transformMentionUsers = async (
  mentionUsers: mdast.InlineCode[],
): Promise<void> => {
  for (const user of mentionUsers) {
    if (user.data?.parentBlockRecordId && user.data.mentionUserId) {
      await waitForFunction(
        () =>
          Docx.locateBlockWithRecordId(
            user.data?.parentBlockRecordId ?? '',
          ).then(
            isSuccess =>
              isSuccess &&
              document.querySelector(
                `a[data-token="${user.data?.mentionUserId ?? ''}"]`,
              ) !== null,
          ),
        {
          timeout: 3 * Second,
        },
      )

      const el: HTMLElement | null = document.querySelector(
        `a[data-token="${user.data.mentionUserId}"]`,
      )

      if (el?.innerText) {
        user.value = '@' + el.innerText
      }
    }
  }
}
