import React from 'react'
import { Pin, PinOff } from 'lucide-react'
import IconButton from '@/components/IconButton'
import { getPinToggleButtonClassName } from '@/lib/ui'
import { cn } from '@/lib/utils'

export function PinToggleIconButton(props: {
  activeIconClassName?: string
  ariaPressed?: boolean
  className?: string
  disabled?: boolean
  iconClassName: string
  iconStyle?: React.CSSProperties
  onClick?: (event: React.MouseEvent) => void
  onPointerDown?: (event: React.PointerEvent) => void
  pinned: boolean
  showTooltip?: boolean
  strokeWidth: number
  style?: React.CSSProperties
  title: string
  tooltipContent?: string
}) {
  const {
    activeIconClassName,
    ariaPressed,
    className,
    disabled,
    iconClassName,
    iconStyle,
    onClick,
    onPointerDown,
    pinned,
    showTooltip,
    strokeWidth,
    style,
    title,
    tooltipContent,
  } = props
  const renderedIconClassName = pinned ? cn(iconClassName, activeIconClassName || '') : iconClassName
  return (
    <IconButton
      className={className || getPinToggleButtonClassName(pinned)}
      title={title}
      tooltipContent={tooltipContent}
      showTooltip={showTooltip}
      disabled={disabled}
      onPointerDownCapture={onPointerDown}
      onClick={onClick}
      aria-pressed={ariaPressed ?? pinned}
      style={style}
    >
      {pinned ? (
        <Pin className={renderedIconClassName} style={iconStyle} strokeWidth={strokeWidth} aria-hidden={true} />
      ) : (
        <PinOff className={renderedIconClassName} style={iconStyle} strokeWidth={strokeWidth} aria-hidden={true} />
      )}
    </IconButton>
  )
}
