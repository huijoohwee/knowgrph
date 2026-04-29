import React from 'react';
import { cn } from '@/lib/utils';
import Tooltip from '@/features/panels/ui/Tooltip';
import { useGraphStore } from '@/hooks/useGraphStore';
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens';

type BaseButtonProps = Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'title' | 'aria-label' | 'children' | 'type'
>;

interface IconButtonProps extends BaseButtonProps {
  title: string;
  children: React.ReactNode;
  showTooltip?: boolean;
  hoverRingClass?: string;
  tooltipContent?: string;
  ariaLabel?: string;
  suppressTitleAttribute?: boolean;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    {
      title,
      onClick,
      onPointerDown,
      onMouseDown,
      disabled,
      className = '',
      children,
      showTooltip = false,
      hoverRingClass,
      tooltipContent,
      ariaLabel,
      suppressTitleAttribute = false,
      ...buttonProps
    },
    ref,
  ) => {
    const hasMultipleChildren = React.Children.count(children) > 1;
    const content = tooltipContent ?? title;
    const uiIconColorClass = useGraphStore(state => state.uiIconColorClass);
    const uiIconHoverBgClass = useGraphStore(state => state.uiIconHoverBgClass);
    const uiIconButtonPaddingClass = useGraphStore(state => state.uiIconButtonPaddingClass);
    const uiIconFormat = useGraphStore(state => state.uiIconFormat);
    const isDisabled = !!disabled;
    const isMinimal = uiIconFormat === 'minimal';
    const paddingClass =
      uiIconButtonPaddingClass && uiIconButtonPaddingClass.trim().length > 0
        ? uiIconButtonPaddingClass
        : UI_THEME_TOKENS.button.padding;
    const enabledClasses = cn(
      uiIconColorClass && uiIconColorClass.trim().length > 0 ? uiIconColorClass : UI_THEME_TOKENS.icon.color,
      isMinimal
        ? ''
        : uiIconHoverBgClass && uiIconHoverBgClass.trim().length > 0
          ? uiIconHoverBgClass
          : UI_THEME_TOKENS.button.hoverBg,
      isMinimal || !hoverRingClass ? '' : cn('hover:ring-2 ring-offset-1', hoverRingClass),
    );

    const inner = hasMultipleChildren ? (
      <span className="inline-flex items-center justify-center gap-2">{children}</span>
    ) : (
      children
    )

    const button = (
      <button
        ref={ref}
        {...buttonProps}
        type="button"
        disabled={isDisabled}
        onPointerDown={e => {
          if (e.button === 0) {
            try {
              e.preventDefault()
            } catch {
              void 0
            }
          }
          e.stopPropagation()
          onPointerDown?.(e)
        }}
        onMouseDown={e => {
          if (e.button === 0) {
            try {
              e.preventDefault()
            } catch {
              void 0
            }
          }
          e.stopPropagation()
          onMouseDown?.(e)
        }}
        onClick={e => {
          e.stopPropagation()
          onClick?.(e)
        }}
        className={cn(
          'group relative select-none rounded inline-flex items-center justify-center',
          paddingClass,
          isDisabled
            ? 'text-gray-400 cursor-not-allowed pointer-events-none'
            : enabledClasses,
          className,
        )}
        title={showTooltip || suppressTitleAttribute ? undefined : title}
        aria-label={ariaLabel ?? title}
      >
        {inner}
      </button>
    )

    if (!showTooltip) return button
    return (
      <Tooltip content={content} contentClassName={cn(UI_THEME_TOKENS.tooltip.bg, 'pointer-events-none')}>
        {button}
      </Tooltip>
    )
  }
);

export default React.memo(IconButton);
