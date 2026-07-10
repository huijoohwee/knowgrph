import {
  deriveStoryboardWidgetNodeRemoval,
  isStoryboardWidgetNodeRemovalTarget,
} from '@/components/StoryboardWidgetCanvas/runtime/useStoryboardWidgetNodeDraftActions'
import type { GraphData } from '@/lib/graph/types'

export function resolveStoryboardCardOverlayRemoval(args: {
  graphData: GraphData | null | undefined
  cardId: unknown
  openWidgetNodeIds: ReadonlyArray<string>
  selectedNodeId: unknown
}): {
  fallbackNodeId: string
  nextGraphData: GraphData | null
  nextOpenWidgetNodeIds: string[]
  removedNodeIds: string[]
  clearSelection: boolean
} | null {
  const id = String(args.cardId || '').trim()
  if (!id) return null
  const removal = deriveStoryboardWidgetNodeRemoval({ graphData: args.graphData, nodeId: id })
  const removalNodeIds = removal.removedNodeIds.length > 0 ? removal.removedNodeIds : [id]
  return {
    fallbackNodeId: id,
    nextGraphData: removal.nextGraphData,
    nextOpenWidgetNodeIds: args.openWidgetNodeIds.filter(nodeId => (
      !isStoryboardWidgetNodeRemovalTarget({ nodeId, removalNodeIds })
    )),
    removedNodeIds: removal.removedNodeIds,
    clearSelection: isStoryboardWidgetNodeRemovalTarget({ nodeId: args.selectedNodeId, removalNodeIds }),
  }
}
