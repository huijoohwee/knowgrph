import React from 'react'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import type { GraphColumnDoc, GraphTableId } from '@/features/graph-table-db/graphTableDb'
import type { GraphTableGridRow } from './GraphTableGrid'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type {
  GraphTableColumnVisibilityById,
  GraphTableColumnWidthsPxById,
  GraphTableFilterClause,
  GraphTableFilterMatch,
  GraphTableRowHeightPreset,
  GraphTableSortRule,
} from './graphTableViewState'

export type GraphTableSemanticTableProps = {
  tableId: GraphTableId
  columns: GraphColumnDoc[]
  rows: GraphTableGridRow[]
  selectedRowIds: string[]
  focusRowId?: string | null
  autoScrollToFocusRow?: boolean
  columnVisibilityById: GraphTableColumnVisibilityById
  filterMatch: GraphTableFilterMatch
  filterClauses: GraphTableFilterClause[]
  groupBy: string
  sortRules: GraphTableSortRule[]
  rowHeightPreset: GraphTableRowHeightPreset
  columnWidthsPxById: GraphTableColumnWidthsPxById
  onColumnWidthChanged: (columnId: string, widthPx: number) => void
  onRowClicked: (rowId: string) => void
  onSelectionChanged: (selectedRowIds: string[]) => void
}

