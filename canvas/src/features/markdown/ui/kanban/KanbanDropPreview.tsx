import React from 'react'
import { ArrowDownToLine, ArrowUpToLine, CornerDownRight } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_COLOR_PRIMARY_BLUE_INDICATOR } from '@/features/toolbar/ui/toolbarStyles'
import type { KanbanDropPosition } from './kanbanReorder'

export function KanbanCardDropPreview(props: { position: KanbanDropPosition; label?: string }) {
  if (props.position === 'end') return null
  const top = props.position === 'before'
  const Icon = top ? ArrowUpToLine : ArrowDownToLine
  const label = props.label || (top ? 'Insert before' : 'Insert after')
  return (
    <div
      className={['pointer-events-none absolute inset-x-2 z-10 flex items-center gap-2', top ? 'top-0 -translate-y-1/2' : 'bottom-0 translate-y-1/2'].join(' ')}
      aria-hidden="true"
    >
      <div className="h-[2px] flex-1 rounded-full" style={{ backgroundColor: UI_COLOR_PRIMARY_BLUE_INDICATOR }} />
      <span
        className={[
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium shadow-sm',
          UI_THEME_TOKENS.panel.border,
          UI_THEME_TOKENS.panel.bg,
          UI_THEME_TOKENS.text.secondary,
        ].join(' ')}
      >
        <Icon className="h-3 w-3" aria-hidden="true" />
        <span>{label}</span>
      </span>
    </div>
  )
}

export function KanbanLaneDropPreview(props: { label: string; compact?: boolean }) {
  return (
    <div
      className={[
        'rounded-md border border-dashed px-3 py-3 text-center',
        props.compact ? 'mt-2' : 'm-2',
        UI_THEME_TOKENS.panel.border,
        UI_THEME_TOKENS.panel.bg,
        UI_THEME_TOKENS.text.tertiary,
      ].join(' ')}
      style={{ borderColor: UI_COLOR_PRIMARY_BLUE_INDICATOR }}
      aria-hidden="true"
    >
      <div className="flex items-center justify-center gap-2 text-[11px] font-medium">
        <CornerDownRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span>{props.label}</span>
      </div>
    </div>
  )
}
