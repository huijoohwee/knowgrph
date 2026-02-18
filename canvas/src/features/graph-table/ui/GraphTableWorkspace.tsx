import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Subscription } from 'rxjs'
import type { RxChangeEvent } from 'rxdb'
import { useGraphStore } from '@/hooks/useGraphStore'
import { deriveGraphDataWithGroupCollapse } from '@/components/GraphCanvas/viewDerivation'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { WorkspaceHeader, WorkspaceHeaderRow } from '@/components/ui/WorkspaceHeader'
import { hashString32 } from 'grph-shared/hash/stringHash'
import { LS_KEYS } from '@/lib/config'
import { lsBool, lsInt, lsJson, lsSetBool, lsSetInt, lsSetJson } from '@/lib/persistence'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import { VerticalResizeSeparatorHr } from '@/components/ui/VerticalResizeSeparatorHr'
import {
  allocateNewRowId,
  createRowFromGraphEntity,
  getGraphTableDb,
  updateGraphTableCell,
  type GraphColumnDoc,
  type GraphRowDoc,
  type GraphTableId,
} from '@/features/graph-table-db/graphTableDb'
import type { GraphTableGridRow } from '@/features/graph-table/ui/graphTableTypes'
import { GraphTableInspector, type GraphTableInspectorRow } from '@/features/graph-table/ui/GraphTableInspector'
import { GraphTableToolbar } from '@/features/graph-table/ui/GraphTableToolbar'
import { GraphTableFastGrid } from '@/features/graph-table/ui/GraphTableFastGrid'
import { EmbeddedWorkspaceShell } from '@/components/EmbeddedWorkspaceShell'
import {
  makeGraphTableRuleId,
  parseColumnOrderByTableId,
  parseColumnVisibilityById,
  parseColumnWidthsPxById,
  parseFilterClauses,
  parseFilterMatch,
  parseRowHeightPreset,
  parseSortRules,
  type GraphTableColumnOrderByTableId,
  type GraphTableColumnVisibilityById,
  type GraphTableColumnWidthsPxById,
  type GraphTableFilterClause,
  type GraphTableFilterMatch,
  type GraphTableRowHeightPreset,
  type GraphTableSortRule,
} from '@/features/graph-table/ui/graphTableViewState'
import { applyCellUpdateToGraphStore } from '@/features/graph-table/lib/applyCellUpdateToGraphStore'
import { useGraphTableDbSync } from '@/features/graph-table/hooks/useGraphTableDbSync'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { UI_LABELS } from '@/lib/config'

const mapRowDocToGridRow = (doc: GraphRowDoc): GraphTableGridRow => ({
  id: doc.rowId,
  __order: doc.order,
  ...(doc.data || {}),
})

const getRowTocId = (row: GraphTableGridRow | null): string | null => {
  if (!row) return null
  const anyRow = row as unknown as Record<string, unknown>
  const anchorId = typeof anyRow.anchorId === 'string' ? anyRow.anchorId.trim() : ''
  if (anchorId) return anchorId
  const anchor = typeof anyRow.anchor === 'string' ? anyRow.anchor.trim() : ''
  if (anchor) return anchor
  const heading = typeof anyRow.heading === 'string' ? anyRow.heading.trim() : ''
  if (heading) return heading
  return null
}

const applyColumnOrder = (args: { columns: GraphColumnDoc[]; orderIds: string[] | undefined }): GraphColumnDoc[] => {
  const base = args.columns
    .filter(c => !c.hidden)
    .slice()
    .sort((a, b) => a.order - b.order)
  const order = Array.isArray(args.orderIds) ? args.orderIds : null
  if (!order || order.length === 0) return base

  const byId = new Map<string, GraphColumnDoc>()
  for (const c of base) byId.set(c.columnId, c)
  const used = new Set<string>()
  const next: GraphColumnDoc[] = []
  for (const id of order) {
    const c = byId.get(id)
    if (!c) continue
    if (used.has(id)) continue
    used.add(id)
    next.push(c)
  }
  for (const c of base) {
    if (used.has(c.columnId)) continue
    next.push(c)
  }
  return next
}

