import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphEdge, GraphNode, GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { getRendererPalette } from '@/lib/graph/schema'
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
import { HeaderCell } from './GraphDataTableHeader'
import { GraphDataTableRows } from './GraphDataTableRows'

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
  sortKey,
  sortDir,
  onRequestAddFilter,
  onRequestGroupBy,
  onRequestHideColumn,
  onRequestSortByColumn,
}: GraphDataTableProps) {
  const stepNoneLabelPx = useGraphStore(s => s.graphDataTableFrozenDragStepNoneLabelPx)
  const stepLabelIdPx = useGraphStore(s => s.graphDataTableFrozenDragStepLabelIdPx)
  const headerCellBaseClassName =
    'relative p-0 border-b border-gray-200 border-r border-gray-200 last:border-r-0'
  const headerHeightClassName = 'h-8'
  const bodyVerticalPaddingClassName = 'py-1'
  const bodyTextSizeClassName = 'text-xs'
  const bodyCellBaseClassName = `px-2 ${bodyVerticalPaddingClassName} ${bodyTextSizeClassName} align-top border-b border-gray-100 border-r border-gray-100 last:border-r-0`
  const textInputClassName =
    `h-7 text-xs w-full px-2 border border-gray-300 rounded-md bg-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500`
  const uiPanelMonospaceTextClass = useGraphStore(
    s => s.uiPanelMonospaceTextClass || 'font-mono text-xs',
  )
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-xs',
  )
  const monoTextInputClassName = `${textInputClassName} ${uiPanelMonospaceTextClass}`
  const textareaClassName =
    `w-full px-2 py-1 border border-gray-300 rounded-md bg-white leading-snug resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 ${uiPanelMonospaceTextClass}`
  const indexColumnWidthClassName = 'w-8'

  const enableVirtualTables = useGraphStore(s => s.enableVirtualTables)
  const graphDataTableVirtualOverscanRows = useGraphStore(s => s.graphDataTableVirtualOverscanRows)
  const graphDataTableOverscanMultiplier = useGraphStore(s => s.graphDataTableOverscanMultiplier)
  const graphDataTableVirtualMinRows = useGraphStore(s => s.graphDataTableVirtualMinRows)
  const graphDataTableVirtualDebugLogRanges = useGraphStore(s => s.graphDataTableVirtualDebugLogRanges)
  const selectionSource = useGraphStore(s => s.selectionSource)
  const selectionFlashDurationMs = useGraphStore(s => s.selectionFlashDurationMs || 500)
  const graphData = useGraphStore(s => s.graphData) as GraphData | null
  const schema = useGraphStore(s => s.schema) as GraphSchema | null
  const renderMediaAsNodes = useGraphStore(s => s.renderMediaAsNodes)
  const columnWidths = useGraphStore(s => s.graphDataTableColumnWidths)
  const setColumnWidth = useGraphStore(s => s.setGraphDataTableColumnWidth)
  const aggregateDefaultVizMode = useGraphStore(s => s.graphDataTableAggregateDefaultVizMode)

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

  const effectiveColumnCount = React.useMemo(
    () => orderedVisibleColumnKeys.length + 1,
    [orderedVisibleColumnKeys.length],
  )

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
    return color || '#9CA3AF'
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
    if (selectionSource === 'table') return

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
    <div
      ref={scrollContainerRef}
      className="relative h-full min-h-0 overflow-auto bg-white"
      onScroll={handleScroll}
    >
      {frozenAreaDragIndicatorLeft != null && (
        <div
          className={`pointer-events-none absolute top-0 bottom-0 border-r border-blue-400/80 transition-opacity duration-150 ${
            isFrozenAreaIndicatorVisible ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ left: frozenAreaDragIndicatorLeft }}
        />
      )}
      <table className="w-full border-separate border-spacing-0">
        <thead ref={headerRef} className="sticky top-0 z-30 bg-gray-100">
          <tr className="text-left">
            <th
              scope="col"
              className={`${headerCellBaseClassName} ${headerHeightClassName} group p-0 sticky left-0 top-0 z-40 ${indexColumnWidthClassName} bg-gray-100 text-xs font-normal text-gray-500 text-center`}
            >
              <div className="relative flex items-center justify-center h-8">
                <span className={`${uiPanelMonospaceTextClass} tabular-nums text-gray-500`}>#</span>
              </div>
            </th>
            {orderedVisibleColumnKeys.map(columnKey => (
              <HeaderCell
                key={columnKey}
                columnKey={columnKey}
                label={columnLabelByKey.get(columnKey) ?? columnKey}
                headerCellBaseClassName={headerCellBaseClassName}
                headerHeightClassName={headerHeightClassName}
                sortKey={sortKey}
                sortDir={sortDir}
                freezeFirstDataColumn={freezeFirstDataColumn}
                showFrozenResizeHandle={columnKey === frozenBoundaryColumnKey}
                onStartFrozenAreaDrag={handleFrozenAreaDragStart}
                width={columnWidths[columnKey]}
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
            columnLabelByKey={columnLabelByKey}
            propertyFieldSettingsByColumnKey={propertyFieldSettingsByColumnKey}
            rowDensity={rowDensity}
            isEmpty={isEmpty}
            bodyCellBaseClassName={bodyCellBaseClassName}
            indexColumnWidthClassName={indexColumnWidthClassName}
            textInputClassName={textInputClassName}
            monoTextInputClassName={monoTextInputClassName}
            textareaClassName={textareaClassName}
            uiPanelKeyValueTextSizeClass={uiPanelKeyValueTextSizeClass}
            uiPanelMonospaceTextClass={uiPanelMonospaceTextClass}
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
          />
        </tbody>
      </table>
    </div>
  )
})
