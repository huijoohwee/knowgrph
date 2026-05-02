import React from 'react'
import { FileText, Folder } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { MarkdownTocDropMarkers, MarkdownTocExpandGlyph, MarkdownTocReorderHandle } from '@/features/markdown/ui/MarkdownTocChrome'

type MarkdownTocTreeRowProps = {
  itemId: string
  text: string
  headingNumber: string
  indent: number
  hasChildren: boolean
  isExpanded: boolean
  isActive: boolean
  isDragging: boolean
  dragState: 'none' | 'top' | 'bottom'
  uiPanelTextFontClass: string
  uiPanelKeyValueTextSizeClass: string
  onClick: () => void
  onDragStart: React.DragEventHandler<HTMLButtonElement>
  onDragEnd: React.DragEventHandler<HTMLButtonElement>
}

export function MarkdownTocTreeRow(props: MarkdownTocTreeRowProps) {
  const {
    itemId,
    text,
    headingNumber,
    indent,
    hasChildren,
    isExpanded,
    isActive,
    isDragging,
    dragState,
    uiPanelTextFontClass,
    uiPanelKeyValueTextSizeClass,
    onClick,
    onDragStart,
    onDragEnd,
  } = props

  return (
    <>
      <MarkdownTocDropMarkers dragState={dragState} />

      <button
        type="button"
        data-toc-id={itemId}
        className={`flex-1 min-w-0 flex items-center gap-1 rounded px-1 py-[2px] ${uiPanelKeyValueTextSizeClass} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg} ${uiPanelTextFontClass} ${isDragging ? 'opacity-50' : ''} ${isActive ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : ''}`}
        style={{ paddingLeft: 6 + indent }}
        onClick={onClick}
        aria-label={`Heading ${text}`}
      >
        {hasChildren ? (
          <MarkdownTocExpandGlyph isExpanded={isExpanded} className="w-3 h-3 shrink-0" />
        ) : (
          <span className="w-3 h-3 shrink-0" aria-hidden="true" />
        )}
        {hasChildren ? <Folder className="w-3 h-3 shrink-0" aria-hidden="true" /> : <FileText className="w-3 h-3 shrink-0" aria-hidden="true" />}
        <span className={`shrink-0 tabular-nums ${UI_THEME_TOKENS.text.secondary}`}>{headingNumber}</span>
        <span className="truncate">{text}</span>
      </button>

      <MarkdownTocReorderHandle
        ariaLabel="Reorder heading"
        title="Reorder heading"
        className={`opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing w-4 h-4 shrink-0 flex items-center justify-center rounded ${UI_THEME_TOKENS.text.tertiary} hover:text-gray-600 dark:hover:text-gray-400`}
        iconClassName="w-3 h-3"
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      />
    </>
  )
}
