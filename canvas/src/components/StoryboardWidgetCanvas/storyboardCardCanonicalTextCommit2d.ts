import { buildGraphNodeCanonicalTextPatch } from '@/lib/cards/graphNodeCardFields'
import { isCanonicalNodeIdEqual } from '@/lib/graph/canonicalNodeIds'
import type { GraphData, GraphNode, JSONValue } from '@/lib/graph/types'

export const commitStoryboardCardCanonicalText2d = (args: {
  addHistory: (label: string) => void
  canonicalKey: string
  cardId: string
  currentProperties: Record<string, unknown>
  historyLabel: string
  nextValue: string
  preserveFormatting?: boolean
  propertyKeys: readonly string[]
  updateNode: (id: string, patch: Partial<GraphNode>) => void
  graphData?: GraphData | null
  commitGraphData?: (graphData: GraphData) => void
}): void => {
  const buildProperties = (currentProperties: Record<string, unknown>) => buildGraphNodeCanonicalTextPatch({
    currentProperties,
    propertyKeys: args.propertyKeys,
    canonicalKey: args.canonicalKey,
    nextValue: args.nextValue,
    preserveFormatting: args.preserveFormatting,
  }) as Record<string, JSONValue>
  if (args.graphData && args.commitGraphData) {
    let changed = false
    let committedProperties: Record<string, JSONValue> | null = null
    const nodes = (args.graphData.nodes || []).map(node => {
      if (!isCanonicalNodeIdEqual(node.id, args.cardId)) return node
      changed = true
      committedProperties = buildProperties((node.properties || {}) as Record<string, unknown>)
      return { ...node, properties: committedProperties }
    })
    if (changed && committedProperties) {
      args.commitGraphData({ ...args.graphData, nodes })
      // Keep the canonical graph store in step with the durable Storyboard draft.
      // Run can start before the async source write finishes, so updating only the
      // draft allows a stale store node to overwrite the freshly authored prompt.
      args.updateNode(args.cardId, { properties: committedProperties })
      args.addHistory(args.historyLabel)
      return
    }
  }
  const nextProperties = buildProperties(args.currentProperties)
  args.updateNode(args.cardId, { properties: nextProperties })
  args.addHistory(args.historyLabel)
}
