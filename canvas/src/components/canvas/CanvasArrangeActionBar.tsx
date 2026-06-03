import type { ArrangeAction2d } from '@/lib/canvas/arrange2d'
import { UI_RESPONSIVE_CANVAS_FLOATING_ACTION_ROW_CLASSNAME } from '@/lib/ui/responsiveElementClasses'

const CANVAS_ARRANGE_ACTION_BUTTONS: ReadonlyArray<{ action: ArrangeAction2d; label: string }> = [
  { action: 'align-left', label: 'Align L' },
  { action: 'align-center-x', label: 'Align CX' },
  { action: 'align-right', label: 'Align R' },
  { action: 'align-top', label: 'Align T' },
  { action: 'align-center-y', label: 'Align CY' },
  { action: 'align-bottom', label: 'Align B' },
  { action: 'distribute-x', label: 'Dist X' },
  { action: 'distribute-y', label: 'Dist Y' },
]

export function CanvasArrangeActionBar(props: {
  active: boolean
  selectedCount: number
  onArrange: (action: ArrangeAction2d) => void
  ariaLabel?: string
}) {
  const { active, selectedCount, onArrange, ariaLabel = 'Arrange selected items' } = props
  if (!active || selectedCount < 2) return null

  return (
    <div
      className={[
        'pointer-events-auto absolute right-3 top-3 z-50 flex flex-nowrap gap-1 rounded-md border border-[var(--kg-border)] bg-[var(--kg-panel-bg)] p-2 text-xs text-[var(--kg-text)] shadow',
        UI_RESPONSIVE_CANVAS_FLOATING_ACTION_ROW_CLASSNAME,
      ].join(' ')}
      aria-label={ariaLabel}
    >
      {CANVAS_ARRANGE_ACTION_BUTTONS.map(button => (
        <button
          key={button.action}
          type="button"
          className="shrink-0 rounded border border-[var(--kg-border)] px-2 py-1"
          onClick={() => onArrange(button.action)}
        >
          {button.label}
        </button>
      ))}
    </div>
  )
}
