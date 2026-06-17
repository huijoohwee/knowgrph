import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import Tooltip from '@/features/panels/ui/Tooltip'
import { PlainTextInputEditor } from '@/components/ui/PlainTextInputEditor'
import { PANEL_TYPOGRAPHY_DEFAULTS } from 'grph-shared/ui/panelTypography'
import { RightAlignedValueCell } from 'grph-shared/react/keyTypeValueRow'

export interface RightAlignedTooltipInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  tooltip: React.ReactNode
  maxWidthPx?: number
  contentClassName?: string
  containerClassName?: string
  className?: string
  type?: string
}

export function RightAlignedTooltipInput({
  tooltip,
  maxWidthPx = 260,
  contentClassName = '',
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
