import { computeFlowConnectedValuesBySchemaPath, type FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import { readGraphDataRevision } from '@/lib/graph/documentMetadata'
import { resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'
import type { GraphData } from '@/lib/graph/types'
import type { WidgetRegistryEntry } from '@/features/flow-editor-manager/widgetRegistryTypes'

import { type FlowEditorWorkflowNodeResolutionContext } from '@/components/FlowEditorCanvas/runtime/flowEditorRenderGraph'

export type FlowEditorWorkflowConnectedValuesInput = {
  graphData: GraphData
  targetNodeId: string
  connectedValuesByNodeId: Map<string, FlowConnectedValuesBySchemaPath>
}

export function resolveFlowEditorWorkflowConnectedValuesInput(args: {
  context: FlowEditorWorkflowNodeResolutionContext
  graphForRun: GraphData | null
  writableNodeId: string
  registry: WidgetRegistryEntry[]
}): FlowEditorWorkflowConnectedValuesInput | null {
  const writableNodeId = String(args.writableNodeId || '').trim()
  if (!writableNodeId) return null

  const candidateGraphs: GraphData[] = []
  if (args.context.renderGraph) candidateGraphs.push(args.context.renderGraph)
  if (args.graphForRun && !candidateGraphs.includes(args.graphForRun)) candidateGraphs.push(args.graphForRun)
  if (args.context.draftGraph && !candidateGraphs.includes(args.context.draftGraph)) candidateGraphs.push(args.context.draftGraph)
  if (args.context.storeGraph && !candidateGraphs.includes(args.context.storeGraph)) candidateGraphs.push(args.context.storeGraph)
  if (args.context.baseGraph && !candidateGraphs.includes(args.context.baseGraph)) candidateGraphs.push(args.context.baseGraph)

  for (let i = 0; i < candidateGraphs.length; i += 1) {
    const graphData = candidateGraphs[i]!
    const resolvedTargetNodeId = String(resolveGraphNodeByCanonicalId(graphData, writableNodeId)?.id || '').trim()
    if (!resolvedTargetNodeId) continue
    const connectedValuesByNodeId = computeFlowConnectedValuesBySchemaPath({
      graphData,
      graphRevision: readGraphDataRevision(graphData),
      registry: args.registry,
      targetNodeIds: new Set([resolvedTargetNodeId]),
    })
    return {
      graphData,
      targetNodeId: resolvedTargetNodeId,
      connectedValuesByNodeId,
    }
  }

  return null
}
