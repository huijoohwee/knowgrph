import React from 'react'
import { computeMarkdownTocMove } from 'grph-shared/markdown/toc'
import { buildTocTree, type TocItem } from './markdownSectionUtils'
import {
  applyMarkdownTocReorderByIds,
  type MarkdownTocReorderCommit,
} from './markdownTocReorder'
import type { TokenWithLines } from './markdownPreviewLex'
import type { MarkdownTocDropPosition } from './useMarkdownTocDragAndDrop'

export function useMarkdownTocTreeState(args: {
  tokens: TokenWithLines[]
  onReorder?: MarkdownTocReorderCommit
}) {
  const { tokens, onReorder } = args
  const items = React.useMemo(() => buildTocTree(tokens), [tokens])

  const onReorderByIds = React.useMemo(() => {
    if (!onReorder) return undefined
    return (sourceId: string, targetId: string, position: MarkdownTocDropPosition) =>
      applyMarkdownTocReorderByIds({
        root: items,
        sourceId,
        targetId,
        position,
        onReorder,
      })
  }, [items, onReorder])

  const onMoveItem = React.useMemo(() => {
    if (!onReorder) return undefined
    return (id: string, direction: 'up' | 'down') => {
      const move = computeMarkdownTocMove({
        root: items,
        id,
        direction,
      })
      if (!move) return false
      onReorder(move.parentId, move.fromIndex, move.toIndex)
      return true
    }
  }, [items, onReorder])

  return {
    items,
    onMoveItem,
    onReorderByIds,
  } satisfies {
    items: TocItem[]
    onMoveItem?: (id: string, direction: 'up' | 'down') => boolean
    onReorderByIds?: (sourceId: string, targetId: string, position: MarkdownTocDropPosition) => boolean
  }
}
