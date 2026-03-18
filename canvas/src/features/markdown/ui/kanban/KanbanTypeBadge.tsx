import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export const KanbanTypeBadge = React.memo(function KanbanTypeBadge() {
  return (
    <span
      className={[
        'inline-flex items-center justify-center w-9 h-9 rounded-lg border text-sm font-semibold',
        'bg-[var(--kg-panel-action-bg)]',
        UI_THEME_TOKENS.panel.border,
        UI_THEME_TOKENS.text.secondary,
      ].join(' ')}
      aria-label="Type"
    >
      T
    </span>
  )
})

