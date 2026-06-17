import React from 'react'
import { useCanvasKeyTypeValueStaticRowProps } from '@/features/panels/ui/canvasKeyTypeValueRuntime'
import { PanelRangeInput } from '@/lib/ui/panelFormControls'
import { KeyTypeValueStaticRow } from 'grph-shared/react/keyTypeValueRow'

type PanelKeyTypeRangeValueRowProps = {
  keyNode: React.ReactNode
  min: number
  max: number
  step: number
  value: number
  onChange: (next: number) => void
  density?: 'compact' | 'default'
  rangeClassName?: string
  valueNode: React.ReactNode
  disabled?: boolean
}

export function PanelKeyTypeRangeValueRow({
  keyNode,
  min,
  max,
  step,
  value,
  onChange,
  density,
  rangeClassName,
  valueNode,
  disabled,
}: PanelKeyTypeRangeValueRowProps) {
  const staticRowProps = useCanvasKeyTypeValueStaticRowProps(density)
  return (
    <KeyTypeValueStaticRow
      {...staticRowProps}
      layout="keyValue"
      keyNode={keyNode}
      valueNode={(
        <>
          <PanelRangeInput
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={disabled}
            onChange={event => onChange(Number(event.target.value))}
            className={rangeClassName}
          />
          {valueNode}
        </>
      )}
    />
  )
}
