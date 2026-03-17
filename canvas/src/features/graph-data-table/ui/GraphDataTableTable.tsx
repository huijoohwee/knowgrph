import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphEdge, GraphNode, GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { getRendererPalette } from '@/lib/graph/schema'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import {
  type GraphDataTableColumnKey,
  type GraphDataTableAggregateVizMode,
  type GraphDataTableListItem,
  type GraphDataTableRowDensity,
  type UnifiedRow,
} from '@/features/graph-data-table/graphDataTable'
import type { GraphFieldSettingsResolved } from '@/features/graph-fields/graphFields'
import { computeNeighborIds, normalizeSelectionIds, type SelectionHighlightParams } from '@/components/GraphCanvas/highlight'
import { selectionPerfStart, selectionPerfEnd } from '@/lib/selectionPerf'
import {
  useGraphDataTableWindowing,
  type VisibleRowRange,
} from '@/features/graph-data-table/ui/GraphDataTableWindowing'
import { useGraphDataTableFrozenArea } from '@/features/graph-data-table/ui/useGraphDataTableFrozenArea'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_LABELS } from '@/lib/config'
import { HeaderCell } from './GraphDataTableHeader'
import { GraphDataTableRows } from './GraphDataTableRows'

function reorderColumnKeys(
  baseOrder: GraphDataTableColumnKey[],
  from: GraphDataTableColumnKey,
  to: GraphDataTableColumnKey,
  side: 'left' | 'right',
): GraphDataTableColumnKey[] {
  if (from === to) return baseOrder
  const fromIndex = baseOrder.indexOf(from)
  const toIndex = baseOrder.indexOf(to)
  if (fromIndex < 0 || toIndex < 0) return baseOrder

  const next = baseOrder.slice()
  const insertBase = toIndex + (side === 'right' ? 1 : 0)
  const insertIndex = fromIndex < insertBase ? insertBase - 1 : insertBase
  const [moved] = next.splice(fromIndex, 1)
  next.splice(insertIndex, 0, moved)
  return next
}

function normalizeColumnOrder(
  currentOrder: ReadonlyArray<GraphDataTableColumnKey>,
  orderedVisibleColumnKeys: ReadonlyArray<GraphDataTableColumnKey>,
): GraphDataTableColumnKey[] {
  const next: GraphDataTableColumnKey[] = []
  const seen = new Set<GraphDataTableColumnKey>()
  for (const key of currentOrder) {
    if (seen.has(key)) continue
    seen.add(key)
    next.push(key)
  }
  for (const key of orderedVisibleColumnKeys) {
    if (seen.has(key)) continue
    seen.add(key)
    next.push(key)
  }
  return next
}

function getDefaultColumnWidthPx(columnKey: GraphDataTableColumnKey): number {
  if (columnKey === 'kind') return 64
  if (columnKey === 'id') return 208
  if (columnKey === 'label') return 240
  if (columnKey === 'properties' || columnKey === 'metadata') return 360
  return 160
}

interface GraphDataTableProps {
  listItems: GraphDataTableListItem[]
  orderedVisibleColumnKeys: GraphDataTableColumnKey[]
  columnLabelByKey: Map<GraphDataTableColumnKey, string>
  propertyFieldSettingsByColumnKey: Map<GraphDataTableColumnKey, GraphFieldSettingsResolved>
  rowDensity: GraphDataTableRowDensity
  isEmpty: boolean
  disableAutoScroll: boolean
  freezeFirstDataColumn: 'none' | 'label' | 'id'
  setFreezeFirstDataColumn: (value: 'none' | 'label' | 'id') => void
  onVisibleRangeChange?: (range: VisibleRowRange) => void

  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedNodeIds: string[]
  selectedEdgeIds: string[]

  nodeById: Map<string, GraphNode>
  edgeById: Map<string, GraphEdge>
  updateNode: (id: string, patch: Partial<GraphNode>) => void
  updateEdge: (id: string, patch: Partial<GraphEdge>) => void
  onRowClick: (row: UnifiedRow) => void
  onRowDoubleClick: (row: UnifiedRow) => void

