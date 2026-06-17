import React from 'react'
import { PanelRangeInput } from '@/lib/ui/panelFormControls'

type PanelInlineLabeledRangeRowProps = {
  label: React.ReactNode
  valueLabel: React.ReactNode
  min: number | string
  max: number | string
  step: number | string
  value: number | string
  onChange: (next: number) => void
  className?: string
  labelClassName?: string
  valueClassName?: string
  rangeClassName?: string
  disabled?: boolean
}

export function PanelInlineLabeledRangeRow({
  label,
  valueLabel,
  min,
  max,
  step,
  value,
  onChange,
  className,
  labelClassName,
  valueClassName,
  rangeClassName,
  disabled,
}: PanelInlineLabeledRangeRowProps) {
  return (
    <section className={['flex items-center gap-2', className].filter(Boolean).join(' ')}>
      <span className={labelClassName}>{label}</span>
      <PanelRangeInput
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={event => onChange(Number(event.target.value))}
        className={rangeClassName}
      />
      <span className={valueClassName}>{valueLabel}</span>
    </section>
  )
}
