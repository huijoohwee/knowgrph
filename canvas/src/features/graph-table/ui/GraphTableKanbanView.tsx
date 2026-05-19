import React from 'react'
import type { GraphColumnDoc, GraphTableId } from '@/features/graph-table-db/graphTableDb'
import type { GraphTableGridRow } from '@/features/graph-table/ui/graphTableTypes'
import type {
  GraphTableColumnVisibilityById,
  GraphTableFilterClause,
  GraphTableFilterMatch,
  GraphTableSortRule,
} from '@/features/graph-table/ui/graphTableViewState'
import { useGraphTableGridModel } from '@/features/graph-table/ui/fast-grid/useGraphTableGridModel'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { UI_TEXT_TRUNCATE } from '@/lib/ui/textLayout'

const EMPTY_COLUMN_WIDTHS: Record<string, number> = {}

type LaneModel = {
  id: string
  label: string
  rows: readonly GraphTableGridRow[]
}

const getRowTitle = (row: GraphTableGridRow): string => {
  const anyRow = row as unknown as Record<string, unknown>
  const title = typeof anyRow.title === 'string' ? anyRow.title.trim() : ''
  if (title) return title
  const label = typeof anyRow.label === 'string' ? anyRow.label.trim() : ''
  if (label) return label
  const name = typeof anyRow.name === 'string' ? anyRow.name.trim() : ''
  if (name) return name
  const heading = typeof anyRow.heading === 'string' ? anyRow.heading.trim() : ''
  if (heading) return heading
  return row.id
}

const getRowMeta = (row: GraphTableGridRow, tableId: GraphTableId): string => {
  const anyRow = row as unknown as Record<string, unknown>
  if (tableId === 'edges') {
    const source = typeof anyRow.source === 'string' ? anyRow.source.trim() : ''
    const target = typeof anyRow.target === 'string' ? anyRow.target.trim() : ''
    if (source || target) return [source, target].filter(Boolean).join(' → ')
  }
  return ''
}

export const GraphTableKanbanView = React.memo(function GraphTableKanbanView(props: {
  tableId: GraphTableId
  columns: GraphColumnDoc[]
  rows: GraphTableGridRow[]
  columnVisibilityById: GraphTableColumnVisibilityById
  filterMatch: GraphTableFilterMatch
  filterClauses: GraphTableFilterClause[]
  groupBy: string
  sortRules: GraphTableSortRule[]
  columnOrderIds?: string[]
  selectedRowIds: readonly string[]
  onRowClicked: (rowId: string) => void
}) {
  const typography = usePanelTypography()
  const selectedSet = React.useMemo(() => new Set(props.selectedRowIds), [props.selectedRowIds])

  const { displayRows } = useGraphTableGridModel({
    columns: props.columns,
    rows: props.rows,
    columnVisibilityById: props.columnVisibilityById,
    filterMatch: props.filterMatch,
    filterClauses: props.filterClauses,
    groupBy: props.groupBy,
    sortRules: props.sortRules,
    columnWidthsPxById: EMPTY_COLUMN_WIDTHS,
    columnOrderIds: props.columnOrderIds,
    headerHeight: 32,
    rowHeight: 32,
    selectedRowIds: Array.from(selectedSet),
  })

  const lanes = React.useMemo<LaneModel[]>(() => {
    if (!props.groupBy) {
      const rows = displayRows.filter(r => r.kind === 'row').map(r => r.row)
      return [{ id: 'all', label: 'All', rows }]
    }

    const byLabel = new Map<string, GraphTableGridRow[]>()
    for (const item of displayRows) {
      if (item.kind !== 'row') continue
      const label = item.groupLabel || '(empty)'
      const existing = byLabel.get(label)
      if (existing) existing.push(item.row)
      else byLabel.set(label, [item.row])
    }
    return Array.from(byLabel.entries()).map(([label, rows]) => ({ id: label, label, rows }))
  }, [displayRows, props.groupBy])

  return (
    <section className="flex-1 min-h-0 min-w-0 max-w-full overflow-x-auto overflow-y-auto" aria-label="Graph Data Table Kanban view">
      <div className="min-h-0 min-w-0 max-w-full flex items-start gap-3 p-3" role="list">
        {lanes.map(lane => (
          <section
            key={lane.id}
            className={[
              'kg-graph-table-kanban-lane shrink-0 rounded border flex flex-col max-h-full overflow-hidden',
              UI_THEME_TOKENS.panel.border,
              UI_THEME_TOKENS.panel.bg,
            ].join(' ')}
            aria-label={`Lane ${lane.label}`}
          >
            <header className={['px-3 py-2 border-b', UI_THEME_TOKENS.panel.border].join(' ')}>
              <div className={['flex min-w-0 max-w-full items-center justify-between gap-2 overflow-hidden', typography.microLabelClass].join(' ')}>
                <h2 className={['min-w-0 font-medium', UI_TEXT_TRUNCATE, UI_THEME_TOKENS.text.primary].join(' ')}>{lane.label}</h2>
                <output className={UI_THEME_TOKENS.text.tertiary}>{lane.rows.length}</output>
              </div>
            </header>

            <ul className="flex-1 min-h-0 overflow-y-auto list-none m-0 p-2 flex flex-col gap-2" aria-label={`${lane.label} cards`}>
              {lane.rows.map(row => {
                const selected = selectedSet.has(row.id)
                const title = getRowTitle(row)
                const meta = getRowMeta(row, props.tableId)
                return (
                  <li key={row.id} className="list-none">
                    <button
                      type="button"
                      className={[
                        'w-full min-w-0 max-w-full overflow-hidden text-left rounded border px-3 py-2',
                        typography.microLabelClass,
                        selected ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`,
                        UI_THEME_TOKENS.panel.border,
                      ].join(' ')}
                      aria-current={selected ? 'true' : undefined}
                      onClick={() => {
                        props.onRowClicked(row.id)
                      }}
                    >
                      <div className={['font-medium', UI_TEXT_TRUNCATE, UI_THEME_TOKENS.text.primary].join(' ')}>{title}</div>
                      {meta ? <div className={['mt-1', UI_TEXT_TRUNCATE, UI_THEME_TOKENS.text.tertiary].join(' ')}>{meta}</div> : null}
                      <div className={['mt-1', UI_TEXT_TRUNCATE, UI_THEME_TOKENS.text.tertiary].join(' ')}>{row.id}</div>
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
      </div>
    </section>
  )
})
