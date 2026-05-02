import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import Tooltip from '@/features/panels/ui/Tooltip'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { PANEL_TYPOGRAPHY_DEFAULTS } from 'grph-shared/ui/panelTypography'
import { PlainTextInputEditor } from '@/components/ui/PlainTextInputEditor'

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
  isActive?: boolean
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
  className?: string
  type?: string
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
  isActive,
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
  const activeClass = isActive ? UI_THEME_TOKENS.table.rowSelected : UI_THEME_TOKENS.table.rowHoverHighlight

  if (layout === 'keyIconSliderInput') {
    const rootClassName = [
      'grid w-full grid-cols-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.05fr)_minmax(0,0.55fr)_minmax(0,1.4fr)]',
      'gap-x-2 gap-y-1 sm:gap-y-0 rounded',
      activeClass,
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
      <dl className={rootClassName} onClick={onClick}>
        <dt className={`flex min-w-0 items-center gap-1 ${UI_THEME_TOKENS.text.primary} break-words`}>
          {keyNode}
        </dt>
        <dd className={`hidden min-w-0 items-center justify-center sm:flex ${UI_THEME_TOKENS.text.tertiary}`} />
        <dd className={`flex min-w-0 items-center gap-2 ${UI_THEME_TOKENS.text.secondary} break-words`}>
          {typeNode}
        </dd>
        <dd className={`flex min-w-0 items-stretch justify-start gap-2 sm:justify-end ${UI_THEME_TOKENS.text.secondary} break-words`}>
          {valueNode}
        </dd>
      </dl>
    )
  }

  if (layout === 'keyIconValue') {
    const rootClassName = [
      'grid w-full grid-cols-1 sm:grid-cols-[minmax(0,1.1fr)_minmax(1.25rem,1.75rem)_minmax(0,1.2fr)]',
      'gap-x-2 gap-y-1 sm:gap-y-0 rounded',
      activeClass,
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
      <dl className={rootClassName} onClick={onClick}>
        <dt className={`flex min-w-0 items-center gap-1 ${UI_THEME_TOKENS.text.primary} break-words`}>
          {keyNode}
        </dt>
        <dd className={`hidden min-w-0 items-center justify-center sm:flex ${UI_THEME_TOKENS.text.tertiary}`}>
          {typeNode}
        </dd>
        <dd className={`flex min-w-0 items-center gap-2 ${UI_THEME_TOKENS.text.secondary} break-words`}>
          {valueNode}
        </dd>
      </dl>
    )
  }

  if (layout === 'keyValue') {
    const rootClassName = [
      'grid w-full grid-cols-1 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]',
      'gap-x-2 gap-y-1 rounded',
      activeClass,
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
      <dl className={rootClassName} onClick={onClick}>
        <dt className={`flex min-w-0 items-center gap-1 ${UI_THEME_TOKENS.text.primary} break-words`}>
          {keyNode}
        </dt>
        <dd className={`flex min-w-0 items-center gap-2 ${UI_THEME_TOKENS.text.secondary} break-words`}>
          {valueNode}
        </dd>
      </dl>
    )
  }

  const rootClassName = [
    'grid w-full grid-cols-1 sm:grid-cols-[minmax(0,1.05fr)_minmax(5rem,6.75rem)_minmax(0,1.25fr)] gap-x-2 gap-y-1 sm:gap-y-0 rounded',
    activeClass,
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
    <dl
      id={id}
      data-kg-anchor={dataKgAnchor}
      className={rootClassName}
      onClick={onClick}
    >
      <dt className={`flex min-w-0 items-center gap-1 ${UI_THEME_TOKENS.text.primary} break-words`}>
        {keyNode}
      </dt>
      <dd className={`flex min-w-0 items-center justify-start sm:justify-end ${UI_THEME_TOKENS.text.secondary} break-words`}>
        {typeNode}
      </dd>
      <dd className={`flex min-w-0 items-center gap-2 ${UI_THEME_TOKENS.text.secondary} break-words`}>
        {valueNode}
      </dd>
    </dl>
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
  const rootClassName = ['flex w-full justify-start sm:justify-end', className || '']
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
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || PANEL_TYPOGRAPHY_DEFAULTS.fontClass)
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || PANEL_TYPOGRAPHY_DEFAULTS.textSizeClass,
  )
  const uiPanelKeyValueInputClass = useGraphStore(
    s => s.uiPanelKeyValueInputClass || PANEL_TYPOGRAPHY_DEFAULTS.keyValueInputClass,
  )
  const mergedClassName = [
    uiPanelTextFontClass,
    uiPanelKeyValueTextSizeClass,
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
        {String(inputProps.type || 'text').toLowerCase() === 'text' ? (
          <PlainTextInputEditor
            inputType="text"
            value={typeof inputProps.value === 'string' ? inputProps.value : String(inputProps.value ?? '')}
            defaultValue={
              typeof inputProps.defaultValue === 'string'
                ? inputProps.defaultValue
                : typeof inputProps.defaultValue === 'number'
                  ? String(inputProps.defaultValue)
                  : undefined
            }
            id={inputProps.id}
            placeholder={inputProps.placeholder}
            disabled={inputProps.disabled}
            readOnly={inputProps.readOnly}
            list={inputProps.list}
            min={inputProps.min}
            max={inputProps.max}
            step={inputProps.step}
            autoComplete={inputProps.autoComplete}
            spellCheck={
              typeof inputProps.spellCheck === 'boolean'
                ? inputProps.spellCheck
                : undefined
            }
            onBlur={inputProps.onBlur}
            onKeyDown={inputProps.onKeyDown}
            onChange={next => {
              inputProps.onChange?.({
                target: { value: next },
                currentTarget: { value: next },
              } as unknown as React.ChangeEvent<HTMLInputElement>)
            }}
            className={mergedClassName}
          />
        ) : (
          <input
            {...inputProps}
            className={mergedClassName}
          />
        )}
      </Tooltip>
    </RightAlignedValueCell>
  )
}
