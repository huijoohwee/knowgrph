import { computeMarkdownTocReorder } from 'grph-shared/markdown/toc'
import type { TocItem } from './markdownSectionUtils'
import type { MarkdownTocDropPosition } from './useMarkdownTocDragAndDrop'

export type MarkdownTocReorderCommit = (parentId: string | null, fromIndex: number, toIndex: number) => void

export function applyMarkdownTocReorderByIds(args: {
  root: TocItem[]
  sourceId: string
  targetId: string
  position: MarkdownTocDropPosition
  onReorder: MarkdownTocReorderCommit
}): boolean {
  const move = computeMarkdownTocReorder({
    root: args.root,
    sourceId: args.sourceId,
    targetId: args.targetId,
    position: args.position,
  })
  if (!move) return false
  args.onReorder(move.parentId, move.fromIndex, move.toIndex)
  return true
}
