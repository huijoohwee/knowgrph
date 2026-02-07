import React from 'react'

import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export default function FloatingPropsPanelMenuButton({
  onClick,
  children,
  disabled,
  className,
  draggable,
  onDragStart,
  title,
  ariaLabel,
  uiPanelKeyValueTextSizeClass,
  uiPanelTextFontClass,
}: {
  onClick?: () => void
  children: React.ReactNode
  disabled?: boolean
  className?: string
  draggable?: boolean
  onDragStart?: (ev: React.DragEvent<HTMLButtonElement>) => void
  title?: string
  ariaLabel?: string
  uiPanelKeyValueTextSizeClass: string
  uiPanelTextFontClass: string
}) {
  return (
    <button
      type="button"
      className={`block w-full text-left px-3 py-2 ${UI_THEME_TOKENS.table.rowHover} disabled:opacity-50 disabled:cursor-not-allowed ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} font-normal ${UI_THEME_TOKENS.text.primary} ${className || ''}`}
      onClick={onClick}
      disabled={disabled}
      draggable={draggable}
      onDragStart={onDragStart}
      title={title}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  )
}

