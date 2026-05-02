import React from 'react'
import type { TocItem } from '@/features/markdown/ui/markdownSectionUtils'
import type { MarkdownTocDropPosition } from '@/features/markdown/ui/useMarkdownTocDragAndDrop'
import { MarkdownWorkspaceTocTreeItem } from './MarkdownWorkspaceTocTreeItem'

type MarkdownWorkspaceTocTreeProps = {
  items: TocItem[]
  collapsedIds: ReadonlySet<string>
  activeItemId: string
  headingNumbersById: ReadonlyMap<string, string>
  baseDepth: number
  onToggleExpanded: (id: string) => void
  onSelect: (id: string) => void
  onReorder: (sourceId: string, targetId: string, position: MarkdownTocDropPosition) => void
  uiPanelTextFontClass: string
  uiPanelKeyValueTextSizeClass: string
}

export function MarkdownWorkspaceTocTree(props: MarkdownWorkspaceTocTreeProps) {
  const {
    items,
    collapsedIds,
    activeItemId,
    headingNumbersById,
    baseDepth,
    onToggleExpanded,
    onSelect,
    onReorder,
    uiPanelTextFontClass,
    uiPanelKeyValueTextSizeClass,
  } = props

  const renderNode = React.useCallback(
    (item: TocItem): React.ReactNode => {
      const isCollapsed = collapsedIds.has(item.id)
      const isExpanded = !isCollapsed
      const hasChildren = item.children.length > 0
      const itemDepth = typeof item.depth === 'number' && Number.isFinite(item.depth) ? item.depth : 1
      const visualDepth = Math.max(0, Math.min(6, Math.max(1, itemDepth)) - baseDepth)
      const headingNumber = headingNumbersById.get(item.id) || ''

      return (
        <li key={item.id} className="list-none">
          <MarkdownWorkspaceTocTreeItem
            item={item}
            depth={visualDepth}
            headingNumber={headingNumber}
            isExpanded={isExpanded}
            isActive={!!activeItemId && activeItemId === item.id}
            onToggleExpanded={onToggleExpanded}
            onSelect={onSelect}
            onReorder={onReorder}
            uiPanelTextFontClass={uiPanelTextFontClass}
            uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
          />
          {hasChildren && isExpanded ? (
            <ul className="list-none m-0 p-0">{item.children.map(child => renderNode(child))}</ul>
          ) : null}
        </li>
      )
    },
    [
      activeItemId,
      baseDepth,
      collapsedIds,
      headingNumbersById,
      onReorder,
      onSelect,
      onToggleExpanded,
      uiPanelKeyValueTextSizeClass,
      uiPanelTextFontClass,
    ],
  )

  return <>{items.map(item => renderNode(item))}</>
}
