import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'

export type VerticalResizeSeparatorHrProps = Omit<
  React.ComponentPropsWithoutRef<'hr'>,
  'role' | 'aria-orientation' | 'aria-label'
> & {
  ariaLabel: string
  visualStyle?: 'line' | 'centerGrip'
}

export const VerticalResizeSeparatorHr = React.forwardRef<HTMLHRElement, VerticalResizeSeparatorHrProps>(
  ({ ariaLabel, className, style, visualStyle = 'line', ...rest }, ref) => {
    const visualClassName =
      visualStyle === 'centerGrip'
        ? 'bg-transparent hover:bg-transparent'
        : 'bg-[color:var(--kg-border)] hover:bg-[color:var(--kg-divider)]'
    const visualStyleOverrides: React.CSSProperties | undefined =
      visualStyle === 'centerGrip'
        ? {
            backgroundColor: 'transparent',
            backgroundImage: 'linear-gradient(var(--kg-divider), var(--kg-divider)), linear-gradient(var(--kg-border), var(--kg-border))',
            backgroundPosition: 'center, center',
            backgroundRepeat: 'no-repeat',
            backgroundSize: '2px 3.5rem, 1px 100%',
          }
        : undefined
    return (
      <hr
        ref={ref}
        role="separator"
        aria-orientation="vertical"
        aria-label={ariaLabel}
        className={cn(
          `w-1 h-full border-0 cursor-col-resize select-none touch-none focus-visible:outline-none ${UI_THEME_TOKENS.focus.primaryStrongRing}`,
          visualClassName,
          className,
        )}
        style={visualStyleOverrides ? { ...visualStyleOverrides, ...style } : style}
        {...rest}
      />
    )
  },
)

VerticalResizeSeparatorHr.displayName = 'VerticalResizeSeparatorHr'
