import {
  isFlowEditorWorkflowRunnableNode,
  resolveFlowEditorWorkflowDownstreamRunTargetIds,
} from '@/components/FlowEditorCanvas/runtime/flowEditorWorkflowDownstreamRunTargets'
import { readGraphEdgeEndpoints } from '@/lib/graph/edgeEndpoints'
import { readFlowEdgePortKey } from '@/lib/graph/flowPorts'
import type { GraphData, GraphNode } from '@/lib/graph/types'

function findGraphNodeById(graphData: GraphData | null | undefined, nodeId: string): GraphNode | null {
  const id = String(nodeId || '').trim()
  if (!id || !Array.isArray(graphData?.nodes)) return null
  return graphData!.nodes.find(node => String(node?.id || '').trim() === id) || null
}

export function resolveFlowEditorAutoRunNodeIds(args: {
  graphData: GraphData | null
  nodeId: string
  changedPropertyKeys?: ReadonlyArray<string> | null
  resolveRichMediaKind?: (node: GraphNode) => unknown
}): string[] {
  const id = String(args.nodeId || '').trim()
  if (!id) return []
  const node = findGraphNodeById(args.graphData, id)
  if (!node) return [id]
  const shouldScopeToChangedProperties = Array.isArray(args.changedPropertyKeys)
  const changedPropertyKeySet = new Set(
    (Array.isArray(args.changedPropertyKeys) ? args.changedPropertyKeys : [])
      .map(key => String(key || '').trim())
      .filter(Boolean),
  )
  const downstreamTargetIds = resolveFlowEditorWorkflowDownstreamRunTargetIds({
    node,
    graphData: args.graphData,
  }).filter(targetId => {
    if (shouldScopeToChangedProperties) {
      const hasChangedOutgoingPort = (args.graphData?.edges || []).some(edge => {
        const endpoints = readGraphEdgeEndpoints(edge)
        if (endpoints.src !== id || endpoints.tgt !== targetId) return false
        const sourcePortKey = readFlowEdgePortKey(edge, 'source') || ''
        return sourcePortKey ? changedPropertyKeySet.has(sourcePortKey) : false
      })
      if (!hasChangedOutgoingPort) return false
    }
    const targetNode = findGraphNodeById(args.graphData, targetId)
    return isFlowEditorWorkflowRunnableNode({
      node: targetNode,
      resolveRichMediaKind: args.resolveRichMediaKind,
    })
  })
  if (shouldScopeToChangedProperties) return downstreamTargetIds
  return downstreamTargetIds.length > 0 ? downstreamTargetIds : [id]
}
