import { useMemo, useReducer, useRef } from 'react'
import type { GraphColumnDoc } from '@/features/graph-table-db/graphTableDb'
import type { GraphTableGridRow } from '@/features/graph-table/ui/graphTableTypes'
import type {
  GraphTableColumnVisibilityById,
  GraphTableColumnWidthsPxById,
  GraphTableFilterClause,
  GraphTableFilterMatch,
  GraphTableSortRule,
} from '@/features/graph-table/ui/graphTableViewState'
import { makeOffsets } from '@/features/graph-table/ui/fast-grid/fastGridMath'
import { getCellText, type GridColumnMeta, type GridDisplayRow, type GridLayout } from '@/features/graph-table/ui/fast-grid/canvasGridRender'

const normalize = (value: unknown): string => String(value ?? '').toLowerCase()

export function useGraphTableGridModel(args: {
  columns: GraphColumnDoc[]
  rows: GraphTableGridRow[]
  columnVisibilityById: GraphTableColumnVisibilityById
  filterMatch: GraphTableFilterMatch
  filterClauses: GraphTableFilterClause[]
  groupBy: string
  sortRules: GraphTableSortRule[]
  columnWidthsPxById: GraphTableColumnWidthsPxById
  columnOrderIds?: string[]
  headerHeight: number
  rowHeight: number
  selectedRowIds: string[]
}) {
  const collapseSetRef = useRef<Set<string>>(new Set())
  const [collapseVersion, bumpCollapseVersion] = useReducer(x => x + 1, 0)

  const visibleDataColumns = useMemo(() => {
    const base = args.columns
      .filter(c => !c.hidden)
      .slice()
      .sort((a, b) => a.order - b.order)

    const visibilityFiltered = base.filter(c => args.columnVisibilityById[c.columnId] !== false)
    const order = Array.isArray(args.columnOrderIds) ? args.columnOrderIds : null
    if (!order || order.length === 0) return visibilityFiltered

    const byId = new Map<string, GraphColumnDoc>()
    for (const c of visibilityFiltered) byId.set(c.columnId, c)

    const used = new Set<string>()
    const next: GraphColumnDoc[] = []
    for (const id of order) {
      const c = byId.get(id)
      if (!c) continue
      if (used.has(id)) continue
      used.add(id)
      next.push(c)
    }
    for (const c of visibilityFiltered) {
      if (used.has(c.columnId)) continue
      next.push(c)
    }
    return next
  }, [args.columnOrderIds, args.columnVisibilityById, args.columns])

  const columns: GridColumnMeta[] = useMemo(() => {
    const pinned: GridColumnMeta[] = [
      { kind: 'select', id: '__select', title: '', width: 44, pinned: true, editable: false },
      { kind: 'order', id: '__order', title: '#', width: 72, pinned: true, editable: false },
    ]
    const dynamic: GridColumnMeta[] = visibleDataColumns.map(c => {
      const widthRaw = args.columnWidthsPxById[c.columnId]
      const width = Math.max(80, Math.min(720, Math.round(typeof widthRaw === 'number' ? widthRaw : 180)))
      const editable = c.columnId !== 'id'
      return { kind: 'data', id: c.columnId, title: c.name, width, pinned: false, editable, dataKind: c.kind }
    })
    return pinned.concat(dynamic)
  }, [args.columnWidthsPxById, visibleDataColumns])

  const sortIndexByColumnId = useMemo(() => {
    const out: Record<string, { dir: 'asc' | 'desc'; index: number }> = {}
    for (let i = 0; i < args.sortRules.length; i += 1) {
      const r = args.sortRules[i]
      const columnId = String(r.columnId || '').trim()
      if (!columnId) continue
      out[columnId] = { dir: r.direction === 'desc' ? 'desc' : 'asc', index: i + 1 }
    }
    return out
  }, [args.sortRules])

  const displayRows = useMemo(() => {
    void collapseVersion

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

    const filtered = args.filterClauses.length
      ? args.rows.filter(r => {
          const ok =
            args.filterMatch === 'any'
              ? args.filterClauses.some(c => matchesClause(r, c))
              : args.filterClauses.every(c => matchesClause(r, c))
          return ok
        })
      : args.rows

    const sorted = args.sortRules.length
      ? filtered
          .slice()
          .sort((a, b) => {
            for (const rule of args.sortRules) {
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

    const groupKey = args.groupBy
    if (!groupKey) {
      return sorted.map(r => ({ kind: 'row' as const, row: r, groupLabel: undefined }))
    }

    const groups = new Map<string, GraphTableGridRow[]>()
    for (const row of sorted) {
      const value = (row as unknown as Record<string, unknown>)[groupKey]
      const label = getCellText(value) || '(empty)'
      const existing = groups.get(label)
      if (existing) existing.push(row)
      else groups.set(label, [row])
    }

    const out: GridDisplayRow<GraphTableGridRow>[] = []
    const entries = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]))
    for (const [label, rows] of entries) {
      out.push({ kind: 'group' as const, label, count: rows.length })
      if (collapseSetRef.current.has(label)) continue
      for (const r of rows) out.push({ kind: 'row' as const, row: r, groupLabel: label })
    }
    return out
  }, [args.filterClauses, args.filterMatch, args.groupBy, args.rows, args.sortRules, collapseVersion])

  const allVisibleRowIds = useMemo(() => {
    const out: string[] = []
    for (const item of displayRows) {
      if (item.kind === 'row') out.push(item.row.id)
    }
    return out
  }, [displayRows])

  const selectedSet = useMemo(() => new Set(args.selectedRowIds), [args.selectedRowIds])
  const allSelected = allVisibleRowIds.length > 0 && allVisibleRowIds.every(id => selectedSet.has(id))
  const someSelected = allVisibleRowIds.some(id => selectedSet.has(id))

  const layout: GridLayout = useMemo(() => {
    const pinned = columns.filter(c => c.pinned)
    const scrollable = columns.filter(c => !c.pinned)
    const pinnedWidth = pinned.reduce((acc, c) => acc + c.width, 0)
    const scrollableOffsets = makeOffsets(scrollable.map(c => c.width))
    const totalWidth = pinnedWidth + (scrollableOffsets[scrollableOffsets.length - 1] || 0)
    const totalHeight = args.headerHeight + displayRows.length * args.rowHeight
    return { pinned, scrollable, pinnedWidth, scrollableOffsets, totalWidth, totalHeight }
  }, [args.headerHeight, args.rowHeight, columns, displayRows.length])

  const rowIndexById = useMemo(() => {
    const out = new Map<string, number>()
    for (let i = 0; i < displayRows.length; i += 1) {
      const item = displayRows[i]
      if (item.kind === 'row') out.set(item.row.id, i)
    }
    return out
  }, [displayRows])

  const rowIdToGroupLabel = useMemo(() => {
    const out = new Map<string, string>()
    for (const item of displayRows) {
      if (item.kind === 'row' && item.groupLabel) out.set(item.row.id, item.groupLabel)
    }
    return out
  }, [displayRows])

  const toggleGroupCollapsed = (label: string) => {
    const next = new Set(collapseSetRef.current)
    if (next.has(label)) next.delete(label)
    else next.add(label)
    collapseSetRef.current = next
    bumpCollapseVersion()
  }

  const ensureGroupExpandedForRow = (rowId: string) => {
    const label = rowIdToGroupLabel.get(rowId)
    if (!label) return false
    if (!collapseSetRef.current.has(label)) return false
    collapseSetRef.current = new Set(Array.from(collapseSetRef.current).filter(x => x !== label))
    bumpCollapseVersion()
    return true
  }

  return {
    columns,
    displayRows,
    layout,
    allVisibleRowIds,
    selectedSet,
    allSelected,
    someSelected,
    sortIndexByColumnId,
    rowIndexById,
    rowIdToGroupLabel,
    collapseSetRef,
    toggleGroupCollapsed,
    ensureGroupExpandedForRow,
  }
}
