import React from 'react'
import { PanelRangeInput } from '@/lib/ui/panelFormControls'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type PanelLabeledRangeCardProps = {
  label: React.ReactNode
  valueLabel: React.ReactNode
  min: number
  max: number
  step: number
  value: number
  onChange: (next: number) => void
  className?: string
  headerClassName?: string
  rangeClassName?: string
  disabled?: boolean
}

export function PanelLabeledRangeCard({
  label,
  valueLabel,
  min,
  max,
  step,
  value,
  onChange,
  className,
  headerClassName,
  rangeClassName,
  disabled,
}: PanelLabeledRangeCardProps) {
  return (
    <section className={[`rounded-md border p-2 ${UI_THEME_TOKENS.input.border}`, className].filter(Boolean).join(' ')}>
      <section
        className={[
          `flex items-center justify-between gap-2 text-[10px] ${UI_THEME_TOKENS.text.secondary}`,
          headerClassName,
        ].filter(Boolean).join(' ')}
      >
        <span>{label}</span>
        <span className="font-mono">{valueLabel}</span>
      </section>
      <section className="mt-1">
        <PanelRangeInput
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={event => onChange(Number(event.target.value))}
          className={rangeClassName}
        />
      </section>
    </section>
  )
}
