import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export function WorkspaceModeSelect<T extends string>(props: {
  value: T
  options: Array<{ value: T; label: string }>
  ariaLabel: string
  onChange: (next: T) => void
  isActive?: boolean
}) {
  const activeClass = props.isActive
    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-[color:var(--kg-border)] border-l-transparent rounded-l-none -ml-px'
    : ''
  return (
    <select
      className={`h-6 rounded border px-1 text-[11px] ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} ${activeClass}`}
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
