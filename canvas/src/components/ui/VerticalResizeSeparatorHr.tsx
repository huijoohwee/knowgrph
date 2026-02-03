import React from 'react'
import { cn } from '@/lib/utils'

export type VerticalResizeSeparatorHrProps = Omit<
  React.ComponentPropsWithoutRef<'hr'>,
  'role' | 'aria-orientation' | 'aria-label'
> & {
  ariaLabel: string
}

export const VerticalResizeSeparatorHr = React.forwardRef<HTMLHRElement, VerticalResizeSeparatorHrProps>(
  ({ ariaLabel, className, ...rest }, ref) => {
    return (
      <hr
        ref={ref}
        role="separator"
        aria-orientation="vertical"
        aria-label={ariaLabel}
        className={cn(
          'w-1 h-full border-0 cursor-col-resize select-none touch-none bg-[color:var(--kg-border)] hover:bg-[color:var(--kg-divider)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:focus-visible:ring-blue-400',
          className,
        )}
        {...rest}
      />
    )
  },
)

VerticalResizeSeparatorHr.displayName = 'VerticalResizeSeparatorHr'

