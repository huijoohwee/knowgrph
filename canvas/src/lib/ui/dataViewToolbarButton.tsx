import React from 'react'
import { cn } from '@/lib/utils'
import { UI_FOCUS_RING } from '@/lib/ui/focusRing'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export type DataViewToolbarButtonVariant = 'default' | 'primary' | 'ghost'
export type DataViewToolbarButtonSize = 'sm' | 'md'

export type DataViewToolbarButtonProps = {
  label: string
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  disabled?: boolean
  ariaLabel?: string
  leadingIcon?: React.ReactNode
  trailingIcon?: React.ReactNode
  variant?: DataViewToolbarButtonVariant
  size?: DataViewToolbarButtonSize
  className?: string
}

export function DataViewToolbarButton(props: DataViewToolbarButtonProps) {
  const variant = props.variant ?? 'default'
  const size = props.size ?? 'md'

  const base = cn(
    'inline-flex items-center justify-center select-none',
    'rounded border',
    UI_FOCUS_RING,
    props.disabled ? 'opacity-50 pointer-events-none' : undefined,
  )

  const sizeClass =
    size === 'sm' ? 'h-7 px-2 text-xs gap-1.5' : 'h-8 px-3 text-xs gap-2'

  const variantClass =
    variant === 'primary'
      ? cn(UI_THEME_TOKENS.button.activeBg, UI_THEME_TOKENS.button.activeBorder, UI_THEME_TOKENS.button.activeText)
      : variant === 'ghost'
        ? cn('border-transparent', UI_THEME_TOKENS.button.hoverBg, UI_THEME_TOKENS.text.secondary)
        : cn(UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.panel.bg, UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)

  return (
    <button
      type="button"
      className={cn(base, sizeClass, variantClass, props.className)}
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={props.ariaLabel ?? props.label}
    >
      {props.leadingIcon ? <span className="inline-flex items-center" aria-hidden="true">{props.leadingIcon}</span> : null}
      <span className="font-medium truncate">{props.label}</span>
      {props.trailingIcon ? <span className="inline-flex items-center" aria-hidden="true">{props.trailingIcon}</span> : null}
    </button>
  )
}

export type DataViewIconButtonProps = {
  ariaLabel: string
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  disabled?: boolean
  icon: React.ReactNode
  className?: string
  size?: DataViewToolbarButtonSize
}

export function DataViewIconButton(props: DataViewIconButtonProps) {
  const size = props.size ?? 'md'
  const dims = size === 'sm' ? 'h-7 w-7' : 'h-8 w-8'

  return (
    <button
      type="button"
      className={cn(
        'inline-flex items-center justify-center rounded-md border',
        dims,
        UI_FOCUS_RING,
        UI_THEME_TOKENS.panel.border,
        UI_THEME_TOKENS.panel.bg,
        UI_THEME_TOKENS.button.text,
        UI_THEME_TOKENS.button.hoverBg,
        props.disabled ? 'opacity-50 pointer-events-none' : undefined,
        props.className,
      )}
      onClick={props.onClick}
      disabled={props.disabled}
      aria-label={props.ariaLabel}
    >
      <span className="inline-flex items-center" aria-hidden="true">
        {props.icon}
      </span>
    </button>
  )
}
