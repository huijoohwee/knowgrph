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
import { readSelectionSubgraphMembershipForAnchorIds } from '@/lib/graph/file'
import { normalizeSelectionIds } from '@/components/GraphCanvas/highlight'
import { hashScopedStringArraySignature, hashSignatureParts } from '@/lib/hash/signature'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import {
  readTraversalSummaryMembership,
  type TraversalSummary,
  type TraversalSummaryMembership,
} from '@/features/panels/utils/orchestratorTraversal'

interface UseBottomPanelCuratorVisibleRowsParams {
  nodes: GraphNode[]
  edges: GraphEdge[]
  graphDataRevision?: number
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
  selectionNeighborhoodMembership: ReturnType<typeof readSelectionSubgraphMembershipForAnchorIds>,
): UnifiedRow[] {
  if (graphDataTableViewMode !== 'selectionNeighborhood') return filteredRows
  if (!selectionNeighborhoodMembership) return filteredRows
  const { nodeIdSet, edgeIdSet } = selectionNeighborhoodMembership

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
  traversalMembership: TraversalSummaryMembership | null,
  graphDataTableSortRules: ReadonlyArray<GraphDataTableSortRule>,
): UnifiedRow[] {
  if (
    graphDataTableViewMode !== 'traversalSequence' ||
    !traversalMembership ||
    traversalMembership.edgeIds.length === 0
  ) {
    return baseRows
  }

  if (graphDataTableSortRules.length > 0) return baseRows

  const { edgeIdSet: traversalEdgeIdSet, nodeIdSet: traversalNodeIdSet } = traversalMembership

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
  graphDataRevision = 0,
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
  const selectionSemanticKey = React.useMemo(() => {
    return hashSignatureParts([
      'bottom-panel-curator-visible-rows-selection',
      graphDataTableViewMode,
      selectedNodeId || '',
      selectedEdgeId || '',
      hashScopedStringArraySignature('selected-node-ids', selectedNodeIds),
      hashScopedStringArraySignature('selected-edge-ids', selectedEdgeIds),
    ])
  }, [
    graphDataTableViewMode,
    selectedEdgeId,
    selectedEdgeIds,
    selectedNodeId,
    selectedNodeIds,
  ])

  const traversalSummarySemanticKey = React.useMemo(() => {
    return hashSignatureParts([
      'bottom-panel-curator-visible-rows-traversal',
      lastTraversalSummary?.mode || '',
      hashScopedStringArraySignature(
        'bottom-panel-curator-visible-rows-traversal-edge-ids',
        lastTraversalSummary?.edgeIds || [],
      ),
    ])
  }, [lastTraversalSummary?.edgeIds, lastTraversalSummary?.mode])

  const fallbackGraphIdentityKey = React.useMemo(() => {
    if (graphDataRevision > 0) return ''
    return hashSignatureParts([
      'bottom-panel-curator-visible-rows-fallback-graph',
      hashScopedStringArraySignature(
        'bottom-panel-curator-visible-rows-node-ids',
        nodes.map(node => String(node.id || '')),
      ),
      hashScopedStringArraySignature(
        'bottom-panel-curator-visible-rows-edge-ids',
        edges.map(edge => String(edge.id || '')),
      ),
    ])
  }, [edges, graphDataRevision, nodes])

  const graphDataSemanticKey = React.useMemo(() => {
    return hashSignatureParts([
      'bottom-panel-curator-visible-rows-graph',
      graphDataRevision,
      selectionSemanticKey,
      traversalSummarySemanticKey,
      nodes.length,
      edges.length,
      fallbackGraphIdentityKey,
    ])
  }, [
    edges.length,
    fallbackGraphIdentityKey,
    graphDataRevision,
    nodes.length,
    selectionSemanticKey,
    traversalSummarySemanticKey,
  ])

  const graphDataRef = React.useRef<{ key: string; value: GraphData } | null>(null)
  if (graphDataRef.current?.key !== graphDataSemanticKey) {
    graphDataRef.current = {
      key: graphDataSemanticKey,
      value: { type: 'Graph', nodes, edges },
    }
  }
  const graphData = graphDataRef.current.value
  const traversalGraphSemanticKey = React.useMemo(() => {
    return buildScopedGraphSemanticKey('bottom-panel-curator-visible-rows', {
      graphData,
      graphRevision: graphDataRevision,
      graphSemanticKey: graphDataSemanticKey,
    })
  }, [graphData, graphDataRevision, graphDataSemanticKey])

  const selectionNeighborhoodMembership = React.useMemo(() => {
    if (graphDataTableViewMode !== 'selectionNeighborhood') return null
    const selectionAnchorIds: SelectionAnchorIds = normalizeSelectionIds({
      selectedNodeId,
      selectedEdgeId,
      selectedNodeIds,
      selectedEdgeIds,
    })
    if (
      selectionAnchorIds.selectionNodeIds.length === 0
      && selectionAnchorIds.selectionEdgeIds.length === 0
    ) {
      return null
    }
    return readSelectionSubgraphMembershipForAnchorIds(graphData, selectionAnchorIds)
  }, [
    graphData,
    graphDataTableViewMode,
    selectedEdgeId,
    selectedEdgeIds,
    selectedNodeId,
    selectedNodeIds,
  ])

  const traversalMembership = React.useMemo(() => {
    return readTraversalSummaryMembership(graphData, lastTraversalSummary, {
      graphRevision: graphDataRevision,
      graphSemanticKey: traversalGraphSemanticKey,
    })
  }, [graphData, graphDataRevision, lastTraversalSummary, traversalGraphSemanticKey])

  const rows = React.useMemo<UnifiedRow[]>(() => {
    const traversalEdgeStepMap = traversalMembership?.edgeStepById ?? null

    const nodeRows: UnifiedRow[] = graphData.nodes.map(n => ({
      kind: 'node',
      id: n.id,
      label: n.label,
      type: n.type,
      properties: n.properties,
      metadata: n.metadata,
    }))
    const edgeRows: UnifiedRow[] = graphData.edges.map(e => {
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
  }, [graphData, traversalMembership])

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
      selectionNeighborhoodMembership,
    )

    baseRows = applyTraversalSequenceFilter(
      baseRows,
      filteredRows,
      graphDataTableViewMode,
      traversalMembership,
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
    graphDataTableFilterClauses,
    graphDataTableFilterMatch,
    graphDataTableScope,
    graphDataTableSortRules,
    graphDataTableViewMode,
    isGraphDataTableAutoSortEnabled,
    query,
    rows,
    selectionNeighborhoodMembership,
    traversalMembership,
  ])

  return visibleRows
}
