import React from 'react'
import type { GraphData, GraphNode, GraphEdge, SelectionAnchorIds } from '@/lib/graph/types'
import {
  applyGraphDataTableFilters,
  filterRows,
  getRowFieldText,
  type GraphDataTableFilterClause,
  type GraphDataTableFilterMatch,
  type GraphDataTableSortRule,
  type UnifiedRow,
} from '@/features/graph-data-table/graphDataTable'
import {
  type GraphDataTableScope,
} from '../BottomPanelCuratorModels'
import { buildSelectionSubgraphForAnchorIds } from '@/lib/graph/file'
import { normalizeSelectionIds } from '@/components/GraphCanvas/highlight'
import type { TraversalSummary } from '@/features/panels/utils/orchestratorTraversal'

interface UseBottomPanelCuratorVisibleRowsParams {
  nodes: GraphNode[]
  edges: GraphEdge[]
  query: string
  graphDataTableScope: GraphDataTableScope
  graphDataTableFilterMatch: GraphDataTableFilterMatch
  graphDataTableFilterClauses: ReadonlyArray<GraphDataTableFilterClause>
  graphDataTableViewMode: 'allRows' | 'selectionNeighborhood' | 'traversalSequence'
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
  isGraphDataTableAutoSortEnabled: boolean
  graphDataTableSortRules: ReadonlyArray<GraphDataTableSortRule>
  lastTraversalSummary: TraversalSummary | null
}

function applySelectionNeighborhoodFilter(
  filteredRows: UnifiedRow[],
  graphDataTableViewMode: 'allRows' | 'selectionNeighborhood' | 'traversalSequence',
  nodes: GraphNode[],
  edges: GraphEdge[],
  selectedNodeId: string | null,
  selectedEdgeId: string | null,
  selectedNodeIds: string[],
  selectedEdgeIds: string[],
): UnifiedRow[] {
  if (graphDataTableViewMode !== 'selectionNeighborhood') return filteredRows
  if (!selectedNodeId && !selectedEdgeId && selectedNodeIds.length === 0 && selectedEdgeIds.length === 0) {
    return filteredRows
  }

  const data: GraphData = { type: 'Graph', nodes, edges }

  const selectionAnchorIds: SelectionAnchorIds = normalizeSelectionIds({
    selectedNodeId,
    selectedEdgeId,
    selectedNodeIds,
    selectedEdgeIds,
  })

  const selectionSubgraph = buildSelectionSubgraphForAnchorIds(data, selectionAnchorIds)
  if (!selectionSubgraph) return filteredRows

  const nodeIdSet = new Set<string>(selectionSubgraph.nodes.map(n => String(n.id)))
  const edgeIdSet = new Set<string>(selectionSubgraph.edges.map(e => String(e.id)))

  return filteredRows.filter(row => {
    if (row.kind === 'node') return nodeIdSet.has(row.id)
    if (row.kind === 'edge') return edgeIdSet.has(row.id)
    return false
  })
}

function applyTraversalSequenceFilter(
  baseRows: UnifiedRow[],
  filteredRows: UnifiedRow[],
  graphDataTableViewMode: 'allRows' | 'selectionNeighborhood' | 'traversalSequence',
  edges: GraphEdge[],
  lastTraversalSummary: TraversalSummary | null,
  graphDataTableSortRules: ReadonlyArray<GraphDataTableSortRule>,
): UnifiedRow[] {
  if (
    graphDataTableViewMode !== 'traversalSequence' ||
    !lastTraversalSummary ||
    !Array.isArray(lastTraversalSummary.edgeIds) ||
    lastTraversalSummary.edgeIds.length === 0
  ) {
    return baseRows
  }

  if (graphDataTableSortRules.length > 0) return baseRows

  const traversalEdgeIdSet = new Set<string>(lastTraversalSummary.edgeIds.map(id => String(id)))
  const traversalNodeIdSet = new Set<string>()

  for (const edge of edges) {
    const id = String(edge.id)
    if (!traversalEdgeIdSet.has(id)) continue
    traversalNodeIdSet.add(String(edge.source))
    traversalNodeIdSet.add(String(edge.target))
  }

  const nodeRows = filteredRows.filter(
    row => row.kind === 'node' && traversalNodeIdSet.has(row.id),
  )

  const edgeRows = filteredRows
    .filter(row => row.kind === 'edge' && traversalEdgeIdSet.has(row.id))
    .sort((a, b) => {
      const aStep = a.traversalStep ?? Number.MAX_SAFE_INTEGER
      const bStep = b.traversalStep ?? Number.MAX_SAFE_INTEGER
      if (aStep !== bStep) return aStep - bStep
      const aId = a.id || ''
      const bId = b.id || ''
      if (aId < bId) return -1
      if (aId > bId) return 1
      return 0
    })

  return [...nodeRows, ...edgeRows]
}

