import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { Subscription } from 'rxjs'
import type { RxChangeEvent } from 'rxdb'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useShallow } from 'zustand/react/shallow'
import { deriveGraphDataWithGroupCollapse } from '@/components/GraphCanvas/viewDerivation'
import type { GraphEdge, GraphNode } from '@/lib/graph/types'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { hashString32 } from 'grph-shared/hash/stringHash'
import { LS_KEYS } from '@/lib/config'
import { lsBool, lsInt, lsJson, lsSetBool, lsSetInt, lsSetJson } from '@/lib/persistence'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import {
  allocateNewRowId,
  createRowFromGraphEntity,
  getGraphTableDb,
  syncGraphDataToGraphTableDb,
  updateGraphTableCell,
  updateGraphTableColumnKind,
  type GraphColumnDoc,
  type GraphRowDoc,
  type GraphTableId,
} from '@/features/graph-table-db/graphTableDb'
import type { GraphTableGridRow } from '@/features/graph-table/ui/graphTableTypes'
import { GraphTableInspector, type GraphTableInspectorRow } from '@/features/graph-table/ui/GraphTableInspector'
import { GraphTableWorkspaceLeft } from '@/features/graph-table/ui/GraphTableWorkspaceLeft'
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
  type GraphTableFilterOperator,
  type GraphTableSortDirection,
} from '@/features/graph-table/ui/graphTableViewState'
import { applyCellUpdateToGraphStore } from '@/features/graph-table/lib/applyCellUpdateToGraphStore'
import { useGraphTableDbSync } from '@/features/graph-table/hooks/useGraphTableDbSync'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { buildCollapsedGroupIdsKey } from '@/lib/canvas/collapsedGroupIdsKey'
import { parseGraphTableViewMode, type GraphTableViewMode } from '@/features/graph-table/ui/graphTableViewMode'
import { applyColumnOrder, getRowTocId, mapRowDocToGridRow, reorderIds } from '@/features/graph-table/ui/graphTableWorkspaceUtils'
import { workspaceTablePreferencesStore } from '@/features/workspace-table/workspaceTablePreferencesStore'
import { scheduleWorkspaceSyncTask, cancelWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'

const INACTIVE_GRAPH_SLICE = {
  baseGraphData: null,
  collapsedGroupIds: [] as string[],
  graphDataRevision: 0,
  graphContentRevision: 0,
  infiniteCanvasInteractionMode: 'static' as const,
  canvasWorkspaceSyncMode: 'manual' as const,
  selectionSource: 'toolbar',
  selectedNodeId: null as string | null,
  selectedEdgeId: null as string | null,
  openQuickEditorNodeIds: [] as string[],
} as const

export default function GraphTableWorkspace(props: { canvasPreview?: ReactNode; active?: boolean }) {
  const panelTypography = usePanelTypography()
  const active = props.active !== false
  const selector = useMemo(
    () =>
      active
        ? (s: ReturnType<typeof useGraphStore.getState>) => ({
            baseGraphData: s.graphData,
            collapsedGroupIds: (s.collapsedGroupIds || []) as string[],
            graphDataRevision: s.graphDataRevision,
            graphContentRevision: s.graphContentRevision,
            infiniteCanvasInteractionMode: s.infiniteCanvasInteractionMode,
            canvasWorkspaceSyncMode: s.canvasWorkspaceSyncMode,
            selectionSource: s.selectionSource,
            selectedNodeId: s.selectedNodeId,
            selectedEdgeId: s.selectedEdgeId,
            openQuickEditorNodeIds: s.openQuickEditorNodeIds || [],
          })
        : () => INACTIVE_GRAPH_SLICE,
    [active],
  )
  const {
    baseGraphData,
    collapsedGroupIds,
    graphDataRevision,
    graphContentRevision,
    infiniteCanvasInteractionMode,
    canvasWorkspaceSyncMode,
    selectionSource,
    selectedNodeId,
    selectedEdgeId,
    openQuickEditorNodeIds,
  } =
    useGraphStore(useShallow(selector))
  const setEditorWorkspacePane = useGraphStore(s => s.setEditorWorkspacePane)
  const multiDimTableModeEnabled = useGraphStore(s => s.multiDimTableModeEnabled === true)
  const setMultiDimTableModeEnabled = useGraphStore(s => s.setMultiDimTableModeEnabled)
  const [activeTableId, setActiveTableId] = useState<GraphTableId>('nodes')
  const [viewMode, setViewMode] = useState<GraphTableViewMode>(() => {
    const mode = workspaceTablePreferencesStore.getSnapshot().workspaceEditorMode
    if (mode === 'kanban') return 'kanban'
    return lsJson(LS_KEYS.graphTableViewMode, 'table' as const, parseGraphTableViewMode)
  })
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
    return buildCollapsedGroupIdsKey(collapsedGroupIds)
  }, [collapsedGroupIds])

  const syncGraphData = useMemo(() => {
    if (!baseGraphData) return null
    if (!collapsedGroupIdsKey) return baseGraphData
    return deriveGraphDataWithGroupCollapse({ graphData: baseGraphData, collapsedGroupIds: collapsedGroupIdsKey.split('|').filter(Boolean) })
  }, [baseGraphData, collapsedGroupIdsKey])

  const handleCloseWorkspace = useCallback(() => {
    setEditorWorkspacePane('markdown')
  }, [setEditorWorkspacePane])

  const graphSyncRevision = infiniteCanvasInteractionMode === 'interactive' ? graphDataRevision : graphContentRevision
  const syncEnabled = active && canvasWorkspaceSyncMode === 'realtime'
  const { noteGraphWrite } = useGraphTableDbSync(graphSyncRevision, syncGraphData, `baseline:${collapsedGroupIdsKey}`, syncEnabled)

  const [syncNowInFlight, setSyncNowInFlight] = useState(false)
  const handleSyncNow = useCallback(() => {
    if (syncNowInFlight) return
    setSyncNowInFlight(true)
    void (async () => {
      try {
        await syncGraphDataToGraphTableDb(syncGraphData || null)
      } catch {
        void 0
      } finally {
        setSyncNowInFlight(false)
      }
    })()
  }, [syncGraphData, syncNowInFlight])

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
    if (!active) return
    let sub: Subscription | null = null
    let rowSub: Subscription | null = null
    let colMap = new Map<string, GraphColumnDoc>()
    let cancelled = false
    let rowsRafId: number | null = null

    const cacheForTable = (() => {
      const existing = rowCacheRef.current.get(activeTableId)
      if (existing) return existing
      const next = { hashById: new Map<string, number>(), rowById: new Map<string, GraphTableGridRow>() }
      rowCacheRef.current.set(activeTableId, next)
      return next
    })()

    const flushRows = () => {
      rowsRafId = null
      const cache = cacheForTable
      const ordered = Array.from(cache.rowById.values())
        .filter(r => typeof r.id === 'string' && r.id)
        .slice()
        .sort((a, b) => (a.__order ?? 0) - (b.__order ?? 0))
      setRows(ordered)
    }

    const scheduleRowsFlush = () => {
      if (rowsRafId !== null) return
      if (typeof window === 'undefined') {
        flushRows()
        return
      }
      rowsRafId = window.requestAnimationFrame(() => {
        if (cancelled) return
        flushRows()
      })
    }

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
        scheduleRowsFlush()
      })
    })()

    return () => {
      cancelled = true
      if (rowsRafId !== null && typeof window !== 'undefined') {
        try { window.cancelAnimationFrame(rowsRafId) } catch { void 0 }
        rowsRafId = null
      }
      try { sub?.unsubscribe() } catch { void 0 }
      try { rowSub?.unsubscribe() } catch { void 0 }
    }
  }, [active, activeTableId])

  useEffect(() => {
    if (selectionSource === 'toolbar') return
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

  const workspaceEditorMode = useSyncExternalStore(
    workspaceTablePreferencesStore.subscribe,
    () => workspaceTablePreferencesStore.getSnapshot().workspaceEditorMode,
    () => workspaceTablePreferencesStore.getServerSnapshot().workspaceEditorMode,
  )

  useEffect(() => {
    const next = workspaceEditorMode === 'kanban' ? 'kanban' : 'table'
    setViewMode(prev => (prev === next ? prev : next))
    const shouldEnableMultiDim = workspaceEditorMode === 'multiDimTable'
    if (multiDimTableModeEnabled !== shouldEnableMultiDim) {
      setMultiDimTableModeEnabled(shouldEnableMultiDim)
    }
  }, [multiDimTableModeEnabled, setMultiDimTableModeEnabled, workspaceEditorMode])

  const persistGraphTableViewStatePendingRef = useRef<{
    columnVisibilityById: GraphTableColumnVisibilityById
    filterMatch: GraphTableFilterMatch
    filterClauses: GraphTableFilterClause[]
    groupBy: string
    sortRules: GraphTableSortRule[]
    rowHeightPreset: GraphTableRowHeightPreset
    columnWidthsPxById: GraphTableColumnWidthsPxById
    columnOrderByTableId: GraphTableColumnOrderByTableId
  } | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    persistGraphTableViewStatePendingRef.current = {
      columnVisibilityById,
      filterMatch,
      filterClauses,
      groupBy,
      sortRules,
      rowHeightPreset,
      columnWidthsPxById,
      columnOrderByTableId,
    }
    scheduleWorkspaceSyncTask('graph-table:view-state', () => {
      const pending = persistGraphTableViewStatePendingRef.current
      if (!pending) return
      lsSetJson(LS_KEYS.graphTableColumnVisibilityById, pending.columnVisibilityById)
      lsSetJson(LS_KEYS.graphTableFilterMatch, pending.filterMatch)
      lsSetJson(LS_KEYS.graphTableFilters, pending.filterClauses)
      lsSetJson(LS_KEYS.graphTableGroupBy, pending.groupBy)
      lsSetJson(LS_KEYS.graphTableSortRules, pending.sortRules)
      lsSetJson(LS_KEYS.graphTableRowHeightPreset, pending.rowHeightPreset)
      lsSetJson(LS_KEYS.graphTableColumnWidthsPx, pending.columnWidthsPxById)
      lsSetJson(LS_KEYS.graphTableColumnOrderByTableId, pending.columnOrderByTableId)
    }, 200)
  }, [columnOrderByTableId, columnVisibilityById, columnWidthsPxById, filterClauses, filterMatch, groupBy, rowHeightPreset, sortRules])

  useEffect(() => {
    if (typeof window === 'undefined') return
    return () => {
      cancelWorkspaceSyncTask('graph-table:view-state')
    }
  }, [])

  const handleViewModeChanged = useCallback(
    (next: GraphTableViewMode) => {
      setViewMode(next)
      if (next === 'kanban') {
        workspaceTablePreferencesStore.setWorkspaceEditorMode('kanban')
        if (multiDimTableModeEnabled) setMultiDimTableModeEnabled(false)
        return
      }
      workspaceTablePreferencesStore.setWorkspaceEditorMode('table')
      if (multiDimTableModeEnabled) setMultiDimTableModeEnabled(false)
    },
    [multiDimTableModeEnabled, setMultiDimTableModeEnabled],
  )

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
        const st = useGraphStore.getState()
        const prev = infiniteCanvasInteractionMode === 'interactive' ? st.graphDataRevision : st.graphContentRevision
        noteGraphWrite(prev + 1)
        applyCellUpdateToGraphStore(activeTableId, rowId, columnId, next)
      })()
    },
    [activeTableId, infiniteCanvasInteractionMode, noteGraphWrite, rows],
  )

  const handleColumnKindChanged = useCallback(
    (columnId: string, nextKind: GraphColumnDoc['kind']) => {
      void updateGraphTableColumnKind(activeTableId, columnId, nextKind)
    },
    [activeTableId],
  )

  const handleAddRow = useCallback(() => {
    void (async () => {
      const rowId = await allocateNewRowId(activeTableId)
      if (activeTableId === 'nodes') {
        const node: GraphNode = { id: rowId, label: rowId, type: 'Entity', properties: {} }
        await createRowFromGraphEntity('nodes', rowId, node)
        const st = useGraphStore.getState()
        const prev = infiniteCanvasInteractionMode === 'interactive' ? st.graphDataRevision : st.graphContentRevision
        noteGraphWrite(prev + 1)
        useGraphStore.getState().addNode(node)
        return
      }
      const nodes = (baseGraphData?.nodes || []).map(n => n.id)
      const source = nodes[0] || ''
      const target = nodes[1] || source
      const edge: GraphEdge = { id: rowId, label: 'relates_to', source, target, properties: {} }
      await createRowFromGraphEntity('edges', rowId, edge)
      const st = useGraphStore.getState()
      const prev = infiniteCanvasInteractionMode === 'interactive' ? st.graphDataRevision : st.graphContentRevision
      noteGraphWrite(prev + 1)
      useGraphStore.getState().addEdge(edge)
    })()
  }, [activeTableId, baseGraphData, infiniteCanvasInteractionMode, noteGraphWrite])

  const handleDeleteSelected = useCallback(() => {
    void (async () => {
      if (selectedRowIds.length === 0) return
      const { collections } = await getGraphTableDb()
      for (const rowId of selectedRowIds) {
        const pk = `${activeTableId}:${rowId}`
        const doc = await collections.rows.findOne(pk).exec()
        if (doc) await doc.remove()
        const st = useGraphStore.getState()
        const prev = infiniteCanvasInteractionMode === 'interactive' ? st.graphDataRevision : st.graphContentRevision
        noteGraphWrite(prev + 1)
        if (activeTableId === 'nodes') useGraphStore.getState().removeNode(rowId)
        else useGraphStore.getState().removeEdge(rowId)
      }
      setSelectedRowIds([])
      setInspectorRowId(null)
    })()
  }, [activeTableId, infiniteCanvasInteractionMode, noteGraphWrite, selectedRowIds])

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

  const handleActivateRow = useCallback(
    (rowId: string) => {
      setInspectorRowId(rowId)
      setSelectedRowIds([rowId])
      try {
        const store = useGraphStore.getState()
        store.setSelectionSource('toolbar')
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
    },
    [activeTableId, rows],
  )

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

  const handleHideColumnInView = useCallback((columnId: string) => {
    setColumnVisibilityById(prev => {
      if (prev[columnId] === false) return prev
      return { ...prev, [columnId]: false }
    })
  }, [])

  const handleUpsertColumnFilter = useCallback((args: { columnId: string; operator: GraphTableFilterOperator; value: string }) => {
    setFilterClauses(prev => {
      const idx = prev.findIndex(c => c.columnId === args.columnId)
      if (idx >= 0) {
        const existing = prev[idx]
        const next = { ...existing, operator: args.operator, value: args.value }
        const out = prev.slice()
        out[idx] = next
        return out
      }
      return [...prev, { id: makeGraphTableRuleId(), columnId: args.columnId, operator: args.operator, value: args.value }]
    })
  }, [])

  const handleSetSingleColumnSort = useCallback((args: { columnId: string; direction: GraphTableSortDirection }) => {
    setSortRules([{ id: makeGraphTableRuleId(), columnId: args.columnId, direction: args.direction }])
  }, [])

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
    <GraphTableWorkspaceLeft
      panelTypography={panelTypography}
      activeTableId={activeTableId}
      setActiveTableId={setActiveTableId}
      viewMode={viewMode}
      setViewMode={handleViewModeChanged}
      rowCountLabel={rowCountLabel}
      orderedColumns={orderedColumns.map(c => ({ columnId: c.columnId, name: c.name }))}
      inspectorOpen={inspectorOpen}
      setInspectorOpen={setInspectorOpen}
      canvasPreviewAvailable={!!props.canvasPreview}
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
      onAddRow={handleAddRow}
      onDeleteSelected={handleDeleteSelected}
      hasSelection={selectedRowIds.length > 0}
      syncNowVisible={canvasWorkspaceSyncMode === 'manual'}
      syncNowDisabled={syncNowInFlight || !syncGraphData}
      onSyncNow={handleSyncNow}
      onClose={handleCloseWorkspace}
      columns={columns}
      rows={rows}
      selectedRowIds={selectedRowIds}
      inspectorRowId={inspectorRowId}
      selectionSource={selectionSource}
      setSelectedRowIds={setSelectedRowIds}
      setInspectorRowId={setInspectorRowId}
      showInspector={showInspector}
      inspectorWidthPx={inspectorWidthPx}
      inspectorDragHandleRef={inspectorDragHandleRef}
      selectedRow={selectedRow}
      onColumnWidthChanged={handleColumnWidthChanged}
      onRequestReorderColumn={handleRequestReorderColumn}
      onCellValueChanged={handleCellValueChanged}
      onColumnKindChanged={handleColumnKindChanged}
      onHideColumnInView={handleHideColumnInView}
      onUpsertColumnFilter={handleUpsertColumnFilter}
      onSetSingleColumnSort={handleSetSingleColumnSort}
      onRowClicked={handleActivateRow}
      columnOrderIds={columnOrderByTableId[activeTableId]}
    />
  )

  if (!props.canvasPreview) return left

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