const reorderIds = (args: {
  ids: string[]
  fromId: string
  toId: string
  side: 'left' | 'right'
}): string[] => {
  const ids = args.ids.slice()
  const fromIndex = ids.indexOf(args.fromId)
  const toIndex = ids.indexOf(args.toId)
  if (fromIndex < 0 || toIndex < 0) return ids
  if (fromIndex === toIndex) return ids

  const insertBase = toIndex + (args.side === 'right' ? 1 : 0)
  const insertIndex = fromIndex < insertBase ? insertBase - 1 : insertBase
  ids.splice(fromIndex, 1)
  ids.splice(insertIndex, 0, args.fromId)
  return ids
}

export default function GraphTableWorkspace(props: { canvasPreview?: ReactNode }) {
  const panelTypography = usePanelTypography()
  const workspaceViewMode = useGraphStore(s => s.workspaceViewMode)
  const baseGraphData = useGraphStore(s => s.graphData)
  const collapsedGroupIds = useGraphStore(s => (s.collapsedGroupIds || []) as string[])
  const graphDataRevision = useGraphStore(s => s.graphDataRevision)
  const selectionSource = useGraphStore(s => s.selectionSource)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const openQuickEditorNodeIds = useGraphStore(s => s.openQuickEditorNodeIds || [])
  const [activeTableId, setActiveTableId] = useState<GraphTableId>('nodes')
  const [columns, setColumns] = useState<GraphColumnDoc[]>([])
  const [rows, setRows] = useState<GraphTableGridRow[]>([])
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([])
  const [inspectorRowId, setInspectorRowId] = useState<string | null>(null)
  const [inspectorOpen, setInspectorOpen] = useState(() => lsBool(LS_KEYS.graphTableInspectorOpen, true))
  const [inspectorWidthPx, setInspectorWidthPx] = useState(() => lsInt(LS_KEYS.graphTableInspectorWidthPx, 360))
  const [canvasPreviewCollapsed, setCanvasPreviewCollapsed] = useState(() => lsBool(LS_KEYS.graphTablePreviewCollapsed, false))
  const [canvasPreviewWidthPx, setCanvasPreviewWidthPx] = useState(() => {
    const raw = lsInt(LS_KEYS.workspacePreviewWidthPx, 520)
    const next = Math.max(320, Math.min(960, raw))
    if (next !== raw) lsSetInt(LS_KEYS.workspacePreviewWidthPx, next, { min: 320, max: 960 })
    return next
  })
  const [columnVisibilityById, setColumnVisibilityById] = useState<GraphTableColumnVisibilityById>(() =>
    lsJson(LS_KEYS.graphTableColumnVisibilityById, {}, parseColumnVisibilityById),
  )
  const [filterMatch, setFilterMatch] = useState<GraphTableFilterMatch>(() =>
    lsJson(LS_KEYS.graphTableFilterMatch, 'all' as const, parseFilterMatch),
  )
  const [filterClauses, setFilterClauses] = useState<GraphTableFilterClause[]>(() =>
    lsJson(LS_KEYS.graphTableFilters, [], parseFilterClauses),
  )
  const [groupBy, setGroupBy] = useState<string>(() => lsJson(LS_KEYS.graphTableGroupBy, '' as const, raw => (typeof raw === 'string' ? raw : null)))
  const [sortRules, setSortRules] = useState<GraphTableSortRule[]>(() => lsJson(LS_KEYS.graphTableSortRules, [], parseSortRules))
  const [rowHeightPreset, setRowHeightPreset] = useState<GraphTableRowHeightPreset>(() =>
    lsJson(LS_KEYS.graphTableRowHeightPreset, 'comfortable' as const, parseRowHeightPreset),
  )
  const [columnWidthsPxById, setColumnWidthsPxById] = useState<GraphTableColumnWidthsPxById>(() =>
    lsJson(LS_KEYS.graphTableColumnWidthsPx, {}, parseColumnWidthsPxById),
  )
  const [columnOrderByTableId, setColumnOrderByTableId] = useState<GraphTableColumnOrderByTableId>(() =>
    lsJson(LS_KEYS.graphTableColumnOrderByTableId, {}, parseColumnOrderByTableId),
  )
  const inspectorWidthPxRef = useRef(inspectorWidthPx)
  inspectorWidthPxRef.current = inspectorWidthPx
  const inspectorDragHandleRef = useRef<HTMLHRElement | null>(null)
  const collapsedGroupIdsKey = useMemo(() => {
    const ids = Array.isArray(collapsedGroupIds) ? collapsedGroupIds : []
    const normalized = ids.map(x => String(x || '').trim()).filter(Boolean)
    if (normalized.length === 0) return ''
    const unique = Array.from(new Set(normalized))
    unique.sort((a, b) => a.localeCompare(b))
    return unique.join('|')
  }, [collapsedGroupIds])

  const syncGraphData = useMemo(() => {
    if (!baseGraphData) return null
    if (!collapsedGroupIdsKey) return baseGraphData
    return deriveGraphDataWithGroupCollapse({ graphData: baseGraphData, collapsedGroupIds: collapsedGroupIdsKey.split('|').filter(Boolean) })
  }, [baseGraphData, collapsedGroupIdsKey])

  const { noteGraphWrite } = useGraphTableDbSync(graphDataRevision, syncGraphData, `baseline:${collapsedGroupIdsKey}`)

  useEffect(() => {
    lsSetBool(LS_KEYS.graphTablePreviewCollapsed, canvasPreviewCollapsed)
  }, [canvasPreviewCollapsed])

  useEffect(() => {
    lsSetInt(LS_KEYS.workspacePreviewWidthPx, canvasPreviewWidthPx, { min: 320, max: 960 })
  }, [canvasPreviewWidthPx])
  const rowCacheRef = useRef<
    Map<GraphTableId, { hashById: Map<string, number>; rowById: Map<string, GraphTableGridRow> }>
  >(new Map())

  useEffect(() => {
    let sub: Subscription | null = null
    let rowSub: Subscription | null = null
    let colMap = new Map<string, GraphColumnDoc>()
    let cancelled = false

    const cacheForTable = (() => {
      const existing = rowCacheRef.current.get(activeTableId)
      if (existing) return existing
      const next = { hashById: new Map<string, number>(), rowById: new Map<string, GraphTableGridRow>() }
      rowCacheRef.current.set(activeTableId, next)
      return next
    })()

    void (async () => {
      const { collections } = await getGraphTableDb()
      const initialCols = await collections.columns.find({ selector: { tableId: activeTableId } }).sort({ order: 'asc' }).exec()
      if (cancelled) return
      colMap = new Map(initialCols.map(d => [d.get('pk'), d.toJSON() as GraphColumnDoc]))
      setColumns(Array.from(colMap.values()).sort((a, b) => a.order - b.order))

      const initialRows = await collections.rows.find({ selector: { tableId: activeTableId } }).sort({ order: 'asc' }).exec()
      if (cancelled) return
      const cache = cacheForTable
      const nextRows: GraphTableGridRow[] = []
      const nextIds = new Set<string>()
      for (const r of initialRows) {
        const json = r.toJSON() as GraphRowDoc
        nextIds.add(json.rowId)
        const hash = hashString32(JSON.stringify(json.data || {}))
        const prevHash = cache.hashById.get(json.rowId)
        const prevRow = cache.rowById.get(json.rowId)
        if (prevRow && prevHash === hash) {
          nextRows.push(prevRow)
        } else {
          const nextRow = mapRowDocToGridRow(json)
          cache.hashById.set(json.rowId, hash)
          cache.rowById.set(json.rowId, nextRow)
          nextRows.push(nextRow)
        }
      }
      for (const id of Array.from(cache.rowById.keys())) {
        if (!nextIds.has(id)) {
          cache.rowById.delete(id)
          cache.hashById.delete(id)
        }
      }
      setRows(nextRows)

      sub = collections.columns.$.subscribe((ev: RxChangeEvent<GraphColumnDoc>) => {
        const doc = ev.documentData
        if (!doc || doc.tableId !== activeTableId) return
        if (ev.operation === 'DELETE') colMap.delete(ev.documentId)
        else colMap.set(ev.documentId, doc)
        setColumns(Array.from(colMap.values()).sort((a, b) => a.order - b.order))
      })

      rowSub = collections.rows.$.subscribe((ev: RxChangeEvent<GraphRowDoc>) => {
        const doc = ev.documentData
        if (!doc || doc.tableId !== activeTableId) return
        const cache = cacheForTable
        if (ev.operation === 'DELETE') {
          cache.hashById.delete(doc.rowId)
          cache.rowById.delete(doc.rowId)
        } else {
          const hash = hashString32(JSON.stringify(doc.data || {}))
          const prevHash = cache.hashById.get(doc.rowId)
          const prevRow = cache.rowById.get(doc.rowId)
          if (!prevRow || prevHash !== hash) {
            const nextRow = mapRowDocToGridRow(doc)
            cache.hashById.set(doc.rowId, hash)
            cache.rowById.set(doc.rowId, nextRow)
          }
        }
        const ordered = Array.from(cache.rowById.values())
          .filter(r => typeof r.id === 'string' && r.id)
          .slice()
          .sort((a, b) => (a.__order ?? 0) - (b.__order ?? 0))
        setRows(ordered)
      })
    })()

    return () => {
      cancelled = true
      try { sub?.unsubscribe() } catch { void 0 }
      try { rowSub?.unsubscribe() } catch { void 0 }
    }
  }, [activeTableId])

  useEffect(() => {
    if (selectionSource === 'table') return
    if (selectedNodeId) {
      setActiveTableId('nodes')
      setInspectorRowId(selectedNodeId)
      setSelectedRowIds([selectedNodeId])
      return
    }
    if (selectedEdgeId) {
      setActiveTableId('edges')
      setInspectorRowId(selectedEdgeId)
      setSelectedRowIds([selectedEdgeId])
      return
    }
  }, [selectedEdgeId, selectedNodeId, selectionSource])

  useEffect(() => {
    const id = typeof selectedNodeId === 'string' ? selectedNodeId : ''
    if (!id) return
    if (!openQuickEditorNodeIds.includes(id)) return
    if (inspectorOpen) return
    setInspectorOpen(true)
  }, [inspectorOpen, openQuickEditorNodeIds, selectedNodeId])

  useEffect(() => {
    lsSetBool(LS_KEYS.graphTableInspectorOpen, inspectorOpen)
  }, [inspectorOpen])

  useEffect(() => {
    lsSetJson(LS_KEYS.graphTableColumnVisibilityById, columnVisibilityById)
  }, [columnVisibilityById])

  useEffect(() => {
    lsSetJson(LS_KEYS.graphTableFilterMatch, filterMatch)
  }, [filterMatch])

  useEffect(() => {
    lsSetJson(LS_KEYS.graphTableFilters, filterClauses)
  }, [filterClauses])

  useEffect(() => {
    lsSetJson(LS_KEYS.graphTableGroupBy, groupBy)
  }, [groupBy])

  useEffect(() => {
    lsSetJson(LS_KEYS.graphTableSortRules, sortRules)
  }, [sortRules])

  useEffect(() => {
    lsSetJson(LS_KEYS.graphTableRowHeightPreset, rowHeightPreset)
  }, [rowHeightPreset])

  useEffect(() => {
    lsSetJson(LS_KEYS.graphTableColumnWidthsPx, columnWidthsPxById)
  }, [columnWidthsPxById])

  useEffect(() => {
    lsSetJson(LS_KEYS.graphTableColumnOrderByTableId, columnOrderByTableId)
  }, [columnOrderByTableId])

  useEffect(() => {
    const el = inspectorDragHandleRef.current
    if (!el) return
    const onDown = (ev: PointerEvent) => {
      if (ev.button !== undefined && ev.button !== 0) return
      const startX = ev.clientX
      const startWidth = inspectorWidthPxRef.current
      let pending = startWidth
      startPointerDrag({
        ev,
        cursor: 'col-resize',
        shouldStart: down => {
          if (down.button !== undefined && down.button !== 0) return false
          return true
        },
        onMove: mv => {
          const dx = startX - mv.clientX
          const next = Math.max(260, Math.min(720, Math.round(startWidth + dx)))
          pending = next
          setInspectorWidthPx(next)
        },
        onEnd: () => {
          setInspectorWidthPx(pending)
          lsSetInt(LS_KEYS.graphTableInspectorWidthPx, pending, { min: 260, max: 720 })
        },
        onCancel: () => {
          setInspectorWidthPx(pending)
          lsSetInt(LS_KEYS.graphTableInspectorWidthPx, pending, { min: 260, max: 720 })
        },
      })
    }
    el.addEventListener('pointerdown', onDown)
    return () => el.removeEventListener('pointerdown', onDown)
  }, [])

  const selectedRow = useMemo<GraphTableInspectorRow | null>(() => {
    if (!inspectorRowId) return null
    const row = rows.find(r => r.id === inspectorRowId)
    if (!row) return null
    const { __order: order, ...rest } = row
    return {
      tableId: activeTableId,
      rowId: inspectorRowId,
      order: order ?? 0,
      data: rest as unknown as Record<string, unknown>,
    }
  }, [activeTableId, inspectorRowId, rows])

  const handleCellValueChanged = useCallback(
    (rowId: string, columnId: string, next: unknown) => {
      void (async () => {
        const currentRow = rows.find(r => r.id === rowId)
        if (currentRow) {
          const prevRaw = (currentRow as unknown as Record<string, unknown>)[columnId]
          const normPrev = typeof prevRaw === 'string' && !prevRaw.trim() ? null : prevRaw
          const normNext = typeof next === 'string' && !next.trim() ? null : next
          if (Object.is(normPrev, normNext)) return
        }
        await updateGraphTableCell(activeTableId, rowId, columnId, next)
        const prev = useGraphStore.getState().graphDataRevision
        noteGraphWrite(prev + 1)
        applyCellUpdateToGraphStore(activeTableId, rowId, columnId, next)
      })()
    },
    [activeTableId, noteGraphWrite, rows],
  )

  const handleAddRow = useCallback(() => {
    void (async () => {
      const rowId = await allocateNewRowId(activeTableId)
      if (activeTableId === 'nodes') {
        const node: GraphNode = { id: rowId, label: rowId, type: 'Entity', properties: {} }
        await createRowFromGraphEntity('nodes', rowId, node)
        const prev = useGraphStore.getState().graphDataRevision
        noteGraphWrite(prev + 1)
        useGraphStore.getState().addNode(node)
        return
      }
      const nodes = (baseGraphData?.nodes || []).map(n => n.id)
      const source = nodes[0] || ''
      const target = nodes[1] || source
      const edge: GraphEdge = { id: rowId, label: 'relates_to', source, target, properties: {} }
      await createRowFromGraphEntity('edges', rowId, edge)
      const prev = useGraphStore.getState().graphDataRevision
      noteGraphWrite(prev + 1)
      useGraphStore.getState().addEdge(edge)
    })()
  }, [activeTableId, baseGraphData, noteGraphWrite])

  const handleDeleteSelected = useCallback(() => {
    void (async () => {
      if (selectedRowIds.length === 0) return
      const { collections } = await getGraphTableDb()
      for (const rowId of selectedRowIds) {
        const pk = `${activeTableId}:${rowId}`
        const doc = await collections.rows.findOne(pk).exec()
        if (doc) await doc.remove()
        const prev = useGraphStore.getState().graphDataRevision
        noteGraphWrite(prev + 1)
        if (activeTableId === 'nodes') useGraphStore.getState().removeNode(rowId)
        else useGraphStore.getState().removeEdge(rowId)
      }
      setSelectedRowIds([])
      setInspectorRowId(null)
    })()
  }, [activeTableId, noteGraphWrite, selectedRowIds])

  const rowCountLabel = useMemo(() => `${rows.length} rows`, [rows.length])
  const showInspector = inspectorOpen && !!selectedRow

  const resetColumnWidths = useCallback(() => {
    setColumnWidthsPxById({})
  }, [])

  const handleColumnWidthChanged = useCallback((columnId: string, widthPx: number) => {
    setColumnWidthsPxById(prev => ({ ...prev, [columnId]: widthPx }))
  }, [])

  const orderedColumns = useMemo(() => {
    return applyColumnOrder({ columns, orderIds: columnOrderByTableId[activeTableId] })
  }, [activeTableId, columnOrderByTableId, columns])

  const handleRequestReorderColumn = useCallback(
    (fromColumnId: string, toColumnId: string, side: 'left' | 'right') => {
      setColumnOrderByTableId(prev => {
        const current = prev[activeTableId] || []
        const base = applyColumnOrder({ columns, orderIds: current })
        const ids = base.map(c => c.columnId)
        const nextIds = reorderIds({ ids, fromId: fromColumnId, toId: toColumnId, side })
        if (nextIds.join('\n') === ids.join('\n')) return prev
        return { ...prev, [activeTableId]: nextIds }
      })
    },
    [activeTableId, columns],
  )

  useEffect(() => {
    const available = orderedColumns
    const first = available[0]?.columnId || 'id'
    const setOfIds = new Set(available.map(c => c.columnId))

    setGroupBy(prev => {
      if (!prev) return ''
      if (setOfIds.has(prev)) return prev
      return ''
    })

    setFilterClauses(prev => {
      const next = prev.filter(c => setOfIds.has(c.columnId))
      if (next.length === 0) return [{ id: makeGraphTableRuleId(), columnId: first, operator: 'contains', value: '' }]
      if (next.length === prev.length) return prev
      return next
    })

    setSortRules(prev => {
      const next = prev.filter(r => setOfIds.has(r.columnId))
      if (next.length === prev.length) return prev
      return next
    })
  }, [activeTableId, orderedColumns])

  const left = (
    <section
      className={`flex-1 min-h-0 overflow-hidden flex flex-col ${UI_THEME_TOKENS.text.primary}`}
      aria-label="Graph Data Table"
    >
      <WorkspaceHeader ariaLabel="Table header" border="divider">
        <WorkspaceHeaderRow ariaLabel="Table header row">
          <section className="min-w-0 flex items-center gap-3" aria-label="Table navigation">
            <h1 className="font-semibold">{UI_LABELS.graphDataTable}</h1>
            <nav className="flex items-center gap-2" aria-label="Dataset selector">
              <button
                type="button"
                className={`App-toolbar__btn ${panelTypography.microLabelClass} ${activeTableId === 'nodes' ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}`}
                onClick={() => setActiveTableId('nodes')}
              >
                Nodes
              </button>
              <button
                type="button"
                className={`App-toolbar__btn ${panelTypography.microLabelClass} ${activeTableId === 'edges' ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}`}
                onClick={() => setActiveTableId('edges')}
              >
                Edges
              </button>
            </nav>
            <output className={`${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.tertiary}`}>{rowCountLabel}</output>
          </section>

          <section className="flex-1 min-w-0 flex justify-center" aria-label="Table toolbar">
            <GraphTableToolbar
              panelTypography={panelTypography}
              columns={orderedColumns.map(c => ({ columnId: c.columnId, name: c.name }))}
              inspectorOpen={inspectorOpen}
              setInspectorOpen={setInspectorOpen}
              canvasPreviewAvailable={workspaceViewMode === 'table' && !!props.canvasPreview}
              canvasPreviewCollapsed={canvasPreviewCollapsed}
              setCanvasPreviewCollapsed={setCanvasPreviewCollapsed}
              columnVisibilityById={columnVisibilityById}
              setColumnVisibilityById={setColumnVisibilityById}
              filterMatch={filterMatch}
              setFilterMatch={setFilterMatch}
              filterClauses={filterClauses}
              setFilterClauses={setFilterClauses}
              groupBy={groupBy}
              setGroupBy={setGroupBy}
              sortRules={sortRules}
              setSortRules={setSortRules}
              rowHeightPreset={rowHeightPreset}
              setRowHeightPreset={setRowHeightPreset}
              columnWidthsPxById={columnWidthsPxById}
              resetColumnWidths={resetColumnWidths}
            />
          </section>

          <nav className="flex items-center gap-2" aria-label="Table actions">
            <button
              type="button"
              className={`App-toolbar__btn ${panelTypography.microLabelClass} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
              onClick={handleAddRow}
            >
              + Row
            </button>
            <button
              type="button"
              className={`App-toolbar__btn ${panelTypography.microLabelClass} ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
              onClick={handleDeleteSelected}
              disabled={selectedRowIds.length === 0}
            >
              Delete
            </button>
          </nav>
        </WorkspaceHeaderRow>
      </WorkspaceHeader>

      <section className="flex-1 min-h-0 overflow-hidden flex" aria-label="Table workspace">
        <section className="flex-1 min-w-0 min-h-0 overflow-hidden flex" aria-label="Table and inspector">
          <GraphTableFastGrid
            tableId={activeTableId}
            panelTypography={panelTypography}
            columns={columns}
            rows={rows}
            selectedRowIds={selectedRowIds}
            focusRowId={inspectorRowId}
            autoScrollToFocusRow={selectionSource !== 'table'}
            columnVisibilityById={columnVisibilityById}
            filterMatch={filterMatch}
            filterClauses={filterClauses}
            groupBy={groupBy}
            sortRules={sortRules}
            rowHeightPreset={rowHeightPreset}
            columnWidthsPxById={columnWidthsPxById}
            columnOrderIds={columnOrderByTableId[activeTableId]}
            onColumnWidthChanged={handleColumnWidthChanged}
            onRequestReorderColumn={handleRequestReorderColumn}
            onCellValueChanged={handleCellValueChanged}
            onRowClicked={rowId => {
              setInspectorRowId(rowId)
              setSelectedRowIds([rowId])
              try {
                const store = useGraphStore.getState()
                store.setSelectionSource('table')
                if (activeTableId === 'nodes') store.selectNode(rowId)
                else store.selectEdge(rowId)
              } catch {
                void 0
              }

              if (activeTableId === 'nodes') {
                const row = rows.find(r => r.id === rowId) || null
                const tocId = getRowTocId(row)
                if (tocId) {
                  try {
                    window.dispatchEvent(new CustomEvent('kg:tocFocus', { detail: { id: tocId } }))
                  } catch {
                    void 0
                  }
                }
              }
            }}
            onSelectionChanged={setSelectedRowIds}
          />
          {showInspector && (
            <>
              <VerticalResizeSeparatorHr
                ref={el => {
                  inspectorDragHandleRef.current = el
                }}
                ariaLabel="Resize inspector"
              />
              <GraphTableInspector
                widthPx={inspectorWidthPx}
                columns={columns}
                row={selectedRow}
                onClose={() => setInspectorRowId(null)}
                onChangeCell={(columnId, next) => {
                  if (!selectedRow) return
                  handleCellValueChanged(selectedRow.rowId, columnId, next)
                }}
                onDeleteRow={() => {
                  if (!selectedRow) return
                  setSelectedRowIds([selectedRow.rowId])
                  handleDeleteSelected()
                }}
              />
            </>
          )}
        </section>
      </section>
    </section>
  )

  if (workspaceViewMode !== 'table' || !props.canvasPreview) return left

  return (
    <EmbeddedWorkspaceShell
      left={left}
      leftAriaLabel="Table"
      preview={props.canvasPreview}
      previewCollapsed={canvasPreviewCollapsed}
      setPreviewCollapsed={setCanvasPreviewCollapsed}
      previewWidthPx={canvasPreviewWidthPx}
      setPreviewWidthPx={setCanvasPreviewWidthPx}
      panelTextClass={panelTypography.panelTextClass}
      previewResizeAriaLabel="Resize Canvas Preview"
      previewAriaLabel="Canvas Preview"
      previewFrameAriaLabel="Canvas Preview frame"
    />
  )
}
