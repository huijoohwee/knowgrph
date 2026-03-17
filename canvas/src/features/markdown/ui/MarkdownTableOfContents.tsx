import React from 'react'
import { ChevronRight, ChevronDown, GripVertical } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { TokenWithLines } from './markdownPreviewLex'
import { buildTocTree, type TocItem } from './markdownSectionUtils'
import { computeMarkdownTocReorder } from 'grph-shared/markdown/toc'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'

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
  onReorder?: (parentId: string | null, fromIndex: number, toIndex: number) => void
  uiPanelTextFontClass: string
  uiPanelKeyValueTextSizeClass?: string
  depth: number
  indentBasePx: number
  indentStepPx: number
  allCollapsed?: boolean
  collapsedIds?: Set<string>
  onToggleCollapse?: (id: string) => void
  rootItems: TocItem[]
}

function TocItemRenderer({
  item,
  onSelect,
  onDoubleClick,
  onReorder,
  uiPanelTextFontClass,
  uiPanelKeyValueTextSizeClass,
  depth,
  indentBasePx,
  indentStepPx,
  allCollapsed,
  collapsedIds,
  onToggleCollapse,
  rootItems,
}: TocItemRendererProps) {
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)

  const [dragState, setDragState] = React.useState<'none' | 'top' | 'bottom'>('none')
  const [isDragging, setIsDragging] = React.useState(false)
  const isCollapsed = collapsedIds ? collapsedIds.has(item.id) : (allCollapsed && item.children.length > 0)
  
  const hasChildren = item.children.length > 0

  const handleDragStart = (e: React.DragEvent) => {
    if (!onReorder) return
    setIsDragging(true)
    e.dataTransfer.setData('text/plain', item.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    setIsDragging(false)
    setDragState('none')
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    if (!onReorder) return
    e.dataTransfer.dropEffect = 'move'
    
    // Calculate if we are in top or bottom half
    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    if (e.clientY < midY) {
      setDragState('top')
    } else {
      setDragState('bottom')
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
    setDragState('none')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragState('none')
    if (!onReorder) return

    const sourceId = e.dataTransfer.getData('text/plain')
    if (sourceId === item.id) return

    const move = computeMarkdownTocReorder({
      root: rootItems,
      sourceId,
      targetId: item.id,
      position: dragState === 'bottom' ? 'after' : 'before',
    })
    if (!move) return
    onReorder(move.parentId, move.fromIndex, move.toIndex)
  }

  return (
    <li className="relative">
      {dragState === 'top' && (
        <span
          className={`absolute left-0 right-0 -top-1 h-2 ${UI_THEME_TOKENS.button.activeBg} border-t-2 ${UI_THEME_TOKENS.button.activeBorder} z-10 pointer-events-none`}
        >
          <span
            className={`absolute left-0 -top-1 w-0 h-0 border-l-4 border-r-4 border-b-4 ${UI_THEME_TOKENS.button.activeBorder} border-l-transparent border-r-transparent`}
          />
        </span>
      )}
      {dragState === 'bottom' && (
        <span
          className={`absolute left-0 right-0 -bottom-1 h-2 ${UI_THEME_TOKENS.button.activeBg} border-b-2 ${UI_THEME_TOKENS.button.activeBorder} z-10 pointer-events-none`}
        >
          <span
            className={`absolute left-0 -bottom-1 w-0 h-0 border-l-4 border-r-4 border-t-4 ${UI_THEME_TOKENS.button.activeBorder} border-l-transparent border-r-transparent`}
          />
        </span>
      )}
      <section
        className={[
          'group flex items-center gap-1 py-0.5 pr-1.5 rounded cursor-pointer select-none transition-colors relative',
          isDragging ? `${UI_THEME_TOKENS.button.activeBg} opacity-50` : `${UI_THEME_TOKENS.table.rowHoverAmber} ${UI_THEME_TOKENS.table.rowHover}`,
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
        {onReorder && (
          <button
            type="button"
            className={`opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing w-4 h-4 flex items-center justify-center ${UI_THEME_TOKENS.text.tertiary} hover:text-gray-600 dark:hover:text-gray-400`}
            draggable
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            aria-label="Reorder section"
            title="Reorder section"
          >
            <GripVertical className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
          </button>
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
            {isCollapsed ? (
              <ChevronRight className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
            ) : (
              <ChevronDown className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
            )}
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
              onReorder={onReorder}
              uiPanelTextFontClass={uiPanelTextFontClass}
              uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
              depth={depth + 1}
              indentBasePx={indentBasePx}
              indentStepPx={indentStepPx}
              allCollapsed={allCollapsed}
              collapsedIds={collapsedIds}
              onToggleCollapse={onToggleCollapse}
              rootItems={rootItems}
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
  const rootItems = React.useMemo(() => buildTocTree(tokens), [tokens])

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
            onReorder={onReorder}
            uiPanelTextFontClass={uiPanelTextFontClass}
            uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
            depth={1}
            indentBasePx={indentBasePx}
            indentStepPx={indentStepPx}
            allCollapsed={allCollapsed}
            collapsedIds={collapsedIds}
            onToggleCollapse={onToggleCollapse}
            rootItems={rootItems}
          />
        ))}
      </ul>
    </nav>
  )
}
