import React from 'react'
import { ChevronRight } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'

export type SettingsRowProps = {
  icon: React.ReactNode
  label: string
  value?: string
  onClick?: () => void
}

export function SettingsRow(props: SettingsRowProps) {
  return (
    <button
      type="button"
      className={['w-full flex items-center gap-3 px-3 py-2 rounded', UI_THEME_TOKENS.button.hoverBg].join(' ')}
      onClick={props.onClick}
    >
      <span className={['w-5 h-5 flex items-center justify-center', UI_THEME_TOKENS.icon.color].join(' ')}>{props.icon}</span>
      <span className={['text-sm', UI_THEME_TOKENS.text.primary].join(' ')}>{props.label}</span>
      <span className={['ml-auto text-sm', UI_THEME_TOKENS.text.secondary].join(' ')}>{props.value || ''}</span>
      <ChevronRight className={['w-4 h-4', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
    </button>
  )
}

export function LayoutChoice(props: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className={cn(
        'flex-1 rounded border px-3 py-2 flex flex-col items-center justify-center gap-1',
        props.active
          ? cn(UI_THEME_TOKENS.button.activeBorder, UI_THEME_TOKENS.button.activeBg)
          : cn(UI_THEME_TOKENS.panel.border),
        UI_THEME_TOKENS.button.hoverBg,
      )}
      onClick={props.onClick}
    >
      <span className={props.active ? UI_THEME_TOKENS.button.activeText : UI_THEME_TOKENS.text.secondary}>{props.icon}</span>
      <span className={cn('text-sm font-medium', props.active ? UI_THEME_TOKENS.button.activeText : UI_THEME_TOKENS.text.secondary)}>{props.label}</span>
    </button>
  )
}

