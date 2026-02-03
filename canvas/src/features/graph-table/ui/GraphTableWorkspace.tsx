import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Subscription } from 'rxjs'
import type { RxChangeEvent } from 'rxdb'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { hashString32 } from 'grph-shared/hash/stringHash'
import { LS_KEYS } from '@/lib/config'
import { lsBool, lsInt, lsJson, lsSetBool, lsSetInt, lsSetJson } from '@/lib/persistence'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import { VerticalResizeSeparatorHr } from '@/components/ui/VerticalResizeSeparatorHr'
import {
  allocateNewRowId,
  createRowFromGraphEntity,
  getGraphTableDb,
  syncGraphDataToGraphTableDb,
  updateGraphTableCell,
  type GraphColumnDoc,
  type GraphRowDoc,
  type GraphTableId,
} from '@/features/graph-table-db/graphTableDb'
import type { GraphTableGridRow } from '@/features/graph-table/ui/GraphTableGrid'
import { GraphTableInspector, type GraphTableInspectorRow } from '@/features/graph-table/ui/GraphTableInspector'
import { GraphTableToolbar } from '@/features/graph-table/ui/GraphTableToolbar'
import { GraphTableSemanticTable } from '@/features/graph-table/ui/GraphTableSemanticTable'
import {
  makeGraphTableRuleId,
  parseColumnVisibilityById,
  parseColumnWidthsPxById,
  parseFilterClauses,
  parseFilterMatch,
  parseRowHeightPreset,
  parseSortRules,
  type GraphTableColumnVisibilityById,
  type GraphTableColumnWidthsPxById,
  type GraphTableFilterClause,
  type GraphTableFilterMatch,
  type GraphTableRowHeightPreset,
  type GraphTableSortRule,
} from '@/features/graph-table/ui/graphTableViewState'

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

const applyCellUpdateToGraphStore = (
  tableId: GraphTableId,
  rowId: string,
  columnId: string,
  value: unknown,
): void => {
  const s = useGraphStore.getState()
  if (tableId === 'nodes') {
    if (columnId === 'label') {
      s.updateNode(rowId, { label: String(value ?? '') })
      return
    }
    if (columnId === 'type') {
      s.updateNode(rowId, { type: String(value ?? '') })
      return
    }
    if (columnId === 'id') return
    const key = columnId.startsWith('prop:') ? columnId.slice('prop:'.length) : columnId
    const current = s.graphData?.nodes.find(n => n.id === rowId)
    const properties = { ...(current?.properties || {}) }
    properties[key] = value as never
    s.updateNode(rowId, { properties })
    return
  }

  if (columnId === 'label') {
    s.updateEdge(rowId, { label: String(value ?? '') })
    return
  }
  if (columnId === 'source') {
    s.updateEdge(rowId, { source: String(value ?? '') })
    return
  }
  if (columnId === 'target') {
    s.updateEdge(rowId, { target: String(value ?? '') })
    return
  }
  if (columnId === 'id') return
  const key = columnId.startsWith('prop:') ? columnId.slice('prop:'.length) : columnId
  const current = s.graphData?.edges.find(e => e.id === rowId)
  const properties = { ...(current?.properties || {}) }
  properties[key] = value as never
  s.updateEdge(rowId, { properties })
}

