import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { TokenWithLines } from './markdownPreviewLex'
import type { TocItem } from './markdownSectionUtils'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'
import { useMarkdownTocDragAndDrop } from './useMarkdownTocDragAndDrop'
import { useMarkdownTocTreeState } from './useMarkdownTocTreeState'
import { MarkdownTocDropMarkers, MarkdownTocExpandGlyph, MarkdownTocReorderHandle } from './MarkdownTocChrome'

export type MarkdownTableOfContentsProps = {
  tokens: TokenWithLines[]
  onSelect?: (id: string) => void
  onDoubleClick?: (id: string) => void
  onReorder?: (parentId: string | null, fromIndex: number, toIndex: number) => void
  uiPanelTextFontClass: string
  uiPanelKeyValueTextSizeClass?: string
  className?: string
  paddingClassName?: string
  indentBasePx?: number
  indentStepPx?: number
  allCollapsed?: boolean
  collapsedIds?: Set<string>
  onToggleCollapse?: (id: string) => void
}

type TocItemRendererProps = {
  item: TocItem
  onSelect?: (id: string) => void
  onDoubleClick?: (id: string) => void
  onReorderItem?: (sourceId: string, targetId: string, position: 'before' | 'after') => void
  uiPanelTextFontClass: string
  uiPanelKeyValueTextSizeClass?: string
  depth: number
  indentBasePx: number
  indentStepPx: number
  allCollapsed?: boolean
  collapsedIds?: Set<string>
  onToggleCollapse?: (id: string) => void
}

function TocItemRenderer({
  item,
  onSelect,
  onDoubleClick,
  onReorderItem,
  uiPanelTextFontClass,
  uiPanelKeyValueTextSizeClass,
  depth,
  indentBasePx,
  indentStepPx,
  allCollapsed,
  collapsedIds,
  onToggleCollapse,
}: TocItemRendererProps) {
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const { dragState, isDragging, handleDragStart, handleDragEnd, handleDragOver, handleDragLeave, handleDrop } =
    useMarkdownTocDragAndDrop({
      itemId: item.id,
      enabled: !!onReorderItem,
      onReorder: onReorderItem,
    })
  const isCollapsed = collapsedIds ? collapsedIds.has(item.id) : (allCollapsed && item.children.length > 0)
  const hasChildren = item.children.length > 0

  return (
    <li className="relative">
      <MarkdownTocDropMarkers dragState={dragState} showArrow />
      <section
        className={[
          'group flex items-center gap-1 py-0.5 pr-1.5 rounded cursor-pointer select-none transition-colors relative',
          isDragging ? `${UI_THEME_TOKENS.button.activeBg} opacity-50` : `${UI_THEME_TOKENS.table.rowHoverHighlight} ${UI_THEME_TOKENS.table.rowHover}`,
          uiPanelTextFontClass,
          uiPanelKeyValueTextSizeClass || 'text-sm',
          'leading-5',
          dragState !== 'none' ? `${UI_THEME_TOKENS.button.activeBg}` : '',
        ].join(' ')}
        style={{ paddingLeft: `${(depth - 1) * indentStepPx + indentBasePx}px` }}
        onClick={() => onSelect?.(item.id)}
        onDoubleClick={(e) => {
            e.stopPropagation()
            onDoubleClick?.(item.id)
        }}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onSelect?.(item.id)
          }
        }}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {onReorderItem && (
          <MarkdownTocReorderHandle
            ariaLabel="Reorder section"
            title="Reorder section"
            className={`opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing w-4 h-4 flex items-center justify-center ${UI_THEME_TOKENS.text.tertiary} ${UI_THEME_TOKENS.button.hoverText}`}
            iconClassName={iconSizeClass}
            strokeWidth={uiIconStrokeWidth}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          />
        )}

        <span className={`truncate flex-1 ${UI_THEME_TOKENS.text.primary}`}>
          {item.text}
        </span>

        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleCollapse?.(item.id)
            }}
            className={`p-0.5 rounded shrink-0 ${UI_THEME_TOKENS.button.hoverBg} ${UI_THEME_TOKENS.text.tertiary}`}
          >
            <MarkdownTocExpandGlyph isExpanded={!isCollapsed} className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
          </button>
        ) : (
          <span className="w-4 shrink-0" aria-hidden="true" />
        )}
      </section>
      
      {hasChildren && !isCollapsed && (
        <ul>
          {item.children.map(child => (
            <TocItemRenderer
              key={child.id}
              item={child}
              onSelect={onSelect}
              onDoubleClick={onDoubleClick}
              onReorderItem={onReorderItem}
              uiPanelTextFontClass={uiPanelTextFontClass}
              uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
              depth={depth + 1}
              indentBasePx={indentBasePx}
              indentStepPx={indentStepPx}
              allCollapsed={allCollapsed}
              collapsedIds={collapsedIds}
              onToggleCollapse={onToggleCollapse}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

export function MarkdownTableOfContents({
  tokens,
  onSelect,
  onDoubleClick,
  onReorder,
  uiPanelTextFontClass,
  uiPanelKeyValueTextSizeClass,
  className,
  paddingClassName = 'p-2',
  indentBasePx = 4,
  indentStepPx = 10,
  allCollapsed,
  collapsedIds,
  onToggleCollapse,
}: MarkdownTableOfContentsProps) {
  const { items: rootItems, onReorderByIds: onReorderItem } = useMarkdownTocTreeState({
    tokens,
    onReorder,
  })

  if (rootItems.length === 0) return null

  return (
    <nav className={`overflow-y-auto ${paddingClassName} ${className || ''}`}>
      <ul className="space-y-0.5">
        {rootItems.map(item => (
          <TocItemRenderer
            key={item.id}
            item={item}
            onSelect={onSelect}
            onDoubleClick={onDoubleClick}
            onReorderItem={onReorderItem}
            uiPanelTextFontClass={uiPanelTextFontClass}
            uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
            depth={1}
            indentBasePx={indentBasePx}
            indentStepPx={indentStepPx}
            allCollapsed={allCollapsed}
            collapsedIds={collapsedIds}
            onToggleCollapse={onToggleCollapse}
          />
        ))}
      </ul>
    </nav>
  )
}
