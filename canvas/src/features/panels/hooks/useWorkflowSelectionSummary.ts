import { useMemo } from 'react'
import { buildSelectionSubgraph } from '@/lib/graph/file'
import type { GraphData } from '@/lib/graph/types'

export function useWorkflowSelectionSummary(
  graphData: GraphData | null,
  selectedNodeId: string | null,
  selectedEdgeId: string | null,
) {
  const hasSelection = !!(selectedNodeId || selectedEdgeId)
  const selectionSummary = useMemo(() => {
    if (!graphData || !hasSelection) return ''
    const subgraph = buildSelectionSubgraph(graphData, selectedNodeId || null, selectedEdgeId || null)
    if (!subgraph || !Array.isArray(subgraph.nodes) || !Array.isArray(subgraph.edges)) return ''
    const nodeCount = subgraph.nodes.length
    const edgeCount = subgraph.edges.length
    if (!nodeCount && !edgeCount) return ''
    const nodeLabel = nodeCount === 1 ? 'node' : 'nodes'
    const edgeLabel = edgeCount === 1 ? 'edge' : 'edges'
    return `Selection: ${nodeCount} ${nodeLabel}, ${edgeCount} ${edgeLabel}`
  }, [graphData, hasSelection, selectedEdgeId, selectedNodeId])

  return { hasSelection, selectionSummary }
}

