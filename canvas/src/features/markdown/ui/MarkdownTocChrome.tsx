import React from 'react'
import { ChevronDown, ChevronRight, GripVertical } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export function MarkdownTocDropMarkers(props: {
  dragState: 'none' | 'top' | 'bottom'
  showArrow?: boolean
}) {
  const { dragState, showArrow = false } = props

  return (
    <>
      {dragState === 'top' ? (
        <span
          className={`absolute left-0 right-0 -top-1 h-2 ${UI_THEME_TOKENS.button.activeBg} border-t-2 ${UI_THEME_TOKENS.button.activeBorder} z-10 pointer-events-none`}
        >
          {showArrow ? (
            <span
              className={`absolute left-0 -top-1 w-0 h-0 border-l-4 border-r-4 border-b-4 ${UI_THEME_TOKENS.button.activeBorder} border-l-transparent border-r-transparent`}
            />
          ) : null}
        </span>
      ) : null}
      {dragState === 'bottom' ? (
        <span
          className={`absolute left-0 right-0 -bottom-1 h-2 ${UI_THEME_TOKENS.button.activeBg} border-b-2 ${UI_THEME_TOKENS.button.activeBorder} z-10 pointer-events-none`}
        >
          {showArrow ? (
            <span
              className={`absolute left-0 -bottom-1 w-0 h-0 border-l-4 border-r-4 border-t-4 ${UI_THEME_TOKENS.button.activeBorder} border-l-transparent border-r-transparent`}
            />
          ) : null}
        </span>
      ) : null}
    </>
  )
}

export function MarkdownTocExpandGlyph(props: {
  isExpanded: boolean
  className: string
  strokeWidth?: number
}) {
  const { isExpanded, className, strokeWidth } = props
  return isExpanded ? (
    <ChevronDown className={className} strokeWidth={strokeWidth} aria-hidden="true" />
  ) : (
    <ChevronRight className={className} strokeWidth={strokeWidth} aria-hidden="true" />
  )
}

export function MarkdownTocReorderHandle(props: {
  ariaLabel: string
  title: string
  className: string
  iconClassName: string
  strokeWidth?: number
  onDragStart: React.DragEventHandler<HTMLButtonElement>
  onDragEnd: React.DragEventHandler<HTMLButtonElement>
}) {
  const { ariaLabel, title, className, iconClassName, strokeWidth, onDragStart, onDragEnd } = props
  return (
    <button
      type="button"
      className={className}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onMouseDown={event => event.stopPropagation()}
      onClick={event => event.stopPropagation()}
      aria-label={ariaLabel}
      title={title}
    >
      <GripVertical className={iconClassName} strokeWidth={strokeWidth} aria-hidden="true" />
    </button>
  )
}
