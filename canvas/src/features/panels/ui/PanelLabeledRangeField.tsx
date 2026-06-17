import React from 'react'
import { PanelRangeInput } from '@/lib/ui/panelFormControls'

type PanelLabeledRangeFieldProps = {
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

export function PanelLabeledRangeField({
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
}: PanelLabeledRangeFieldProps) {
  return (
    <section className={['flex flex-col', className].filter(Boolean).join(' ')}>
      <label className={labelClassName}>{label}</label>
      <PanelRangeInput
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={event => onChange(Number(event.target.value))}
        className={rangeClassName}
      />
      <section className={valueClassName}>{valueLabel}</section>
    </section>
  )
}
