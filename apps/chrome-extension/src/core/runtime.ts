import type { PageBlock } from './lark'

export interface PageMain {
  blockManager: {
    rootBlockModel: PageBlock
  }

  locateBlockWithRecordIdImpl(
    recordId: string,
    options?: Record<string, unknown>,
  ): Promise<boolean>
}

export const PageMain: PageMain | undefined = window.PageMain

export const isDoc = (): boolean => window.editor !== undefined
export const isDocx = (): boolean => window.PageMain !== undefined
