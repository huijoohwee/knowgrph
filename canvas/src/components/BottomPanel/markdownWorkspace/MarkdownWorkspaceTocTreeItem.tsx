import React from 'react'
import type { TocItem } from '@/features/markdown/ui/markdownSectionUtils'
import { useMarkdownTocDragAndDrop, type MarkdownTocDropPosition } from '@/features/markdown/ui/useMarkdownTocDragAndDrop'
import { MarkdownTocTreeRow } from './MarkdownTocTreeRow'

type MarkdownWorkspaceTocTreeItemProps = {
  item: TocItem
  depth: number
  headingNumber: string
  isExpanded: boolean
  isActive: boolean
  onToggleExpanded: (id: string) => void
  onSelect: (id: string) => void
  onReorder: (sourceId: string, targetId: string, position: MarkdownTocDropPosition) => void
  uiPanelTextFontClass: string
  uiPanelKeyValueTextSizeClass: string
}

export function MarkdownWorkspaceTocTreeItem(props: MarkdownWorkspaceTocTreeItemProps) {
  const {
    item,
    depth,
    headingNumber,
    isExpanded,
    isActive,
    onToggleExpanded,
    onSelect,
    onReorder,
    uiPanelTextFontClass,
    uiPanelKeyValueTextSizeClass,
  } = props
  const { dragState, isDragging, handleDragStart, handleDragEnd, handleDragOver, handleDragLeave, handleDrop } =
    useMarkdownTocDragAndDrop({
      itemId: item.id,
      onReorder,
    })

  const hasChildren = item.children.length > 0
  const indent = Math.min(28, depth * 12)

  return (
    <section
      className="group flex items-center relative"
      aria-label={hasChildren ? `Heading ${item.text}` : `Heading leaf ${item.text}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <MarkdownTocTreeRow
        itemId={item.id}
        text={item.text}
        headingNumber={headingNumber}
        indent={indent}
        hasChildren={hasChildren}
        isExpanded={isExpanded}
        isActive={isActive}
        isDragging={isDragging}
        dragState={dragState}
        uiPanelTextFontClass={uiPanelTextFontClass}
        uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
        onClick={() => {
          onSelect(item.id)
          if (hasChildren) onToggleExpanded(item.id)
        }}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      />
    </section>
  )
}
