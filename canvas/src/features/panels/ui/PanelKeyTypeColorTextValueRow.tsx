import React from 'react'
import { useCanvasKeyTypeValueStaticRowProps } from '@/features/panels/ui/canvasKeyTypeValueRuntime'
import { PanelTextInput } from '@/lib/ui/panelFormControls'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_RESPONSIVE_COLOR_SWATCH_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import { KeyTypeValueStaticRow } from 'grph-shared/react/keyTypeValueRow'

type PanelKeyTypeColorTextValueRowProps = {
  keyNode: React.ReactNode
  value: string
  onChange: (next: string) => void
  placeholder?: string
  textInputClassName?: string
  colorInputClassName?: string
  density?: 'compact' | 'default'
}

function normalizeColorValue(raw: string, fallback: string): string {
  const normalized = raw.trim() || fallback
  if (normalized.startsWith('#') && (normalized.length === 4 || normalized.length === 7)) {
    return normalized
  }
  return '#000000'
}

export function PanelKeyTypeColorTextValueRow({
  keyNode,
  value,
  onChange,
  placeholder,
  textInputClassName,
  colorInputClassName,
  density = 'compact',
}: PanelKeyTypeColorTextValueRowProps) {
  const staticRowProps = useCanvasKeyTypeValueStaticRowProps(density)
  const swatchClassName = [
    UI_RESPONSIVE_COLOR_SWATCH_CLASSNAME,
    'border rounded cursor-pointer bg-transparent',
    UI_THEME_TOKENS.input.border,
    UI_THEME_TOKENS.focus.primaryBorderRing,
    colorInputClassName,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <KeyTypeValueStaticRow
      {...staticRowProps}
      layout="keyValue"
      keyNode={keyNode}
      valueNode={(
        <section className="flex items-center gap-2">
          <input
            type="color"
            className={swatchClassName}
            value={normalizeColorValue(value, placeholder || '#000000')}
            onChange={event => onChange(event.target.value)}
          />
          <PanelTextInput
            className={textInputClassName}
            value={value}
            onChange={event => onChange(event.target.value)}
            placeholder={placeholder}
          />
        </section>
      )}
    />
  )
}
