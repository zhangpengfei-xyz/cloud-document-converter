import type * as mdast from 'mdast'
import { chunk } from 'es-toolkit/array'
import { toCamelCaseKeys } from 'es-toolkit/object'
import { isNotNil, isString } from 'es-toolkit/predicate'
import {
  isBlockquoteContent,
  isListItemContent,
  isPhrasingContent,
  isRootContent,
  isTableCell,
} from './markdown-ast'
import {
  BlockType,
  ISVBlockTypeId,
  type Block,
  type Blocks,
  type BulletBlock,
  type Grid,
  type GridColumn,
  type HeadingBlock,
  type ImageBlock,
  type OrderedBlock,
  type PageBlock,
  type TableBlock,
  type TableCellBlock,
  type TextBlock,
  type TodoBlock,
} from './lark'
import { generateMermaidTimeline, iframeToHtml } from './embeds'
import {
  transformOperationsToPhrasingContents,
  trimTrailingLineBreak,
} from './inline'
import { mergeListItems } from './list'

export interface TableWithParent {
  inner: mdast.Table
  parent: mdast.Parent | null
}

export interface TransformResult {
  root: mdast.Root
  tableWithParents: TableWithParent[]
  mentionUsers: mdast.InlineCode[]
}

export class Transformer {
  private parent: mdast.Parent | null = null
  private mentionUsers: mdast.InlineCode[] = []
  private tableWithParents: TableWithParent[] = []
  private sequences: (string | undefined)[] = []
  private orderedListSequences = new WeakMap<mdast.Parent, number>()

  private transformImage(block: ImageBlock): mdast.Image | mdast.Paragraph {
    return this.normalizeImage(this.createImage(block))
  }

  private createImage(block: ImageBlock): mdast.Image {
    const { caption, token } = block.snapshot.image
    const alt =
      trimTrailingLineBreak(
        caption?.text.initialAttributedTexts.text?.[0] ?? '',
      ) || token

    return {
      type: 'image',
      url: `https://internal-api-drive-stream.larkoffice.com/space/api/box/stream/download/preview/${encodeURIComponent(token)}?preview_type=16`,
      alt,
      title: null,
    }
  }

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
          child.children.flatMap(column => column.children),
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

  private createParagraph(
    children: mdast.PhrasingContent[],
  ): mdast.Paragraph | null {
    return children.length > 0
      ? {
          type: 'paragraph',
          children,
        }
      : null
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
        seq: this.resolveOrderedListSequence(block),
      }
    }

    return listItem
  }

  private resolveOrderedListSequence(block: OrderedBlock): number | 'auto' {
    const seq = /^\d+$/.test(block.snapshot.seq)
      ? Number(block.snapshot.seq)
      : null

    if (!this.parent) {
      return seq ?? 'auto'
    }

    if (seq !== null) {
      this.orderedListSequences.set(this.parent, seq)
      return seq
    }

    const nextSeq = (this.orderedListSequences.get(this.parent) ?? 0) + 1
    this.orderedListSequences.set(this.parent, nextSeq)
    return nextSeq
  }

  private createHeadingSequenceText(
    block: HeadingBlock,
    depth: mdast.Heading['depth'],
  ): mdast.Text | null {
    const { seq, seq_level: seqLevel } = block.snapshot

    if (typeof seq !== 'string') {
      this.sequences = this.sequences.slice(0, depth - 1)
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
    const children = this.transformInlineContents(block)

    if (sequenceText) {
      if (children[0]?.type === 'text') {
        children[0] = {
          ...children[0],
          value: sequenceText.value + children[0].value,
        }
      } else {
        children.unshift(sequenceText)
      }
    }

    return {
      type: 'heading',
      depth,
      children,
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

  private normalizeInvalidTableCellNode(node: mdast.Nodes): mdast.Nodes {
    return node.type === 'image'
      ? {
          type: 'paragraph',
          children: [node],
        }
      : node
  }

  private normalizeTableCellChildren(
    nodes: mdast.Nodes[],
    cell: mdast.TableCell,
  ): mdast.PhrasingContent[] {
    const mergedNodes = mergeListItems(nodes)
    const normalizedNodes = mergedNodes.flatMap((node, index, nodes) =>
      this.flattenTableCellNode(node, nodes.at(index + 1)),
    )

    if (normalizedNodes.every(isPhrasingContent)) {
      return normalizedNodes
    }

    cell.data = {
      ...cell.data,
      invalidChildren: mergedNodes.map(node =>
        this.normalizeInvalidTableCellNode(node),
      ),
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
          .map(this.transformBlock)
          .filter(isNotNil),
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

  private transformBlock = (block: Blocks): mdast.Nodes | null => {
    switch (block.type) {
      case BlockType.PAGE: {
        return this.transformRoot(block)
      }
      case BlockType.DIVIDER: {
        return {
          type: 'thematicBreak',
        }
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
        return {
          type: 'code',
          lang: block.language ? block.language.toLocaleLowerCase() : null,
          meta: null,
          value: trimTrailingLineBreak(block.zoneState?.allText ?? ''),
        }
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
        const paragraph = this.createParagraph(
          this.transformInlineContents(block),
        )
        return this.transformParentBlock(
          block,
          this.createListItem(block),
          nodes => [
            ...(paragraph ? [paragraph] : []),
            ...mergeListItems(nodes).filter(isListItemContent),
          ],
        )
      }
      case BlockType.TEXT:
      case BlockType.HEADING7:
      case BlockType.HEADING8:
      case BlockType.HEADING9: {
        return this.createParagraph(this.transformInlineContents(block))
      }
      case BlockType.IMAGE: {
        return this.transformImage(block)
      }
      case BlockType.BITABLE:
      case BlockType.CHAT_CARD:
      case BlockType.WHITEBOARD:
      case BlockType.DIAGRAM:
      case BlockType.FALLBACK:
      case BlockType.VIEW:
      case BlockType.FILE:
      case BlockType.MINDNOTE:
      case BlockType.QUOTE:
      case BlockType.SHEET: {
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
      case BlockType.IFRAME: {
        return iframeToHtml(block)
      }
      case BlockType.ISV: {
        switch (block.snapshot.block_type_id) {
          case ISVBlockTypeId.TextDrawing:
            return {
              type: 'code',
              lang: 'mermaid',
              value: block.snapshot.data.data,
            }
          case ISVBlockTypeId.Timeline:
            return {
              type: 'code',
              lang: 'mermaid',
              value: generateMermaidTimeline(block.snapshot.data.items),
            }
          default:
            return null
        }
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
    this.orderedListSequences = new WeakMap()
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
