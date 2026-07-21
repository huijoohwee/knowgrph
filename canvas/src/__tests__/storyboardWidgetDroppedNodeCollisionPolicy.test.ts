import { resolveStoryboardWidgetDroppedNodeCollisionPolicy } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetDroppedNodeCollisionPolicy'

export function testStoryboardWidgetDroppedNodeCollisionMovesOnlyNewCard() {
  const droppedPolicy = resolveStoryboardWidgetDroppedNodeCollisionPolicy({
    candidateNodeIds: ['existing-widget', 'existing-rich-media', 'dropped-widget'],
    selectedNodeId: 'dropped-widget',
    lastDroppedWidgetNodeId: 'dropped-widget',
    fallbackFixedNodeId: 'dropped-widget',
  })
  if (droppedPolicy.exclusivelyMovableNodeId !== 'dropped-widget' || droppedPolicy.fixedNodeId === 'dropped-widget') {
    throw new Error(`expected collision resolution to move only the newly dropped Widget Card, got ${JSON.stringify(droppedPolicy)}`)
  }

  const settledPolicy = resolveStoryboardWidgetDroppedNodeCollisionPolicy({
    candidateNodeIds: ['existing-widget', 'dropped-widget'],
    selectedNodeId: 'existing-widget',
    lastDroppedWidgetNodeId: 'dropped-widget',
    fallbackFixedNodeId: 'existing-widget',
  })
  if (settledPolicy.exclusivelyMovableNodeId || settledPolicy.fixedNodeId !== 'existing-widget') {
    throw new Error(`expected ordinary collision resolution after drop selection changes, got ${JSON.stringify(settledPolicy)}`)
  }
}
