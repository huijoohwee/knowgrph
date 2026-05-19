import React from 'react'
import { Check, ChevronRight } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import { UI_TEXT_TRUNCATE } from '@/lib/ui/textLayout'
import { UI_RESPONSIVE_MENU_ROW_CLASSNAME } from '@/lib/ui/responsiveElementClasses'

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
      className={[UI_RESPONSIVE_MENU_ROW_CLASSNAME, 'gap-3 px-3 py-2 rounded', UI_THEME_TOKENS.button.hoverBg].join(' ')}
      onClick={props.onClick}
    >
      <span className={['w-5 h-5 shrink-0 flex items-center justify-center', UI_THEME_TOKENS.icon.color].join(' ')}>{props.icon}</span>
      <span className={['min-w-0 text-sm', UI_TEXT_TRUNCATE, UI_THEME_TOKENS.text.primary].join(' ')}>{props.label}</span>
      <span className={['ml-auto min-w-0 max-w-[45%] text-sm', UI_TEXT_TRUNCATE, UI_THEME_TOKENS.text.secondary].join(' ')}>{props.value || ''}</span>
      <ChevronRight className={['w-4 h-4 shrink-0', UI_THEME_TOKENS.icon.color].join(' ')} aria-hidden="true" />
    </button>
  )
}

export function LayoutChoice(props: { active: boolean; label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className={cn(
        'relative min-w-[6rem] flex-1 rounded border px-3 py-2 flex flex-col items-center justify-center gap-1 overflow-hidden',
        props.active
          ? cn(UI_THEME_TOKENS.button.activeBorder, UI_THEME_TOKENS.button.activeBg)
          : cn(UI_THEME_TOKENS.panel.border),
        UI_THEME_TOKENS.button.hoverBg,
      )}
      onClick={props.onClick}
    >
      {props.active ? (
        <span className="absolute right-2 top-2">
          <Check className={cn('w-3 h-3', UI_THEME_TOKENS.button.activeText)} aria-hidden="true" />
        </span>
      ) : null}
      <span className={props.active ? UI_THEME_TOKENS.button.activeText : UI_THEME_TOKENS.text.secondary}>{props.icon}</span>
      <span className={cn('max-w-full text-sm font-medium', UI_TEXT_TRUNCATE, props.active ? UI_THEME_TOKENS.button.activeText : UI_THEME_TOKENS.text.secondary)}>{props.label}</span>
    </button>
  )
}
