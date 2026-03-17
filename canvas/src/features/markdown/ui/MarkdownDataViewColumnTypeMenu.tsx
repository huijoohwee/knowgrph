import React from 'react'
import { Check } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { MarkdownDataViewColumnType } from './markdownDataViewColumnType'
import { MARKDOWN_DATA_VIEW_COLUMN_TYPE_OPTIONS, isColumnTypeEditable } from './markdownDataViewColumnType'
import { iconByColumnType } from './markdownDataViewColumnTypeMenuIcons'

export function MarkdownDataViewColumnTypeMenu(props: {
  ariaLabel: string
  value: MarkdownDataViewColumnType
  onSelect: (next: MarkdownDataViewColumnType) => void
  className?: string
  disabled?: boolean
}) {
  return (
    <menu
      className={[
        'rounded border shadow-sm p-1 z-20',
        UI_THEME_TOKENS.panel.bg,
        UI_THEME_TOKENS.panel.border,
        props.className || '',
      ].join(' ')}
      aria-label={props.ariaLabel}
    >
      {MARKDOWN_DATA_VIEW_COLUMN_TYPE_OPTIONS.map(o => {
        const active = o.key === props.value
        const Icon = iconByColumnType[o.key]
        const disabled = props.disabled || !isColumnTypeEditable(o.key)
        return (
          <li key={o.key} className="list-none">
            <button
              type="button"
              className={[
                'w-full flex items-center gap-2 px-2 py-2 rounded text-xs',
                disabled ? UI_THEME_TOKENS.text.tertiary : UI_THEME_TOKENS.button.hoverBg,
              ].join(' ')}
              aria-disabled={disabled}
              disabled={disabled}
                onClick={(e) => {
                  props.onSelect(o.key)
                  const el = (e.currentTarget as HTMLElement | null)?.closest('details') as HTMLDetailsElement | null
                  if (el) el.open = false
                }}
            >
              <Icon className={['w-4 h-4 shrink-0', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
              <span className="flex-1 text-left">{o.label}</span>
              {active ? <Check className={['w-4 h-4', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" /> : null}
            </button>
          </li>
        )
      })}
    </menu>
  )
}
