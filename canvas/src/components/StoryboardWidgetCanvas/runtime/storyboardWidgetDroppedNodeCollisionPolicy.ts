export type StoryboardWidgetDroppedNodeCollisionPolicy = {
  fixedNodeId: string
  exclusivelyMovableNodeId: string
}

export function resolveStoryboardWidgetDroppedNodeCollisionPolicy(args: {
  candidateNodeIds: readonly string[]
  selectedNodeId: string | null
  lastDroppedWidgetNodeId: string | null
  fallbackFixedNodeId: string
}): StoryboardWidgetDroppedNodeCollisionPolicy {
  const candidateNodeIds = args.candidateNodeIds
    .map(id => String(id || '').trim())
    .filter(Boolean)
  const selectedNodeId = String(args.selectedNodeId || '').trim()
  const lastDroppedWidgetNodeId = String(args.lastDroppedWidgetNodeId || '').trim()
  const activeDroppedNodeId = (
    selectedNodeId
    && selectedNodeId === lastDroppedWidgetNodeId
    && candidateNodeIds.includes(selectedNodeId)
  ) ? selectedNodeId : ''
  if (!activeDroppedNodeId) {
    return {
      fixedNodeId: String(args.fallbackFixedNodeId || '').trim(),
      exclusivelyMovableNodeId: '',
    }
  }
  return {
    fixedNodeId: candidateNodeIds.find(id => id !== activeDroppedNodeId) || '',
    exclusivelyMovableNodeId: activeDroppedNodeId,
  }
}
