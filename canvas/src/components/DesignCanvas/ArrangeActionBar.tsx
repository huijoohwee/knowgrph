import React from 'react'
import type { DesignCanvasArrangeAction } from '@/components/DesignCanvas/arrangeActions'

const ARRANGE_ACTION_BUTTONS: Array<{ action: DesignCanvasArrangeAction; label: string }> = [
  { action: 'align-left', label: 'Align L' },
  { action: 'align-center-x', label: 'Align CX' },
  { action: 'align-right', label: 'Align R' },
  { action: 'align-top', label: 'Align T' },
  { action: 'align-center-y', label: 'Align CY' },
  { action: 'align-bottom', label: 'Align B' },
  { action: 'distribute-x', label: 'Dist X' },
  { action: 'distribute-y', label: 'Dist Y' },
]

export function DesignCanvasArrangeActionBar(props: {
  active: boolean
  selectedCount: number
  onAction: (action: DesignCanvasArrangeAction) => void
}) {
  const { active, selectedCount, onAction } = props
  if (!active || selectedCount < 2) return null
  return (
    <div className="pointer-events-none absolute right-3 top-3 z-50 flex flex-wrap gap-1 rounded-md border border-[var(--kg-border)] bg-[var(--kg-panel-bg)] p-2 text-xs text-[var(--kg-text)] shadow">
      {ARRANGE_ACTION_BUTTONS.map(button => (
        <button
          key={button.action}
          type="button"
          className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1"
          onClick={() => onAction(button.action)}
        >
          {button.label}
        </button>
      ))}
    </div>
  )
}
