import type * as mdast from 'mdast'
import type { MarkdownStringifyOptions } from './markdown'
import { stringifyMarkdown } from './markdown'
import { PageMain, isDoc, isDocx } from './runtime'
import { BlockType, type Blocks, type PageBlock } from './lark'
import { Transformer, type TransformResult } from './transformer'

export { BlockType } from './lark'
export type { PageBlock } from './lark'
export type { TableWithParent, TransformResult } from './transformer'

const emptyTransformResult = (): TransformResult => ({
  root: { type: 'root', children: [] },
  tableWithParents: [],
  mentionUsers: [],
})

const isBlockReady = (block: Blocks): boolean => {
  if (block.snapshot.type === 'pending') {
    return false
  }

  if (block.type === BlockType.SYNCED_REFERENCE && !block.isAllDataReady) {
    return false
  }

  const children =
    block.type === BlockType.SYNCED_REFERENCE
      ? (block.innerBlockManager?.rootBlockModel?.children ?? block.children)
      : block.children

  return children.every(isBlockReady)
}

export class Docx {
  static stringify(
    root: mdast.Root,
    options?: MarkdownStringifyOptions,
  ): string {
    return stringifyMarkdown(root, options)
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

  isReady(): boolean {
    return !!this.rootBlock && this.rootBlock.children.every(isBlockReady)
  }

  intoMarkdownAST(): TransformResult {
    if (!this.rootBlock) {
      return emptyTransformResult()
    }

    const transformer = new Transformer()

    return transformer.transform(this.rootBlock)
  }
}

export const docx: Docx = new Docx()
