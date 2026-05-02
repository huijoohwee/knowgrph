import React from 'react'
import {
  buildVisibleMarkdownTocModel,
  type TocItem,
} from './markdownSectionUtils'
import { applyMarkdownTocSelectionById } from './markdownTocSelection'
import {
  applyMarkdownTocReorderByIds,
  type MarkdownTocReorderCommit,
} from './markdownTocReorder'
import { useMarkdownTocFocusState } from './useMarkdownTocFocusState'
import type { TokenWithLines } from './markdownPreviewLex'
import type { MarkdownTocDropPosition } from './useMarkdownTocDragAndDrop'

export function useMarkdownTocModelState(args: {
  resetKey: string | null
  tocCollapsed: boolean
  tokens: TokenWithLines[]
  onRevealLine: (line: number) => void
  onReorder: MarkdownTocReorderCommit
}) {
  const { resetKey, tocCollapsed, tokens, onRevealLine, onReorder } = args
  const tocModel = React.useMemo(
    () =>
      buildVisibleMarkdownTocModel({
        tokens,
        collapsed: tocCollapsed,
      }),
    [tocCollapsed, tokens],
  )
  const {
    items,
    metadata: { parentById, lineById, headingNumberById, baseDepth },
  } = tocModel
  const navRef = React.useRef<HTMLElement | null>(null)
  const onNavRefChange = React.useCallback((element: HTMLElement | null) => {
    navRef.current = element
  }, [])
  const {
    activeItemId,
    collapsedIds,
    setActiveItemId,
    toggleExpanded,
  } = useMarkdownTocFocusState({
    resetKey,
    tocCollapsed,
    itemCount: items.length,
    parentById,
    navRef,
  })

  const onSelectItem = React.useCallback(
    (itemId: string) =>
      applyMarkdownTocSelectionById({
        itemId,
        lineById,
        setActiveItemId,
        onRevealLine,
      }),
    [lineById, onRevealLine, setActiveItemId],
  )

  const onReorderByIds = React.useCallback(
    (sourceId: string, targetId: string, position: MarkdownTocDropPosition) => {
      applyMarkdownTocReorderByIds({
        root: items,
        sourceId,
        targetId,
        position,
        onReorder,
      })
    },
    [items, onReorder],
  )

  return {
    activeItemId,
    baseDepth,
    collapsedIds,
    headingNumberById,
    items,
    onNavRefChange,
    onReorderByIds,
    onSelectItem,
    toggleExpanded,
  } satisfies {
    activeItemId: string
    baseDepth: number
    collapsedIds: ReadonlySet<string>
    headingNumberById: ReadonlyMap<string, string>
    items: TocItem[]
    onNavRefChange: (element: HTMLElement | null) => void
    onReorderByIds: (sourceId: string, targetId: string, position: MarkdownTocDropPosition) => void
    onSelectItem: (itemId: string) => boolean
    toggleExpanded: (id: string) => void
  }
}
