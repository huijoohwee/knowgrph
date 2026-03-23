import type { ArrangeAction2d } from '@/lib/canvas/arrange2d'

export function ArrangeToolbar2d(props: {
  active: boolean
  selectedCount: number
  onArrange: (action: ArrangeAction2d) => void
}) {
  const { active, selectedCount, onArrange } = props
  if (!active) return null
  if (selectedCount < 2) return null

  return (
    <div className="pointer-events-none absolute right-3 top-3 z-50 flex flex-wrap gap-1 rounded-md border border-[var(--kg-border)] bg-[var(--kg-panel-bg)] p-2 text-xs text-[var(--kg-text)] shadow">
      <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => onArrange('align-left')}>
        Align L
      </button>
      <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => onArrange('align-center-x')}>
        Align CX
      </button>
      <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => onArrange('align-right')}>
        Align R
      </button>
      <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => onArrange('align-top')}>
        Align T
      </button>
      <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => onArrange('align-center-y')}>
        Align CY
      </button>
      <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => onArrange('align-bottom')}>
        Align B
      </button>
      <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => onArrange('distribute-x')}>
        Dist X
      </button>
      <button type="button" className="pointer-events-auto rounded border border-[var(--kg-border)] px-2 py-1" onClick={() => onArrange('distribute-y')}>
        Dist Y
      </button>
    </div>
  )
}