export default function GraphTableWorkspace() {
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass || 'font-sans')
  const baseGraphData = useGraphStore(s => s.graphData)
  const renderGraphData = useActiveGraphRenderData()
  const graphDataRevision = useGraphStore(s => s.graphDataRevision)
  const selectionSource = useGraphStore(s => s.selectionSource)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const [activeTableId, setActiveTableId] = useState<GraphTableId>('nodes')
  const [columns, setColumns] = useState<GraphColumnDoc[]>([])
  const [rows, setRows] = useState<GraphTableGridRow[]>([])
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([])
  const [inspectorRowId, setInspectorRowId] = useState<string | null>(null)
  const [inspectorOpen, setInspectorOpen] = useState(() => lsBool(LS_KEYS.graphTableInspectorOpen, true))
  const [inspectorWidthPx, setInspectorWidthPx] = useState(() => lsInt(LS_KEYS.graphTableInspectorWidthPx, 360))
  const [tableCollapsed, setTableCollapsed] = useState(() => lsBool(LS_KEYS.graphTablePanelCollapsed, false))
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
  const inspectorWidthPxRef = useRef(inspectorWidthPx)
  inspectorWidthPxRef.current = inspectorWidthPx
  const inspectorDragHandleRef = useRef<HTMLHRElement | null>(null)
  const lastSyncedRevisionRef = useRef<number>(-1)
  const lastGraphWriteRevisionRef = useRef<number | null>(null)
  const rowCacheRef = useRef<{ hashById: Map<string, number>; rowById: Map<string, GraphTableGridRow> }>({
    hashById: new Map(),
    rowById: new Map(),
  })

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (lastGraphWriteRevisionRef.current === graphDataRevision) {
        lastGraphWriteRevisionRef.current = null
        return
      }
      if (lastSyncedRevisionRef.current === graphDataRevision) return
      await syncGraphDataToGraphTableDb(renderGraphData)
      if (cancelled) return
      lastSyncedRevisionRef.current = graphDataRevision
    })()
    return () => {
      cancelled = true
    }
  }, [graphDataRevision, renderGraphData])

  useEffect(() => {
    let sub: Subscription | null = null
    let rowSub: Subscription | null = null
    let colMap = new Map<string, GraphColumnDoc>()
    let cancelled = false

    void (async () => {
      const { collections } = await getGraphTableDb()
      const initialCols = await collections.columns.find({ selector: { tableId: activeTableId } }).sort({ order: 'asc' }).exec()
      if (cancelled) return
      colMap = new Map(initialCols.map(d => [d.get('pk'), d.toJSON() as GraphColumnDoc]))
      setColumns(Array.from(colMap.values()).sort((a, b) => a.order - b.order))

      const initialRows = await collections.rows.find({ selector: { tableId: activeTableId } }).sort({ order: 'asc' }).exec()
      if (cancelled) return
      const cache = rowCacheRef.current
      const nextRows: GraphTableGridRow[] = []
      for (const r of initialRows) {
        const json = r.toJSON() as GraphRowDoc
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
        const cache = rowCacheRef.current
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
    lsSetBool(LS_KEYS.graphTableInspectorOpen, inspectorOpen)
  }, [inspectorOpen])

  useEffect(() => {
    lsSetBool(LS_KEYS.graphTablePanelCollapsed, tableCollapsed)
  }, [tableCollapsed])

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
        await updateGraphTableCell(activeTableId, rowId, columnId, next)
        const prev = useGraphStore.getState().graphDataRevision
        lastGraphWriteRevisionRef.current = prev + 1
        applyCellUpdateToGraphStore(activeTableId, rowId, columnId, next)
      })()
    },
    [activeTableId],
  )

  const handleAddRow = useCallback(() => {
    void (async () => {
      const rowId = await allocateNewRowId(activeTableId)
      if (activeTableId === 'nodes') {
        const node: GraphNode = { id: rowId, label: rowId, type: 'Entity', properties: {} }
        await createRowFromGraphEntity('nodes', rowId, node)
        const prev = useGraphStore.getState().graphDataRevision
        lastGraphWriteRevisionRef.current = prev + 1
        useGraphStore.getState().addNode(node)
        return
      }
      const nodes = (baseGraphData?.nodes || []).map(n => n.id)
      const source = nodes[0] || ''
      const target = nodes[1] || source
      const edge: GraphEdge = { id: rowId, label: 'relates_to', source, target, properties: {} }
      await createRowFromGraphEntity('edges', rowId, edge)
      const prev = useGraphStore.getState().graphDataRevision
      lastGraphWriteRevisionRef.current = prev + 1
      useGraphStore.getState().addEdge(edge)
    })()
  }, [activeTableId, baseGraphData])

  const handleDeleteSelected = useCallback(() => {
    void (async () => {
      if (selectedRowIds.length === 0) return
      const { collections } = await getGraphTableDb()
      for (const rowId of selectedRowIds) {
        const pk = `${activeTableId}:${rowId}`
        const doc = await collections.rows.findOne(pk).exec()
        if (doc) await doc.remove()
        const prev = useGraphStore.getState().graphDataRevision
        lastGraphWriteRevisionRef.current = prev + 1
        if (activeTableId === 'nodes') useGraphStore.getState().removeNode(rowId)
        else useGraphStore.getState().removeEdge(rowId)
      }
      setSelectedRowIds([])
      setInspectorRowId(null)
    })()
  }, [activeTableId, selectedRowIds])

  const rowCountLabel = useMemo(() => `${rows.length} rows`, [rows.length])
  const showInspector = inspectorOpen && !!selectedRow

  const resetColumnWidths = useCallback(() => {
    setColumnWidthsPxById({})
  }, [])

  const handleColumnWidthChanged = useCallback((columnId: string, widthPx: number) => {
    setColumnWidthsPxById(prev => ({ ...prev, [columnId]: widthPx }))
  }, [])

  useEffect(() => {
    const available = columns.filter(c => !c.hidden).slice().sort((a, b) => a.order - b.order)
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
  }, [activeTableId, columns])

  return (
    <main
      className={`flex flex-col flex-1 min-h-0 overflow-hidden ${uiPanelTextFontClass} ${UI_THEME_TOKENS.text.primary}`}
      aria-label="Graph Data Table"
    >
      <header className={`h-12 shrink-0 border-b ${UI_THEME_TOKENS.panel.divider} ${UI_THEME_TOKENS.panel.bg}`} aria-label="Table header">
        <section className="h-full px-3 flex items-center justify-between gap-3">
          <section className="min-w-0 flex items-center gap-3" aria-label="Table navigation">
            <h1 className="text-sm font-semibold">Graph Data</h1>
            <nav className="flex items-center gap-2" aria-label="Dataset selector">
              <button
                type="button"
                className={`App-toolbar__btn text-xs ${activeTableId === 'nodes' ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}`}
                onClick={() => setActiveTableId('nodes')}
              >
                Nodes
              </button>
              <button
                type="button"
                className={`App-toolbar__btn text-xs ${activeTableId === 'edges' ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}` : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}`}
                onClick={() => setActiveTableId('edges')}
              >
                Edges
              </button>
            </nav>
            <output className={`text-xs ${UI_THEME_TOKENS.text.tertiary}`}>{rowCountLabel}</output>
          </section>

          <nav className="flex items-center gap-2" aria-label="Table actions">
            <button
              type="button"
              className={`App-toolbar__btn text-xs ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
              onClick={() => setInspectorOpen(v => !v)}
            >
              {showInspector ? 'Single' : 'Split'}
            </button>
            <button
              type="button"
              className={`App-toolbar__btn text-xs ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
              onClick={handleAddRow}
            >
              + Row
            </button>
            <button
              type="button"
              className={`App-toolbar__btn text-xs ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
              onClick={handleDeleteSelected}
              disabled={selectedRowIds.length === 0}
            >
              Delete
            </button>
          </nav>
        </section>
      </header>

      <header className={`shrink-0 border-b ${UI_THEME_TOKENS.panel.divider} ${UI_THEME_TOKENS.panel.bg}`} aria-label="Table toolbar header">
        <section className="px-3 py-2 flex items-center justify-between gap-3">
          <GraphTableToolbar
            columns={columns
              .filter(c => !c.hidden)
              .slice()
              .sort((a, b) => a.order - b.order)
              .map(c => ({ columnId: c.columnId, name: c.name }))}
            tableCollapsed={tableCollapsed}
            setTableCollapsed={setTableCollapsed}
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
      </header>

      <section className="flex-1 min-h-0 overflow-hidden flex" aria-label="Table body">
        {!tableCollapsed ? (
          <GraphTableSemanticTable
            tableId={activeTableId}
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
            onColumnWidthChanged={handleColumnWidthChanged}
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
        ) : (
          <section className="flex-1 min-h-0 overflow-hidden" aria-label="Collapsed table" />
        )}
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
    </main>
  )
}
