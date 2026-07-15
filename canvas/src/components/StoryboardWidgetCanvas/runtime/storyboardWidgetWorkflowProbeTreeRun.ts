import {
  materializeProbeTreeBranchCardsFromGraphNode,
  type ProbeTreeBranchCardMaterializationResult,
} from '@/components/StoryboardCanvas/storyboardProbeTreeInvocationAction'
import { findAgenticOsInvocationByToken } from '@/features/agentic-os/agenticOsDocInvocations'
import type { GraphData, GraphNode } from '@/lib/graph/types'

const PROBE_TREE_INVOCATION_LABEL = 'Knowgrph Probe-Tree'
const INVOCATION_TOKEN_PATTERN = /(^|\s)([/#@][A-Za-z0-9_.-]+)/g

export type StoryboardWidgetProbeTreeMaterializationResult = ProbeTreeBranchCardMaterializationResult & {
  invocationToken: string
}

export function resolveStoryboardWidgetProbeTreeInvocationToken(prompt: string): string {
  const text = String(prompt || '')
  for (const match of text.matchAll(INVOCATION_TOKEN_PATTERN)) {
    const token = String(match[2] || '')
    const invocation = findAgenticOsInvocationByToken(token)
    if (invocation?.kind === 'doc' && invocation.label === PROBE_TREE_INVOCATION_LABEL) return token
  }
  return ''
}

export function materializeStoryboardWidgetProbeTreeInvocation(args: {
  prompt: string
  graphData: GraphData | null | undefined
  node?: GraphNode | null
}): StoryboardWidgetProbeTreeMaterializationResult | null {
  const invocationToken = resolveStoryboardWidgetProbeTreeInvocationToken(args.prompt)
  if (!invocationToken) return null
  return {
    ...materializeProbeTreeBranchCardsFromGraphNode({
      graphData: args.graphData,
      node: args.node,
    }),
    invocationToken,
  }
}

export function publishStoryboardWidgetProbeTreeInvocation(args: {
  prompt: string
  graphData: GraphData | null | undefined
  nodeIds: readonly string[]
  fallbackNode: GraphNode
  commitGraphData: (current: GraphData, next: GraphData) => void
  onMaterialized: (nodeIds: readonly string[]) => void
}): StoryboardWidgetProbeTreeMaterializationResult | null {
  const current = args.graphData
  if (!current) return null
  const nodeIds = new Set(args.nodeIds.map(id => String(id || '')).filter(Boolean))
  const node = current.nodes.find(candidate => nodeIds.has(String(candidate?.id || ''))) || args.fallbackNode
  const materialized = materializeStoryboardWidgetProbeTreeInvocation({ prompt: args.prompt, graphData: current, node })
  if (materialized?.changed && materialized.graphData) {
    args.commitGraphData(current, materialized.graphData)
    args.onMaterialized(materialized.materializedNodeIds)
  }
  return materialized
}
