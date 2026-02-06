import React from 'react'

type FloatingPanelTag = 'div' | 'section' | 'aside' | 'nav' | 'article'

export const FLOATING_PANEL_SCROLL_CLASSNAME = 'flex-1 min-h-0 overflow-y-auto overflow-x-hidden'

export type FloatingPanelProps = {
  as?: FloatingPanelTag
  ariaLabel: string
  ariaHidden?: boolean
  ariaExpanded?: boolean
  role?: React.AriaRole
  className?: string
  id?: string
  style?: React.CSSProperties
  children: React.ReactNode
} & Omit<
  React.HTMLAttributes<HTMLElement>,
  'children' | 'className' | 'id' | 'style' | 'role' | 'aria-label' | 'aria-hidden' | 'aria-expanded'
>

export const FloatingPanel = React.memo(
  React.forwardRef<HTMLElement, FloatingPanelProps>(function FloatingPanel(
    { as = 'section', ariaLabel, ariaHidden, ariaExpanded, role, className, id, style, children, ...rest },
    ref,
  ) {
    return React.createElement(
      as,
      {
        ...rest,
        ref,
        id,
        style,
        role,
        'aria-hidden': ariaHidden,
        'aria-expanded': ariaExpanded,
        'aria-label': ariaLabel,
        className: className || '',
      },
      children,
    )
  }),
)
