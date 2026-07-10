import { resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'
import { readGraphEdgeEndpoints } from '@/lib/graph/edgeEndpoints'
import { filterSubgraphsByRetainedNodeIds } from '@/lib/graph/subgraphs'
import type { GraphData } from '@/lib/graph/types'

function filterGraphByNodeIdSet(args: {
  graphData: GraphData
  nodeIds: ReadonlyArray<string> | null | undefined
  retainMatches: boolean
}): GraphData {
  const nodeIds = new Set<string>()
  for (const rawId of args.nodeIds || []) {
    const id = String(rawId || '').trim()
    if (!id) continue
    const resolvedId = String(resolveGraphNodeByCanonicalId(args.graphData, id)?.id || '').trim()
    if (resolvedId) nodeIds.add(resolvedId)
  }
  if (nodeIds.size === 0 && !args.retainMatches) return args.graphData

  const nodes = (args.graphData.nodes || []).filter(node => (
    nodeIds.has(String(node?.id || '').trim()) === args.retainMatches
  ))
  const retainedNodeIds = new Set(nodes.map(node => String(node?.id || '').trim()).filter(Boolean))
  const edges = (args.graphData.edges || []).filter(edge => {
    const { src, tgt } = readGraphEdgeEndpoints(edge)
    const sourceId = String(resolveGraphNodeByCanonicalId(args.graphData, src)?.id || '').trim()
    const targetId = String(resolveGraphNodeByCanonicalId(args.graphData, tgt)?.id || '').trim()
    return Boolean(
      sourceId
      && targetId
      && retainedNodeIds.has(sourceId)
      && retainedNodeIds.has(targetId),
    )
  })
  return filterSubgraphsByRetainedNodeIds({ ...args.graphData, nodes, edges }, retainedNodeIds)
}

export function filterGraphByExcludedNodeIds(args: {
  graphData: GraphData | null | undefined
  excludedNodeIds: ReadonlyArray<string> | null | undefined
}): GraphData | null {
  return args.graphData
    ? filterGraphByNodeIdSet({ graphData: args.graphData, nodeIds: args.excludedNodeIds, retainMatches: false })
    : null
}

export function filterGraphByIncludedNodeIds(args: {
  graphData: GraphData | null | undefined
  includedNodeIds: ReadonlyArray<string> | null | undefined
}): GraphData | null {
  return args.graphData
    ? filterGraphByNodeIdSet({ graphData: args.graphData, nodeIds: args.includedNodeIds, retainMatches: true })
    : null
}
