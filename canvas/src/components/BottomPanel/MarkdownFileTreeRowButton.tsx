import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type MarkdownFileTreeRowButtonProps = {
  ariaLabel: string
  indent: number
  isActive: boolean
  textClassName: string
  onClick: () => void
  onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => void
  children: React.ReactNode
}

export function MarkdownFileTreeRowButton(props: MarkdownFileTreeRowButtonProps) {
  const { ariaLabel, indent, isActive, textClassName, onClick, onContextMenu, children } = props

  return (
    <button
      type="button"
      className={`flex-1 min-w-0 flex items-center gap-1 rounded px-1 py-[2px] ${textClassName} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg} ${
        isActive ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : ''
      }`}
      style={{ paddingLeft: 6 + indent }}
      onClick={onClick}
      onContextMenu={onContextMenu}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  )
}
