import { isCanonicalNodeIdEqual, resolveGraphNodeByCanonicalId } from '@/lib/graph/canonicalNodeIds'
import type { GraphData } from '@/lib/graph/types'

export type GraphOverlayNodeRemoval = {
  targetNodeId: string
  nextOpenWidgetNodeIds: string[]
  clearSelection: boolean
}

export function commitGraphOverlayProjectionRemoval(args: {
  removal: GraphOverlayNodeRemoval
  removePendingNode?: (nodeId: string) => void
  removeDraftNode?: (nodeId: string) => void
  setOpenWidgetNodeIds: (nodeIds: string[]) => void
  clearSelection: () => void
}): void {
  args.removePendingNode?.(args.removal.targetNodeId)
  args.removeDraftNode?.(args.removal.targetNodeId)
  args.setOpenWidgetNodeIds(args.removal.nextOpenWidgetNodeIds)
  if (args.removal.clearSelection) args.clearSelection()
}

export function commitGraphOverlayNodeRemoval(args: {
  removal: GraphOverlayNodeRemoval
  removePendingNode?: (nodeId: string) => void
  removeSourceNode: (nodeId: string) => void
  removeDraftNode?: (nodeId: string) => void
  setOpenWidgetNodeIds: (nodeIds: string[]) => void
  clearSelection: () => void
}): void {
  args.removeSourceNode(args.removal.targetNodeId)
  commitGraphOverlayProjectionRemoval(args)
}

export function resolveGraphOverlayNodeRemoval(args: {
  graphData: GraphData | null | undefined
  nodeId: unknown
  openWidgetNodeIds: ReadonlyArray<string>
  selectedNodeId: unknown
}): GraphOverlayNodeRemoval | null {
  const requestedNodeId = String(args.nodeId || '').trim()
  if (!requestedNodeId) return null
  const targetNodeId = String(resolveGraphNodeByCanonicalId(args.graphData, requestedNodeId)?.id || requestedNodeId).trim()
  const matchesTarget = (nodeId: unknown): boolean => (
    isCanonicalNodeIdEqual(nodeId, requestedNodeId)
    || isCanonicalNodeIdEqual(nodeId, targetNodeId)
  )
  return {
    targetNodeId,
    nextOpenWidgetNodeIds: args.openWidgetNodeIds.filter(nodeId => !matchesTarget(nodeId)),
    clearSelection: matchesTarget(args.selectedNodeId),
  }
}
