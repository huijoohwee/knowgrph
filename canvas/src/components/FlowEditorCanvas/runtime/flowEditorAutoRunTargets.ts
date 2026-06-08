import {
  isFlowEditorWorkflowRunnableNode,
  resolveFlowEditorWorkflowDownstreamRunTargetIds,
} from '@/components/FlowEditorCanvas/runtime/flowEditorWorkflowDownstreamRunTargets'
import type { GraphData, GraphNode } from '@/lib/graph/types'

function findGraphNodeById(graphData: GraphData | null | undefined, nodeId: string): GraphNode | null {
  const id = String(nodeId || '').trim()
  if (!id || !Array.isArray(graphData?.nodes)) return null
  return graphData!.nodes.find(node => String(node?.id || '').trim() === id) || null
}

export function resolveFlowEditorAutoRunNodeIds(args: {
  graphData: GraphData | null
  nodeId: string
  resolveRichMediaKind?: (node: GraphNode) => unknown
}): string[] {
  const id = String(args.nodeId || '').trim()
  if (!id) return []
  const node = findGraphNodeById(args.graphData, id)
  if (!node) return [id]
  const downstreamTargetIds = resolveFlowEditorWorkflowDownstreamRunTargetIds({
    node,
    graphData: args.graphData,
  }).filter(targetId => {
    const targetNode = findGraphNodeById(args.graphData, targetId)
    return isFlowEditorWorkflowRunnableNode({
      node: targetNode,
      resolveRichMediaKind: args.resolveRichMediaKind,
    })
  })
  return downstreamTargetIds.length > 0 ? downstreamTargetIds : [id]
}
