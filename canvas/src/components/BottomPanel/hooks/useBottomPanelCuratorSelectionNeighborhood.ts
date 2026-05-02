import React from 'react'
import type { GraphData, GraphNode, GraphEdge } from '@/lib/graph/types'
import { readSelectionSubgraphMembershipForAnchorIds } from '@/lib/graph/file'
import { useSelectionAnchorIds } from '@/components/GraphCanvas/highlight'
import { hashScopedStringArraySignature, hashSignatureParts } from '@/lib/hash/signature'

interface UseBottomPanelCuratorSelectionNeighborhoodParams {
  nodes: GraphNode[]
  edges: GraphEdge[]
  graphDataRevision?: number
  graphDataTableViewMode: 'allRows' | 'selectionNeighborhood' | 'traversalSequence'
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedNodeIds: string[]
  selectedEdgeIds: string[]
}

export function useBottomPanelCuratorSelectionNeighborhood({
  nodes,
  edges,
  graphDataRevision = 0,
  graphDataTableViewMode,
  selectedNodeId,
  selectedEdgeId,
  selectedNodeIds,
  selectedEdgeIds,
}: UseBottomPanelCuratorSelectionNeighborhoodParams) {
  const selectionAnchorIds = useSelectionAnchorIds({
    selectedNodeId,
    selectedEdgeId,
    selectedNodeIds,
    selectedEdgeIds,
  })

  const selectionNeighborhoodActive =
    graphDataTableViewMode === 'selectionNeighborhood'
    && (
      selectionAnchorIds.selectionNodeIds.length > 0
      || selectionAnchorIds.selectionEdgeIds.length > 0
    )

  const fallbackBaseGraphIdentityKey = React.useMemo(() => {
    if (graphDataRevision > 0) return ''
    return hashSignatureParts([
      'bottom-panel-curator-selection-base-graph',
      hashScopedStringArraySignature(
        'bottom-panel-curator-selection-base-node-ids',
        nodes.map(node => String(node.id || '')),
      ),
      hashScopedStringArraySignature(
        'bottom-panel-curator-selection-base-edge-ids',
        edges.map(edge => String(edge.id || '')),
      ),
    ])
  }, [edges, graphDataRevision, nodes])

  const graphDataSemanticKey = React.useMemo(() => {
    return hashSignatureParts([
      'bottom-panel-curator-selection-base-graph',
      graphDataRevision,
      nodes.length,
      edges.length,
      fallbackBaseGraphIdentityKey,
    ])
  }, [edges.length, fallbackBaseGraphIdentityKey, graphDataRevision, nodes.length])

  const graphData = React.useMemo<GraphData>(() => ({ type: 'Graph', nodes, edges }), [edges, nodes])

  const selectionSemanticKey = React.useMemo(() => {
    return hashSignatureParts([
      'bottom-panel-curator-selection-neighborhood',
      graphDataTableViewMode,
      selectionNeighborhoodActive
        ? hashScopedStringArraySignature(
            'bottom-panel-curator-selection-node-ids',
            selectionAnchorIds.selectionNodeIds,
          )
        : '',
      selectionNeighborhoodActive
        ? hashScopedStringArraySignature(
            'bottom-panel-curator-selection-edge-ids',
            selectionAnchorIds.selectionEdgeIds,
          )
        : '',
    ])
  }, [
    graphDataTableViewMode,
    selectionAnchorIds.selectionEdgeIds,
    selectionAnchorIds.selectionNodeIds,
    selectionNeighborhoodActive,
  ])

  const selectionNeighborhoodMembership = React.useMemo(() => {
    if (!selectionNeighborhoodActive) return null
    return readSelectionSubgraphMembershipForAnchorIds(graphData, selectionAnchorIds)
  }, [graphData, selectionAnchorIds, selectionNeighborhoodActive])

  const sampleGraphData = selectionNeighborhoodMembership?.subgraph ?? graphData
  const sampleNodes = sampleGraphData.nodes
  const sampleEdges = sampleGraphData.edges
  const sampleGraphSemanticKey = React.useMemo(() => {
    return hashSignatureParts([
      'bottom-panel-curator-selection-sample-graph',
      graphDataSemanticKey,
      selectionSemanticKey,
      sampleNodes.length,
      sampleEdges.length,
    ])
  }, [graphDataSemanticKey, sampleEdges.length, sampleNodes.length, selectionSemanticKey])

  return {
    graphData,
    graphDataSemanticKey,
    selectionAnchorIds,
    selectionSemanticKey,
    selectionNeighborhoodActive,
    selectionNeighborhoodMembership,
    sampleGraphData,
    sampleNodes,
    sampleEdges,
    sampleGraphSemanticKey,
  }
}