export function useBottomPanelCuratorVisibleRows({
  nodes,
  edges,
  query,
  graphDataTableScope,
  graphDataTableFilterMatch,
  graphDataTableFilterClauses,
  graphDataTableViewMode,
  selectedNodeId,
  selectedEdgeId,
  selectedNodeIds,
  selectedEdgeIds,
  isGraphDataTableAutoSortEnabled,
  graphDataTableSortRules,
  lastTraversalSummary,
}: UseBottomPanelCuratorVisibleRowsParams): UnifiedRow[] {
  const rows = React.useMemo<UnifiedRow[]>(() => {
    const traversalEdgeStepMap = (() => {
      if (!lastTraversalSummary || !Array.isArray(lastTraversalSummary.edgeIds)) return null
      const map = new Map<string, number>()
      lastTraversalSummary.edgeIds.forEach((edgeId, index) => {
        const id = String(edgeId)
        if (!id) return
        if (map.has(id)) return
        map.set(id, index + 1)
      })
      return map
    })()

    const nodeRows: UnifiedRow[] = nodes.map(n => ({
      kind: 'node',
      id: n.id,
      label: n.label,
      type: n.type,
      properties: n.properties,
      metadata: n.metadata,
    }))
    const edgeRows: UnifiedRow[] = edges.map(e => {
      const traversalStep =
        traversalEdgeStepMap && traversalEdgeStepMap.size > 0
          ? traversalEdgeStepMap.get(String(e.id))
          : undefined
      return {
        kind: 'edge',
        id: e.id,
        label: e.label,
        source: e.source,
        target: e.target,
        properties: e.properties,
        metadata: e.metadata,
        traversalStep,
      }
    })
    return [...nodeRows, ...edgeRows]
  }, [edges, lastTraversalSummary, nodes])

  const visibleRows = React.useMemo(() => {
    const queryFilteredRows = filterRows(rows, query, graphDataTableScope)
    const filteredRows = applyGraphDataTableFilters(
      queryFilteredRows,
      graphDataTableFilterMatch,
      graphDataTableFilterClauses,
    )

    let baseRows = applySelectionNeighborhoodFilter(
      filteredRows,
      graphDataTableViewMode,
      nodes,
      edges,
      selectedNodeId,
      selectedEdgeId,
      selectedNodeIds,
      selectedEdgeIds,
    )

    baseRows = applyTraversalSequenceFilter(
      baseRows,
      filteredRows,
      graphDataTableViewMode,
      edges,
      lastTraversalSummary,
      graphDataTableSortRules,
    )

    if (!isGraphDataTableAutoSortEnabled || graphDataTableSortRules.length === 0) return baseRows

    const rules = graphDataTableSortRules
    return [...baseRows].sort((a, b) => {
      for (const rule of rules) {
        const dir = rule.dir === 'desc' ? -1 : 1
        const av = getRowFieldText(a, rule.key)
        const bv = getRowFieldText(b, rule.key)
        const aText = typeof av === 'string' ? av : av == null ? '' : String(av)
        const bText = typeof bv === 'string' ? bv : bv == null ? '' : String(bv)
        const cmp = aText.localeCompare(bText) * dir
        if (cmp !== 0) return cmp
      }
      return 0
    })
  }, [
    edges,
    graphDataTableFilterClauses,
    graphDataTableFilterMatch,
    graphDataTableScope,
    graphDataTableSortRules,
    graphDataTableViewMode,
    isGraphDataTableAutoSortEnabled,
    lastTraversalSummary,
    nodes,
    query,
    rows,
    selectedEdgeId,
    selectedNodeId,
    selectedEdgeIds,
    selectedNodeIds,
  ])

  return visibleRows
}
