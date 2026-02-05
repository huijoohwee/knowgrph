import { Fragment, useMemo } from 'react'
import type { GraphColumnDoc } from '@/features/graph-table-db/graphTableDb'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export type GraphTableInspectorRow = {
  tableId: 'nodes' | 'edges'
  rowId: string
  order: number
  data: Record<string, unknown>
}

type GraphTableInspectorProps = {
  columns: GraphColumnDoc[]
  row: GraphTableInspectorRow | null
  widthPx?: number
  onClose: () => void
  onChangeCell: (columnId: string, next: unknown) => void
  onDeleteRow: () => void
}

const coreColumnOrder = (id: string): number => {
  if (id === 'id') return 1
  if (id === 'label') return 2
  if (id === 'type') return 3
  if (id === 'source') return 4
  if (id === 'target') return 5
  return 1000
}

export function GraphTableInspector({ columns, row, widthPx, onClose, onChangeCell, onDeleteRow }: GraphTableInspectorProps) {
  const ordered = useMemo(() => {
    const visible = columns.filter(c => !c.hidden)
    return visible
      .slice()
      .sort((a, b) => {
        const ak = coreColumnOrder(a.columnId)
        const bk = coreColumnOrder(b.columnId)
        if (ak !== bk) return ak - bk
        if (a.order !== b.order) return a.order - b.order
        return a.columnId.localeCompare(b.columnId)
      })
  }, [columns])

  if (!row) return null

  return (
    <section
      className={`h-full min-h-0 ${UI_THEME_TOKENS.panel.bg} overflow-hidden flex flex-col`}
      style={widthPx ? { width: `${widthPx}px` } : undefined}
      aria-label="Record inspector"
    >
      <header className={`px-3 py-2 border-b ${UI_THEME_TOKENS.panel.divider} flex items-center justify-between gap-2`}>
        <section className="min-w-0" aria-label="Record title">
          <p className={`text-xs ${UI_THEME_TOKENS.text.tertiary}`}>{row.tableId}</p>
          <p className={`text-sm font-semibold ${UI_THEME_TOKENS.text.primary} truncate`}>{row.rowId}</p>
        </section>
        <nav className="flex items-center gap-2" aria-label="Inspector actions">
          <button
            type="button"
            className={`App-toolbar__btn text-xs ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
            onClick={onDeleteRow}
          >
            Delete
          </button>
          <button
            type="button"
            className={`App-toolbar__btn text-xs ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
            onClick={onClose}
          >
            Close
          </button>
        </nav>
      </header>

      <section className="flex-1 min-h-0 overflow-auto" aria-label="Record fields">
        <dl className="px-3 py-2 grid grid-cols-[120px_1fr] gap-x-2 gap-y-2 items-center">
          {ordered.map(col => {
            const value = (row.data || {})[col.columnId]
            const raw = value == null ? '' : String(value)
            const disabled = col.columnId === 'id'
            return (
              <Fragment key={col.pk}>
                <dt className={`text-xs ${UI_THEME_TOKENS.text.tertiary} truncate`}>{col.name}</dt>
                <dd>
                  <input
                    className={`w-full h-7 px-2 text-xs rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.text.primary}`}
                    value={raw}
                    disabled={disabled}
                    onChange={e => onChangeCell(col.columnId, e.target.value)}
                  />
                </dd>
              </Fragment>
            )
          })}
        </dl>
      </section>
    </section>
  )
}