  sortKey: GraphDataTableColumnKey
  sortDir: 'asc' | 'desc'
  onRequestAddFilter: (key: GraphDataTableColumnKey) => void
  onRequestGroupBy: (key: GraphDataTableColumnKey | '') => void
  onRequestHideColumn: (key: GraphDataTableColumnKey) => void
  onRequestSortByColumn: (key: GraphDataTableColumnKey, dir: 'asc' | 'desc') => void
  onRowContextMenu?: (event: React.MouseEvent, row: UnifiedRow) => void
}

function createSelectionHighlightParams(
  graphData: GraphData | null,
  schema: GraphSchema | null,
  selectedNodeId: string | null,
  selectedEdgeId: string | null,
  selectedNodeIds: string[],
  selectedEdgeIds: string[],
  renderMediaAsNodes: boolean,
): SelectionHighlightParams | null {
  if (!graphData || !schema) return null
  return {
    data: graphData,
    schema,
    selectedNodeId,
    selectedEdgeId,
    selectedNodeIds,
    selectedEdgeIds,
    renderMediaAsNodes,
  }
}

function createSelectionSets(
  selectedNodeId: string | null,
  selectedEdgeId: string | null,
  selectedNodeIds: string[],
  selectedEdgeIds: string[],
) {
  const { selectionNodeIds, selectionEdgeIds } = normalizeSelectionIds({
    selectedNodeId,
    selectedEdgeId,
    selectedNodeIds,
    selectedEdgeIds,
  })
  return {
    selectedNodeIdSet: new Set<string>(selectionNodeIds.map(String)),
    selectedEdgeIdSet: new Set<string>(selectionEdgeIds.map(String)),
  }
}

