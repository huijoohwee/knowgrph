import React from 'react'
import { Check } from 'lucide-react'

import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export type TypeMenuOption<T extends string> = {
  key: T
  label: string
  icon: React.ComponentType<{ className?: string }>
}

export type TypeMenuProps<T extends string> = {
  ariaLabel: string
  value: T
  options: readonly TypeMenuOption<T>[]
  onSelect: (next: T) => void
  className?: string
  isDisabled?: (key: T) => boolean
  close?: () => void
}

export function TypeMenu<T extends string>(props: TypeMenuProps<T>) {
  return (
    <menu
      className={
        [
          'rounded border shadow-sm p-1 z-20',
          UI_THEME_TOKENS.panel.bg,
          UI_THEME_TOKENS.panel.border,
          props.className || '',
        ].join(' ')
      }
      aria-label={props.ariaLabel}
    >
      {props.options.map(o => {
        const active = o.key === props.value
        const disabled = props.isDisabled?.(o.key) ?? false
        const Icon = o.icon
        return (
          <li key={o.key} className="list-none">
            <button
              type="button"
              className={
                [
                  'w-full flex items-center gap-2 px-2 py-2 rounded text-xs',
                  disabled ? UI_THEME_TOKENS.text.tertiary : UI_THEME_TOKENS.button.hoverBg,
                ].join(' ')
              }
              aria-disabled={disabled}
              disabled={disabled}
              onClick={(e) => {
                props.onSelect(o.key)
                if (props.close) {
                  props.close()
                  return
                }
                const el = (e.currentTarget as HTMLElement | null)?.closest('details') as HTMLDetailsElement | null
                if (el) el.open = false
              }}
            >
              <Icon className={['w-4 h-4 shrink-0', UI_THEME_TOKENS.icon.color].join(' ')} />
              <span className="flex-1 text-left">{o.label}</span>
              {active ? <Check className={['w-4 h-4', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" /> : null}
            </button>
          </li>
        )
      })}
    </menu>
  )
}