const getCellText = (value: unknown): string => {
  if (value == null) return ''
  if (typeof value === 'string') return value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

const getRowValue = (row: GraphTableGridRow, columnId: string): unknown => {
  return (row as unknown as Record<string, unknown>)[columnId]
}

const normalize = (value: unknown): string => String(value ?? '').toLowerCase()

export function GraphTableSemanticTable(props: GraphTableSemanticTableProps) {
  const tableBodyRef = React.useRef<HTMLTableSectionElement | null>(null)
  const groupCollapseRef = React.useRef<Set<string>>(new Set())
  const [, forceRender] = React.useReducer(x => x + 1, 0)

  const visibleColumns = React.useMemo(() => {
    return props.columns
      .filter(c => !c.hidden)
      .slice()
      .sort((a, b) => a.order - b.order)
      .filter(c => {
        return props.columnVisibilityById[c.columnId] !== false
      })
  }, [props.columnVisibilityById, props.columns])

  const derivedRows = React.useMemo(() => {
    const base = props.rows

    const matchesClause = (row: GraphTableGridRow, clause: GraphTableFilterClause) => {
      const raw = (row as unknown as Record<string, unknown>)[clause.columnId]
      const hay = normalize(raw)
      const needle = normalize(clause.value)
      if (!needle) return true
      if (clause.operator === 'equals') return hay === needle
      if (clause.operator === 'startsWith') return hay.startsWith(needle)
      if (clause.operator === 'endsWith') return hay.endsWith(needle)
      return hay.includes(needle)
    }

    const filtered = props.filterClauses.length
      ? base.filter(r => {
          const ok = props.filterMatch === 'any'
            ? props.filterClauses.some(c => matchesClause(r, c))
            : props.filterClauses.every(c => matchesClause(r, c))
          return ok
        })
      : base

    const sorted = props.sortRules.length
      ? filtered
          .slice()
          .sort((a, b) => {
            for (const rule of props.sortRules) {
              const av = (a as unknown as Record<string, unknown>)[rule.columnId]
              const bv = (b as unknown as Record<string, unknown>)[rule.columnId]
              const as = getCellText(av)
              const bs = getCellText(bv)
              if (as === bs) continue
              const cmp = as.localeCompare(bs, undefined, { numeric: true, sensitivity: 'base' })
              return rule.direction === 'desc' ? -cmp : cmp
            }
            return 0
          })
      : filtered

    const groupKey = props.groupBy
    if (!groupKey) return { kind: 'flat' as const, rows: sorted }

    const groups = new Map<string, GraphTableGridRow[]>()
    for (const row of sorted) {
      const value = (row as unknown as Record<string, unknown>)[groupKey]
      const label = getCellText(value) || '(empty)'
      const existing = groups.get(label)
      if (existing) existing.push(row)
      else groups.set(label, [row])
    }
    const entries = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    return { kind: 'grouped' as const, groupKey, groups: entries }
  }, [props.filterClauses, props.filterMatch, props.groupBy, props.rows, props.sortRules])


  React.useEffect(() => {
    if (!props.autoScrollToFocusRow) return
    const id = typeof props.focusRowId === 'string' ? props.focusRowId : ''
    if (!id) return
    const body = tableBodyRef.current
    if (!body) return
    try {
      const el = body.querySelector(`[data-row-id="${CSS.escape(id)}"]`)
      if (el && el instanceof HTMLElement) el.scrollIntoView({ block: 'center' })
    } catch {
      void 0
    }
  }, [props.autoScrollToFocusRow, props.focusRowId])

  const allVisibleRowIds = React.useMemo(() => {
    if (derivedRows.kind === 'flat') return derivedRows.rows.map(r => r.id)
    const out: string[] = []
    for (const [, rows] of derivedRows.groups) {
      for (const r of rows) out.push(r.id)
    }
    return out
  }, [derivedRows])

  const selectedSet = React.useMemo(() => new Set(props.selectedRowIds), [props.selectedRowIds])
  const allSelected = allVisibleRowIds.length > 0 && allVisibleRowIds.every(id => selectedSet.has(id))
  const someSelected = allVisibleRowIds.some(id => selectedSet.has(id))

  const rowCellPaddingClass = props.rowHeightPreset === 'compact' ? 'py-1' : 'py-2'

  const columnWidths = props.columnWidthsPxById

  const startResize = (columnId: string, th: HTMLElement, ev: React.PointerEvent) => {
    const startWidth = Math.max(60, Math.round(th.getBoundingClientRect().width))
    const startX = ev.clientX
    let pending = startWidth
    startPointerDrag({
      ev: ev.nativeEvent,
      cursor: 'col-resize',
      shouldStart: down => {
        if (down.button !== undefined && down.button !== 0) return false
        return true
      },
      onMove: mv => {
        const dx = mv.clientX - startX
        const next = Math.max(60, Math.min(720, Math.round(startWidth + dx)))
        pending = next
        props.onColumnWidthChanged(columnId, next)
      },
      onEnd: () => {
        props.onColumnWidthChanged(columnId, pending)
      },
      onCancel: () => {
        props.onColumnWidthChanged(columnId, pending)
      },
    })
  }

  const toggleGroupCollapsed = (label: string) => {
    const next = new Set(groupCollapseRef.current)
    if (next.has(label)) next.delete(label)
    else next.add(label)
    groupCollapseRef.current = next
    forceRender()
  }

  return (
    <section className="flex-1 min-h-0 overflow-auto" aria-label={`${props.tableId} semantic table`}>
      <table className={`w-full border-separate border-spacing-0 text-xs ${UI_THEME_TOKENS.text.primary}`}>
        <caption className="sr-only">Graph entities table</caption>
        <colgroup>
          <col style={{ width: 44 }} />
          <col style={{ width: 72 }} />
          {visibleColumns.map(c => (
            <col
              key={c.columnId}
              style={{ width: Math.max(80, Math.round(columnWidths[c.columnId] ?? 180)) }}
            />
          ))}
        </colgroup>
        <thead className="sticky top-0 z-10">
          <tr className={`${UI_THEME_TOKENS.panel.bg} border-b ${UI_THEME_TOKENS.panel.divider}`}>
            <th scope="col" className={`px-2 ${rowCellPaddingClass} text-left border-b ${UI_THEME_TOKENS.panel.divider}`}>
              <input
                type="checkbox"
                checked={allSelected}
                ref={el => {
                  if (!el) return
                  el.indeterminate = !allSelected && someSelected
                }}
                onChange={() => {
                  if (allSelected) props.onSelectionChanged([])
                  else props.onSelectionChanged(allVisibleRowIds)
                }}
                aria-label="Select all rows"
              />
            </th>
            <th scope="col" className={`px-2 ${rowCellPaddingClass} text-left border-b ${UI_THEME_TOKENS.panel.divider}`}>
              #
            </th>
            {visibleColumns.map(c => (
              <th
                key={c.columnId}
                scope="col"
                className={`px-2 ${rowCellPaddingClass} text-left font-semibold border-b ${UI_THEME_TOKENS.panel.divider} relative`}
              >
                <span className="pr-3">{c.name}</span>
                <button
                  type="button"
                  aria-label={`Resize ${c.name} column`}
                  className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize"
                  onPointerDown={ev => {
                    const th = ev.currentTarget.parentElement
                    if (!th) return
                    startResize(c.columnId, th, ev)
                  }}
                />
              </th>
            ))}
          </tr>
        </thead>
        <tbody
          ref={el => {
            tableBodyRef.current = el
          }}
        >
          {derivedRows.kind === 'flat' ? (
            derivedRows.rows.map(row => {
              const isSelected = selectedSet.has(row.id)
              return (
                <tr
                  key={row.id}
                  data-row-id={row.id}
                  className={`${isSelected ? 'bg-[rgba(59,130,246,0.12)]' : ''} hover:bg-black/5 dark:hover:bg-white/5`}
                  onClick={() => props.onRowClicked(row.id)}
                >
                  <td className={`px-2 ${rowCellPaddingClass} border-b ${UI_THEME_TOKENS.panel.divider}`}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onClick={e => e.stopPropagation()}
                      onChange={() => {
                        const next = new Set(selectedSet)
                        if (next.has(row.id)) next.delete(row.id)
                        else next.add(row.id)
                        props.onSelectionChanged(Array.from(next))
                      }}
                      aria-label={`Select row ${row.id}`}
                    />
                  </td>
                  <td className={`px-2 ${rowCellPaddingClass} border-b ${UI_THEME_TOKENS.panel.divider} ${UI_THEME_TOKENS.text.tertiary}`}>
                    {row.__order ?? 0}
                  </td>
                  {visibleColumns.map(c => (
                    <td key={c.columnId} className={`px-2 ${rowCellPaddingClass} border-b ${UI_THEME_TOKENS.panel.divider}`}>
                      <span className="block truncate" title={getCellText(getRowValue(row, c.columnId))}>
                        {getCellText(getRowValue(row, c.columnId))}
                      </span>
                    </td>
                  ))}
                </tr>
              )
            })
          ) : (
            derivedRows.groups.map(([label, rows]) => {
              const collapsed = groupCollapseRef.current.has(label)
              return (
                <React.Fragment key={label}>
                  <tr className={`${UI_THEME_TOKENS.panel.bg} border-b ${UI_THEME_TOKENS.panel.divider}`}>
                    <td
                      className={`px-2 ${rowCellPaddingClass} border-b ${UI_THEME_TOKENS.panel.divider}`}
                      colSpan={2 + visibleColumns.length}
                    >
                      <button
                        type="button"
                        aria-expanded={!collapsed}
                        className={`text-xs ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg} rounded px-2 py-1`}
                        onClick={() => toggleGroupCollapsed(label)}
                      >
                        {collapsed ? <ChevronRight className="inline-block w-3 h-3 mr-1" aria-hidden="true" /> : <ChevronDown className="inline-block w-3 h-3 mr-1" aria-hidden="true" />}
                        {label} ({rows.length})
                      </button>
                    </td>
                  </tr>
                  {!collapsed
                    ? rows.map(row => {
                        const isSelected = selectedSet.has(row.id)
                        return (
                          <tr
                            key={row.id}
                            data-row-id={row.id}
                            className={`${isSelected ? 'bg-[rgba(59,130,246,0.12)]' : ''} hover:bg-black/5 dark:hover:bg-white/5`}
                            onClick={() => props.onRowClicked(row.id)}
                          >
                            <td className={`px-2 ${rowCellPaddingClass} border-b ${UI_THEME_TOKENS.panel.divider}`}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onClick={e => e.stopPropagation()}
                                onChange={() => {
                                  const next = new Set(selectedSet)
                                  if (next.has(row.id)) next.delete(row.id)
                                  else next.add(row.id)
                                  props.onSelectionChanged(Array.from(next))
                                }}
                                aria-label={`Select row ${row.id}`}
                              />
                            </td>
                            <td className={`px-2 ${rowCellPaddingClass} border-b ${UI_THEME_TOKENS.panel.divider} ${UI_THEME_TOKENS.text.tertiary}`}>
                              {row.__order ?? 0}
                            </td>
                            {visibleColumns.map(c => (
                              <td key={c.columnId} className={`px-2 ${rowCellPaddingClass} border-b ${UI_THEME_TOKENS.panel.divider}`}>
                                <span className="block truncate" title={getCellText(getRowValue(row, c.columnId))}>
                                  {getCellText(getRowValue(row, c.columnId))}
                                </span>
                              </td>
                            ))}
                          </tr>
                        )
                      })
                    : null}
                </React.Fragment>
              )
            })
          )}
        </tbody>
      </table>
    </section>
  )
}