export const GraphDataTable = React.memo(function GraphDataTable({
  listItems,
  orderedVisibleColumnKeys,
  columnLabelByKey,
  propertyFieldSettingsByColumnKey,
  rowDensity,
  isEmpty,
  disableAutoScroll,
  freezeFirstDataColumn,
  setFreezeFirstDataColumn,
  onVisibleRangeChange,
  selectedNodeId,
  selectedEdgeId,
  selectedNodeIds,
  selectedEdgeIds,
  nodeById,
  edgeById,
  updateNode,
  updateEdge,
  onRowClick,
  onRowDoubleClick,
  onRowContextMenu,
  sortKey,
  sortDir,
  onRequestAddFilter,
  onRequestGroupBy,
  onRequestHideColumn,
  onRequestSortByColumn,
}: GraphDataTableProps) {
  const panelTypography = usePanelTypography()
  const uiPanelMonospaceTextClass = panelTypography.monospaceTextClass
  const uiPanelKeyValueTextSizeClass = panelTypography.textSizeClass
  const stepNoneLabelPx = useGraphStore(s => s.graphDataTableFrozenDragStepNoneLabelPx)
  const stepLabelIdPx = useGraphStore(s => s.graphDataTableFrozenDragStepLabelIdPx)
  const headerCellBaseClassName =
    `relative p-0 border-b ${UI_THEME_TOKENS.table.cellBorder} border-r ${UI_THEME_TOKENS.table.cellBorder} last:border-r-0`
  const headerHeightClassName = 'h-8'
  const bodyVerticalPaddingClassName = 'py-1'
  const bodyCellBaseClassName = `px-2 ${bodyVerticalPaddingClassName} ${panelTypography.textSizeClass} align-top border-b ${UI_THEME_TOKENS.table.cellBorder} border-r ${UI_THEME_TOKENS.table.cellBorder} last:border-r-0`
  const textInputClassName =
    `h-7 w-full px-2 border ${UI_THEME_TOKENS.input.border} rounded-md ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.text} focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 ${panelTypography.fontClass} ${panelTypography.textSizeClass}`
  const monoTextInputClassName = `${textInputClassName} ${panelTypography.monospaceTextClass}`
  const indexColumnWidthClassName = 'w-8'

  const enableVirtualTables = useGraphStore(s => s.enableVirtualTables)
  const graphDataTableVirtualOverscanRows = useGraphStore(s => s.graphDataTableVirtualOverscanRows)
  const graphDataTableOverscanMultiplier = useGraphStore(s => s.graphDataTableOverscanMultiplier)
  const graphDataTableVirtualMinRows = useGraphStore(s => s.graphDataTableVirtualMinRows)
  const graphDataTableVirtualDebugLogRanges = useGraphStore(s => s.graphDataTableVirtualDebugLogRanges)
  const selectionSource = useGraphStore(s => s.selectionSource)
  const selectionFlashDurationMs = useGraphStore(s => s.selectionFlashDurationMs || 500)
  const graphData = useActiveGraphRenderData() as GraphData | null
  const schema = useGraphStore(s => s.schema) as GraphSchema | null
  const renderMediaAsNodes = useGraphStore(s => s.renderMediaAsNodes)
  const columnWidths = useGraphStore(s => s.graphDataTableColumnWidths)
  const setColumnWidth = useGraphStore(s => s.setGraphDataTableColumnWidth)
  const aggregateDefaultVizMode = useGraphStore(s => s.graphDataTableAggregateDefaultVizMode)
  const graphDataTableColumnOrder = useGraphStore(s => s.graphDataTableColumnOrder)
  const setGraphDataTableColumnOrder = useGraphStore(s => s.setGraphDataTableColumnOrder)

  const scrollContainerRef = React.useRef<HTMLDivElement>(null)
  const headerRef = React.useRef<HTMLTableSectionElement>(null)
  const columnResizeStateRef = React.useRef<{
    key: GraphDataTableColumnKey
    startX: number
    startWidth: number
  } | null>(null)
  const isColumnResizingRef = React.useRef(false)
  const [expandedCell, setExpandedCell] = React.useState<{
    rowId: string
    columnKey: GraphDataTableColumnKey
  } | null>(null)
  const [aggregateVizMode, setAggregateVizMode] = React.useState<GraphDataTableAggregateVizMode>(
    aggregateDefaultVizMode || 'radial',
  )

  const [reorderFromKey, setReorderFromKey] = React.useState<GraphDataTableColumnKey | null>(null)
  const [dropHint, setDropHint] = React.useState<{ key: GraphDataTableColumnKey; side: 'left' | 'right' } | null>(null)
  const [selectedColumnKey, setSelectedColumnKey] = React.useState<GraphDataTableColumnKey | null>(null)

  const reorderFromKeyRef = React.useRef<GraphDataTableColumnKey | null>(null)
  const dropHintRef = React.useRef<{ key: GraphDataTableColumnKey; side: 'left' | 'right' } | null>(null)

  React.useEffect(() => {
    reorderFromKeyRef.current = reorderFromKey
  }, [reorderFromKey])

  React.useEffect(() => {
    dropHintRef.current = dropHint
  }, [dropHint])

  const effectiveColumnCount = React.useMemo(
    () => orderedVisibleColumnKeys.length + 1,
    [orderedVisibleColumnKeys.length],
  )

  const resolvedColumnWidths = React.useMemo(() => {
    const next: Partial<Record<GraphDataTableColumnKey, number>> = {}
    for (const key of orderedVisibleColumnKeys) {
      const raw = columnWidths[key]
      const width = typeof raw === 'number' && Number.isFinite(raw) && raw > 0 ? raw : getDefaultColumnWidthPx(key)
      next[key] = width
    }
    return next
  }, [columnWidths, orderedVisibleColumnKeys])

  const handleHeaderReorderPointerDown = React.useCallback(
    (event: React.PointerEvent, key: GraphDataTableColumnKey) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return

      const startClientX = event.clientX
      const startClientY = event.clientY
      const pointerId = event.pointerId
      let didStartReorder = false

      const previousUserSelect = document.body.style.userSelect

      const computeDropHint = (clientX: number, clientY: number, fromKey: GraphDataTableColumnKey) => {
        const header = headerRef.current
        const container = scrollContainerRef.current
        if (!header || !container) return null

        const containerRect = container.getBoundingClientRect()
        const headerRect = header.getBoundingClientRect()
        const insideContainerY = clientY >= containerRect.top && clientY <= containerRect.bottom
        const nearHeaderY = clientY >= headerRect.top - 12 && clientY <= headerRect.bottom + 12
        if (!insideContainerY && !nearHeaderY) return null

        const ths = Array.from(header.querySelectorAll('th[data-kg-col-key]')) as HTMLElement[]
        if (ths.length === 0) return null

        const keyedRects: Array<{ key: GraphDataTableColumnKey; rect: DOMRect }> = []
        for (const th of ths) {
          const rawKey = th.getAttribute('data-kg-col-key')
          if (!rawKey) continue
          keyedRects.push({ key: rawKey as GraphDataTableColumnKey, rect: th.getBoundingClientRect() })
        }
        if (keyedRects.length === 0) return null

        let target = keyedRects.find(r => clientX >= r.rect.left && clientX <= r.rect.right)
        if (!target) {
          const first = keyedRects[0]
          const last = keyedRects[keyedRects.length - 1]
          if (clientX < first.rect.left) target = first
          else if (clientX > last.rect.right) target = last
          else {
            let best: { key: GraphDataTableColumnKey; rect: DOMRect } | null = null
            let bestDist = Number.POSITIVE_INFINITY
            for (const r of keyedRects) {
              const mid = (r.rect.left + r.rect.right) / 2
              const dist = Math.abs(clientX - mid)
              if (dist < bestDist) {
                bestDist = dist
                best = r
              }
            }
            if (best) target = best
          }
        }

        if (!target) return null
        if (target.key === fromKey) return null
        const mid = (target.rect.left + target.rect.right) / 2
        const side: 'left' | 'right' = clientX < mid ? 'left' : 'right'
        return { key: target.key, side }
      }

      const cleanup = () => {
        window.removeEventListener('pointermove', handlePointerMove as EventListener)
        window.removeEventListener('pointerup', handlePointerUp as EventListener)
        window.removeEventListener('pointercancel', handlePointerCancel as EventListener)
        window.removeEventListener('keydown', handleKeyDown)
        document.body.style.userSelect = previousUserSelect
      }

      const startReorder = () => {
        didStartReorder = true
        setReorderFromKey(key)
        setDropHint(null)
        document.body.style.userSelect = 'none'
        try {
          window.getSelection()?.removeAllRanges()
        } catch {
          void 0
        }
      }

      const handlePointerMove = (e: PointerEvent) => {
        if (e.pointerId !== pointerId) return
        const dx = e.clientX - startClientX
        const dy = e.clientY - startClientY
        if (!didStartReorder) {
          if (dx * dx + dy * dy < 25) return
          startReorder()
        }
        try {
          e.preventDefault()
          e.stopPropagation()
        } catch {
          void 0
        }
        const hint = computeDropHint(e.clientX, e.clientY, key)
        if (!hint) {
          setDropHint(prev => (prev ? null : prev))
          return
        }
        setDropHint(prev => {
          if (prev && prev.key === hint.key && prev.side === hint.side) return prev
          return hint
        })
      }

      const finish = (apply: boolean) => {
        const hint = dropHintRef.current
        setReorderFromKey(null)
        setDropHint(null)
        cleanup()
        if (!apply) return
        if (!didStartReorder) return
        if (!hint) return

        const toKey = hint.key
        const currentOrder = Array.isArray(graphDataTableColumnOrder) ? graphDataTableColumnOrder : []
        const base: GraphDataTableColumnKey[] = normalizeColumnOrder(
          currentOrder.length > 0 ? currentOrder : orderedVisibleColumnKeys,
          orderedVisibleColumnKeys,
        )
        if (!base.includes(key)) return
        if (!base.includes(toKey)) return
        const next = reorderColumnKeys(base, key, toKey, hint.side)
        setGraphDataTableColumnOrder(next)
      }

      const handlePointerUp = (e: PointerEvent) => {
        if (e.pointerId !== pointerId) return
        finish(true)
      }

      const handlePointerCancel = (e: PointerEvent) => {
        if (e.pointerId !== pointerId) return
        finish(false)
      }

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key !== 'Escape') return
        finish(false)
      }

      window.addEventListener('pointermove', handlePointerMove as EventListener, { passive: false })
      window.addEventListener('pointerup', handlePointerUp as EventListener)
      window.addEventListener('pointercancel', handlePointerCancel as EventListener)
      window.addEventListener('keydown', handleKeyDown)
    },
    [graphDataTableColumnOrder, orderedVisibleColumnKeys, setGraphDataTableColumnOrder],
  )

  const handleSelectColumn = React.useCallback((key: GraphDataTableColumnKey) => {
    setSelectedColumnKey(prev => (prev === key ? null : key))
  }, [])

  const {
    handleScroll,
    startIndex,
    endIndex,
    topSpacerHeight,
    bottomSpacerHeight,
    estimatedRowHeight,
    itemOffsets,
    dataRowIndexByItemIndex,
  } = useGraphDataTableWindowing({
    listItems,
    rowDensity,
    enableVirtualTables,
    virtualMinRows: graphDataTableVirtualMinRows,
    overscanRows: graphDataTableVirtualOverscanRows,
    overscanMultiplier: graphDataTableOverscanMultiplier,
    debugLogRanges: graphDataTableVirtualDebugLogRanges,
    onVisibleRangeChange,
    scrollContainerRef,
  })

  const selectionHighlightParams = React.useMemo<SelectionHighlightParams | null>(
    () =>
      createSelectionHighlightParams(
        graphData,
        schema,
        selectedNodeId,
        selectedEdgeId,
        selectedNodeIds,
        selectedEdgeIds,
        renderMediaAsNodes,
      ),
    [graphData, schema, selectedNodeId, selectedEdgeId, selectedNodeIds, selectedEdgeIds, renderMediaAsNodes],
  )

  const selectionSets = React.useMemo(
    () => createSelectionSets(selectedNodeId, selectedEdgeId, selectedNodeIds, selectedEdgeIds),
    [selectedEdgeId, selectedEdgeIds, selectedNodeId, selectedNodeIds],
  )

  const neighborIds = React.useMemo(
    () => computeNeighborIds(selectionHighlightParams || undefined),
    [selectionHighlightParams],
  )

  const nodeScopeBorderColor = React.useMemo(() => {
    if (!schema) {
      const palette = getRendererPalette(null)
      return palette.nodes.execution
    }
    const styles = schema.nodeStyles || {}
    const first = Object.values(styles)[0]
    const color = typeof first?.color === 'string' ? first.color.trim() : ''
    if (color) return color
    const palette = getRendererPalette(schema)
    return palette.nodes.execution
  }, [schema])

  const edgeScopeBorderColor = React.useMemo(() => {
    const styles = schema?.edgeStyles || {}
    const first = Object.values(styles)[0]
    const color = typeof first?.color === 'string' ? first.color.trim() : ''
    if (color) return color
    const palette = getRendererPalette(schema || null)
    return palette.edges.neutral
  }, [schema])

  const incidentEdgeIds = React.useMemo(() => {
    const ids = new Set<string>()
    if (!graphData || selectionSets.selectedNodeIdSet.size === 0) return ids
    for (let i = 0; i < graphData.edges.length; i += 1) {
      const e = graphData.edges[i]
      const src = String(e.source)
      const tgt = String(e.target)
      if (selectionSets.selectedNodeIdSet.has(src) || selectionSets.selectedNodeIdSet.has(tgt)) {
        ids.add(e.id)
      }
    }
    return ids
  }, [graphData, selectionSets.selectedNodeIdSet])

  const edgeEndpointNodeIds = React.useMemo(() => {
    const ids = new Set<string>()
    if (!graphData || selectionSets.selectedEdgeIdSet.size === 0) return ids
    for (const eid of selectionSets.selectedEdgeIdSet) {
      const edge = graphData.edges.find(e => e.id === eid)
      if (!edge) continue
      const src = String(edge.source)
      const tgt = String(edge.target)
      if (src) ids.add(src)
      if (tgt) ids.add(tgt)
    }
    return ids
  }, [graphData, selectionSets.selectedEdgeIdSet])

  const [flashSelectionId, setFlashSelectionId] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (selectionSource !== 'canvas') return
    const id = selectedNodeId || selectedEdgeId || null
    if (!id) {
      setFlashSelectionId(null)
      return
    }
    setFlashSelectionId(id)
    let timer: number | null = null
    try {
      timer = window.setTimeout(() => {
        setFlashSelectionId(current => (current === id ? null : current))
      }, selectionFlashDurationMs)
    } catch {
      timer = null
    }
    return () => {
      if (timer != null) {
        try {
          window.clearTimeout(timer)
        } catch {
          void 0
        }
      }
    }
  }, [selectionSource, selectedNodeId, selectedEdgeId, selectionFlashDurationMs])

  const groupSelectionById = React.useMemo(() => {
    const map = new Map<string, boolean>()
    let currentGroupId: string | null = null
    for (const item of listItems) {
      if (item.kind === 'group') {
        currentGroupId = item.id
        continue
      }
      if (item.kind === 'aggregate') {
        currentGroupId = item.groupId
        continue
      }
      if (item.kind === 'row' && currentGroupId) {
        const row = item.row
        if (row.kind === 'node' && selectionSets.selectedNodeIdSet.has(row.id)) {
          map.set(currentGroupId, true)
        }
        if (row.kind === 'edge' && selectionSets.selectedEdgeIdSet.has(row.id)) {
          map.set(currentGroupId, true)
        }
      }
    }
    return map
  }, [listItems, selectionSets.selectedEdgeIdSet, selectionSets.selectedNodeIdSet])

  const handleToggleExpandCell = React.useCallback(
    (columnKey: GraphDataTableColumnKey, rowId: string) => {
      setExpandedCell(prev =>
        prev && prev.rowId === rowId && prev.columnKey === columnKey ? null : { rowId, columnKey },
      )
    },
    [],
  )

  React.useEffect(() => {
    setExpandedCell(null)
  }, [rowDensity, listItems])


  const handleColumnResizeStart = React.useCallback(
    (payload: { columnKey: GraphDataTableColumnKey; clientX: number; width: number }) => {
      columnResizeStateRef.current = {
        key: payload.columnKey,
        startX: payload.clientX,
        startWidth: payload.width,
      }
      isColumnResizingRef.current = true
    },
    [],
  )

  React.useEffect(() => {
    const element = scrollContainerRef.current
    if (!element) return

    const handleWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) return
      const target = event.target as HTMLElement | null
      if (target && target.closest('textarea')) return
      if (Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return
      if (event.deltaY === 0) return

      event.preventDefault()
      try {
        event.stopPropagation()
      } catch {
        void 0
      }
      element.scrollBy({
        top: event.deltaY,
        behavior: 'auto',
      })
    }

    element.addEventListener('wheel', handleWheel, { passive: false })
    return () => element.removeEventListener('wheel', handleWheel)
  }, [])

  React.useEffect(() => {
    const container = scrollContainerRef.current
    const header = headerRef.current
    if (!container || !header) return

    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        if (entry.target === header) {
          container.style.setProperty('--header-height', `${entry.contentRect.height}px`)
        }
      }
    })
    observer.observe(header)
    return () => observer.disconnect()
  }, [])

  React.useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!isColumnResizingRef.current) return
      const state = columnResizeStateRef.current
      if (!state) return
      const deltaX = event.clientX - state.startX
      const nextWidth = state.startWidth + deltaX
      if (!Number.isFinite(nextWidth) || nextWidth <= 0) return
      setColumnWidth(state.key, nextWidth)
    }

    const handleMouseUp = () => {
      if (!isColumnResizingRef.current) return
      isColumnResizingRef.current = false
      columnResizeStateRef.current = null
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [setColumnWidth])

  React.useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return
    if (disableAutoScroll) return

    const selectedItemIndex = listItems.findIndex(item => {
      if (item.kind !== 'row') return false
      const row = item.row
      return (
        (row.kind === 'node' && row.id === selectedNodeId) ||
        (row.kind === 'edge' && row.id === selectedEdgeId)
      )
    })

    if (selectedItemIndex === -1) return

    const targetOffset = itemOffsets[selectedItemIndex]
    if (targetOffset == null) return

    const t0 = selectionPerfStart()
    const raf = requestAnimationFrame(() => {
      const headerHeight = headerRef.current?.getBoundingClientRect().height ?? 0
      const viewportHeight = container.clientHeight
      const availableHeight = Math.max(0, viewportHeight - headerHeight)
      const rowHeight = estimatedRowHeight

      const currentScrollTop = container.scrollTop
      const currentTop = targetOffset - currentScrollTop
      const currentBottom = currentTop + rowHeight

      if (currentTop >= 0 && currentBottom <= availableHeight) return

      if (selectionSource === 'canvas') {
        const targetTop = Math.max(0, targetOffset - headerHeight)
        container.scrollTo({ top: targetTop, behavior: 'auto' })
        selectionPerfEnd('graphDataTable', t0)
        return
      }

      const desiredTopWithinAvailable = (availableHeight - rowHeight) / 2
      const targetTop = Math.max(0, targetOffset - desiredTopWithinAvailable)

      container.scrollTo({ top: targetTop, behavior: 'auto' })
      selectionPerfEnd('graphDataTable', t0)
    })

    return () => cancelAnimationFrame(raf)
  }, [disableAutoScroll, estimatedRowHeight, itemOffsets, listItems, selectedEdgeId, selectedNodeId, selectionSource])

  const {
    frozenBoundaryColumnKey,
    frozenAreaDragIndicatorLeft,
    isFrozenAreaIndicatorVisible,
    handleFrozenAreaDragStart,
  } = useGraphDataTableFrozenArea({
    freezeFirstDataColumn,
    setFreezeFirstDataColumn,
    orderedVisibleColumnKeys,
    scrollContainerRef,
    stepNoneLabelPx,
    stepLabelIdPx,
  })

  return (
    <section className="relative w-full h-full overflow-hidden select-text" aria-label={UI_LABELS.dataTableAriaLabel}>
      <section
        ref={scrollContainerRef}
        data-kg-canvas-wheel-ignore="true"
        className={`w-full h-full overflow-auto ${UI_THEME_TOKENS.panel.bg} scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-transparent`}
        onScroll={handleScroll}
      >
      {frozenAreaDragIndicatorLeft != null && (
        <span
          className={`pointer-events-none absolute top-0 bottom-0 border-r border-blue-400/80 transition-opacity duration-150 ${
            isFrozenAreaIndicatorVisible ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ left: frozenAreaDragIndicatorLeft }}
        />
      )}
      <table className={`min-w-full w-max table-fixed border-separate border-spacing-0 ${UI_THEME_TOKENS.table.rowBg}`}>
        <colgroup>
          <col style={{ width: 32 }} />
          {orderedVisibleColumnKeys.map(columnKey => (
            <col key={columnKey} style={{ width: resolvedColumnWidths[columnKey] }} />
          ))}
        </colgroup>
        <thead ref={headerRef} className={`z-30 ${UI_THEME_TOKENS.table.headerBg}`}>
          <tr className="text-left">
            <th
              scope="col"
              className={`${headerCellBaseClassName} ${headerHeightClassName} group p-0 sticky left-0 top-0 z-40 ${indexColumnWidthClassName} ${UI_THEME_TOKENS.table.headerBg} ${panelTypography.microLabelClass} ${UI_THEME_TOKENS.table.textSecondary} text-center`}
            >
              <span className="relative flex items-center justify-center h-8">
                <span className={`${uiPanelMonospaceTextClass} tabular-nums ${UI_THEME_TOKENS.table.textSecondary}`}>#</span>
              </span>
            </th>
            {orderedVisibleColumnKeys.map(columnKey => (
              <HeaderCell
                key={columnKey}
                columnKey={columnKey}
                label={columnLabelByKey.get(columnKey) ?? columnKey}
                panelTypography={panelTypography}
                headerCellBaseClassName={headerCellBaseClassName}
                headerHeightClassName={headerHeightClassName}
                sortKey={sortKey}
                sortDir={sortDir}
                freezeFirstDataColumn={freezeFirstDataColumn}
                isReordering={reorderFromKey === columnKey}
                dropHint={dropHint?.key === columnKey ? dropHint.side : null}
                onReorderPointerDown={handleHeaderReorderPointerDown}
                isColumnSelected={selectedColumnKey === columnKey}
                onSelectColumn={handleSelectColumn}
                showFrozenResizeHandle={columnKey === frozenBoundaryColumnKey}
                onStartFrozenAreaDrag={handleFrozenAreaDragStart}
                width={resolvedColumnWidths[columnKey]}
                onStartColumnResize={handleColumnResizeStart}
                onRequestAddFilter={onRequestAddFilter}
                onRequestGroupBy={onRequestGroupBy}
                onRequestHideColumn={onRequestHideColumn}
                onRequestSortByColumn={onRequestSortByColumn}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          <GraphDataTableRows
            listItems={listItems}
            startIndex={startIndex}
            endIndex={endIndex}
            topSpacerHeight={topSpacerHeight}
            bottomSpacerHeight={bottomSpacerHeight}
            effectiveColumnCount={effectiveColumnCount}
            orderedVisibleColumnKeys={orderedVisibleColumnKeys}
            columnWidths={resolvedColumnWidths}
            selectedColumnKey={selectedColumnKey}
            columnLabelByKey={columnLabelByKey}
            propertyFieldSettingsByColumnKey={propertyFieldSettingsByColumnKey}
            rowDensity={rowDensity}
            isEmpty={isEmpty}
            bodyCellBaseClassName={bodyCellBaseClassName}
            indexColumnWidthClassName={indexColumnWidthClassName}
            textInputClassName={textInputClassName}
            monoTextInputClassName={monoTextInputClassName}
            uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
            uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
            panelTypography={panelTypography}
            flashSelectionId={flashSelectionId}
            aggregateVizMode={aggregateVizMode}
            setAggregateVizMode={setAggregateVizMode}
            groupSelectionById={groupSelectionById}
            selectionSets={selectionSets}
            neighborIds={neighborIds}
            incidentEdgeIds={incidentEdgeIds}
            edgeEndpointNodeIds={edgeEndpointNodeIds}
            nodeById={nodeById}
            edgeById={edgeById}
            dataRowIndexByItemIndex={dataRowIndexByItemIndex}
            nodeScopeBorderColor={nodeScopeBorderColor}
            edgeScopeBorderColor={edgeScopeBorderColor}
            frozenBoundaryColumnKey={frozenBoundaryColumnKey}
            freezeFirstDataColumn={freezeFirstDataColumn}
            onStartFrozenAreaDrag={handleFrozenAreaDragStart}
            expandedCellRowId={expandedCell?.rowId ?? null}
            expandedCellColumnKey={expandedCell?.columnKey ?? null}
            onToggleExpandCell={handleToggleExpandCell}
            updateNode={updateNode}
            updateEdge={updateEdge}
            onRowClick={onRowClick}
            onRowDoubleClick={onRowDoubleClick}
            onRowContextMenu={onRowContextMenu}
          />
        </tbody>
      </table>
      </section>
    </section>
  )
})
