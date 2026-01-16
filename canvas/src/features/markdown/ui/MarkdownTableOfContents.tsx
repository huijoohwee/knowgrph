import React from 'react'
import { ChevronRight, ChevronDown, GripVertical } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { TokenWithLines } from './markdownPreviewLex'
import { buildTocTree, findParent, type TocItem } from './markdownSectionUtils'

const UI_COLOR_PRIMARY_BLUE_INDICATOR = '#2563EB' // blue-600
const UI_COLOR_PRIMARY_BLUE_BG = 'bg-blue-50'

export type MarkdownTableOfContentsProps = {
  tokens: TokenWithLines[]
  onSelect?: (id: string) => void
  onDoubleClick?: (id: string) => void
  onReorder?: (parentId: string | null, fromIndex: number, toIndex: number) => void
  uiPanelTextFontClass: string
  uiPanelKeyValueTextSizeClass?: string
  className?: string
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
  allCollapsed,
  collapsedIds,
  onToggleCollapse,
  rootItems,
}: TocItemRendererProps) {
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

  const handleDragLeave = () => {
    setDragState('none')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragState('none')
    if (!onReorder) return

    const sourceId = e.dataTransfer.getData('text/plain')
    if (sourceId === item.id) return

    const sourceInfo = findParent(rootItems, sourceId)
    const targetInfo = findParent(rootItems, item.id)

    if (sourceInfo && targetInfo) {
      const sameParent = sourceInfo.parent?.id === targetInfo.parent?.id
      if (sameParent) {
        let targetIndex = targetInfo.index
        if (dragState === 'bottom') {
          targetIndex += 1
        }
        if (sourceInfo.index < targetIndex) {
          targetIndex -= 1
        }
        if (targetIndex < 0) targetIndex = 0
        if (targetIndex >= targetInfo.siblings.length) targetIndex = targetInfo.siblings.length - 1

        onReorder(sourceInfo.parent?.id ?? null, sourceInfo.index, targetIndex)
      }
    }
  }

  return (
    <li className="relative">
      {dragState === 'top' && (
        <div
          className="absolute left-0 right-0 -top-1 h-2 bg-blue-50 border-t-2 z-10 pointer-events-none"
          style={{ borderTopColor: UI_COLOR_PRIMARY_BLUE_INDICATOR }}
        >
          <div
            className="absolute left-0 -top-1 w-0 h-0 border-l-4 border-r-4 border-b-4 border-l-transparent border-r-transparent"
            style={{ borderBottomColor: UI_COLOR_PRIMARY_BLUE_INDICATOR }}
          />
        </div>
      )}
      {dragState === 'bottom' && (
        <div
          className="absolute left-0 right-0 -bottom-1 h-2 bg-blue-50 border-b-2 z-10 pointer-events-none"
          style={{ borderBottomColor: UI_COLOR_PRIMARY_BLUE_INDICATOR }}
        >
          <div
            className="absolute left-0 -bottom-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent"
            style={{ borderTopColor: UI_COLOR_PRIMARY_BLUE_INDICATOR }}
          />
        </div>
      )}
      <div
        className={[
          'group flex items-center gap-1 py-1 pr-2 rounded cursor-pointer select-none transition-colors relative',
          isDragging ? `${UI_COLOR_PRIMARY_BLUE_BG} opacity-50` : `${UI_THEME_TOKENS.table.rowHoverAmber} ${UI_THEME_TOKENS.table.rowHover}`,
          uiPanelTextFontClass,
          uiPanelKeyValueTextSizeClass || 'text-xs',
          'leading-5',
          dragState !== 'none' ? `${UI_COLOR_PRIMARY_BLUE_BG}` : '',
        ].join(' ')}
        style={{ paddingLeft: `${(depth - 1) * 12 + 4}px` }}
        onClick={() => onSelect?.(item.id)}
        onDoubleClick={(e) => {
            e.stopPropagation()
            onDoubleClick?.(item.id)
        }}
        draggable={!!onReorder}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {onReorder && (
          <div className={`opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing p-0.5 ${UI_THEME_TOKENS.text.tertiary} hover:text-gray-600 dark:hover:text-gray-400`}>
            <GripVertical size={12} />
          </div>
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
            {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </button>
        ) : (
          <div className="w-4 shrink-0" aria-hidden="true" />
        )}
      </div>
      
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
  allCollapsed,
  collapsedIds,
  onToggleCollapse,
}: MarkdownTableOfContentsProps) {
  const rootItems = React.useMemo(() => buildTocTree(tokens), [tokens])

  if (rootItems.length === 0) return null

  return (
    <nav className={`overflow-y-auto p-2 ${className || ''}`}>
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
