import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'

export function WorkspaceModeSelect<T extends string>(props: {
  value: T
  options: Array<{ value: T; label: string }>
  ariaLabel: string
  onChange: (next: T) => void
  isActive?: boolean
}) {
  const panelTypography = usePanelTypography()
  const activeClass = props.isActive
    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-l-none'
    : ''
  return (
    <select
      className={`h-6 rounded px-1 border-0 outline-none ${panelTypography.microLabelClass} font-medium ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} ${activeClass}`}
      value={props.value}
      onChange={e => props.onChange(e.target.value as T)}
      aria-label={props.ariaLabel}
    >
      {props.options.map(o => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}
