import React from 'react'
import { UI_RESPONSIVE_INLINE_ELEMENT_ROW_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type ExplorerToolbarIconButtonProps = {
  ariaLabel: string
  title: string
  onClick?: () => void
  children: React.ReactNode
  className?: string
  draggable?: boolean
  ariaHaspopup?: React.AriaAttributes['aria-haspopup']
  ariaExpanded?: boolean
  type?: 'button' | 'submit' | 'reset'
}

export function ExplorerToolbarIconButton(props: ExplorerToolbarIconButtonProps) {
  const {
    ariaLabel,
    title,
    onClick,
    children,
    className = '',
    draggable,
    ariaHaspopup,
    ariaExpanded,
    type = 'button',
  } = props

  return (
    <button
      type={type}
      className={[
        `kg-toolbar-btn shrink-0 ${UI_RESPONSIVE_INLINE_ELEMENT_ROW_CLASSNAME} justify-center rounded`,
        UI_THEME_TOKENS.button.text,
        UI_THEME_TOKENS.button.hoverBg,
        className,
      ].join(' ')}
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      draggable={draggable}
      aria-haspopup={ariaHaspopup}
      aria-expanded={ariaExpanded}
    >
      {children}
    </button>
  )
}
