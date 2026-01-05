import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import Tooltip from '@/features/panels/ui/Tooltip'

export interface KeyTypeValueRowProps {
  keyNode: React.ReactNode
  typeNode?: React.ReactNode
  valueNode: React.ReactNode
  align?: 'center' | 'start'
  density?: 'default' | 'compact'
  layout?: 'keyTypeValue' | 'keyValue' | 'keyIconValue' | 'keyIconSliderInput'
  onClick?: () => void
  className?: string
  id?: string
  dataKgAnchor?: string
}

export interface SimpleKeyValueRowProps {
  label: React.ReactNode
  children: React.ReactNode
  align?: 'center' | 'start'
  density?: 'default' | 'compact'
  className?: string
}

export interface RightAlignedValueCellProps {
  children: React.ReactNode
  className?: string
}

export interface RightAlignedTooltipInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  tooltip: React.ReactNode
  maxWidthPx?: number
  contentClassName?: string
  containerClassName?: string
}

export function KeyTypeValueRow({
  keyNode,
  typeNode,
  valueNode,
  align,
  density = 'default',
  layout = 'keyTypeValue',
  onClick,
  className,
  id,
  dataKgAnchor,
}: KeyTypeValueRowProps) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass || 'text-sm')
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || 'font-sans')
  const uiPanelRowDensityDefaultClass = useGraphStore(
    s => s.uiPanelRowDensityDefaultClass || 'py-1',
  )
  const uiPanelRowDensityCompactClass = useGraphStore(
    s => s.uiPanelRowDensityCompactClass || 'py-0.5',
  )

  const alignClass = align === 'start' ? 'items-start' : 'items-center'
  const densityClass =
    density === 'compact' ? uiPanelRowDensityCompactClass : uiPanelRowDensityDefaultClass
  const cursorClass = onClick ? 'cursor-pointer' : ''

  if (layout === 'keyIconSliderInput') {
    const rootClassName = [
      'grid w-full grid-cols-1 sm:grid-cols-[minmax(0,0.49fr)_minmax(0,0.01fr)_minmax(0,0.245fr)_minmax(0,0.245fr)]',
      'gap-x-2 gap-y-1 rounded hover:bg-gray-50',
      uiPanelKeyValueTextSizeClass,
      uiPanelTextFontClass,
      densityClass,
      alignClass,
      cursorClass,
      className || '',
    ]
      .filter(Boolean)
      .join(' ')
    return (
      <div className={rootClassName} onClick={onClick}>
        <span className="flex min-w-0 items-center gap-1 text-gray-800 break-words">
          {keyNode}
        </span>
        <span className="flex min-w-0 items-center justify-center text-gray-500" />
        <span className="flex min-w-0 items-center gap-2 text-gray-700 break-words">
          {typeNode}
        </span>
        <span className="flex min-w-0 items-stretch justify-end gap-2 text-gray-700 break-words">
          {valueNode}
        </span>
      </div>
    )
  }

  if (layout === 'keyIconValue') {
    const rootClassName = [
      'grid w-full grid-cols-1 sm:grid-cols-[minmax(0,0.49fr)_minmax(0,0.02fr)_minmax(0,0.49fr)]',
      'gap-x-2 gap-y-1 rounded hover:bg-gray-50',
      uiPanelKeyValueTextSizeClass,
      uiPanelTextFontClass,
      densityClass,
      alignClass,
      cursorClass,
      className || '',
    ]
      .filter(Boolean)
      .join(' ')
    return (
      <div className={rootClassName} onClick={onClick}>
        <span className="flex min-w-0 items-center gap-1 text-gray-800 break-words">
          {keyNode}
        </span>
        <span className="flex min-w-0 items-center justify-center text-gray-500">
          {typeNode}
        </span>
        <span className="flex min-w-0 items-center gap-2 text-gray-700 break-words">
          {valueNode}
        </span>
      </div>
    )
  }

  if (layout === 'keyValue') {
    const rootClassName = [
      'grid w-full grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]',
      'gap-x-2 gap-y-1 rounded hover:bg-gray-50',
      uiPanelKeyValueTextSizeClass,
      uiPanelTextFontClass,
      densityClass,
      alignClass,
      cursorClass,
      className || '',
    ]
      .filter(Boolean)
      .join(' ')
    return (
      <div className={rootClassName} onClick={onClick}>
        <span className="flex min-w-0 items-center gap-1 text-gray-800 break-words">
          {keyNode}
        </span>
        <span className="flex min-w-0 items-center gap-2 text-gray-700 break-words">
          {valueNode}
        </span>
      </div>
    )
  }

  const rootClassName = [
    'grid w-full grid-cols-3 gap-1 rounded hover:bg-gray-50',
    uiPanelKeyValueTextSizeClass,
    uiPanelTextFontClass,
    densityClass,
    alignClass,
    cursorClass,
    className || '',
  ]
    .filter(Boolean)
    .join(' ')
  return (
    <div
      id={id}
      data-kg-anchor={dataKgAnchor}
      className={rootClassName}
      onClick={onClick}
    >
      <div className="flex min-w-0 items-center gap-1 text-gray-800 break-words">
        {keyNode}
      </div>
      <div className="min-w-0 text-gray-700 break-words">
        {typeNode}
      </div>
      <div className="flex min-w-0 items-center gap-1 text-gray-700 break-words">
        {valueNode}
      </div>
    </div>
  )
}

export function SimpleKeyValueRow({
  label,
  children,
  align,
  density,
  className,
}: SimpleKeyValueRowProps) {
  return (
    <KeyTypeValueRow
      keyNode={label}
      valueNode={children}
      align={align}
      density={density}
      layout="keyValue"
      className={className}
    />
  )
}

export function RightAlignedValueCell({ children, className }: RightAlignedValueCellProps) {
  const rootClassName = ['flex w-full justify-end', className || '']
    .filter(Boolean)
    .join(' ')
  return (
    <div className={rootClassName}>
      {children}
    </div>
  )
}

export function RightAlignedTooltipInput({
  tooltip,
  maxWidthPx = 260,
  contentClassName = 'bg-gray-800/90',
  className,
  containerClassName,
  ...inputProps
}: RightAlignedTooltipInputProps) {
  const uiPanelKeyValueInputClass = useGraphStore(
    s =>
      s.uiPanelKeyValueInputClass ||
      'w-full h-6 px-2 text-sm border border-gray-300 rounded text-right',
  )
  const mergedClassName = [
    uiPanelKeyValueInputClass,
    className || '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <RightAlignedValueCell className={containerClassName}>
      <Tooltip
        content={tooltip}
        maxWidthPx={maxWidthPx}
        contentClassName={contentClassName}
        className="w-full h-full"
      >
        <input
          {...inputProps}
          className={mergedClassName}
        />
      </Tooltip>
    </RightAlignedValueCell>
  )
}
