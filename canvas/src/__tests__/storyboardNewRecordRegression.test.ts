import type { GraphNode } from '@/lib/graph/types'
import { createStoryboardNewRecordId } from '@/components/StoryboardCanvas/storyboardNewRecord'

export function testStoryboardNewRecordIdAvoidsComposedInnerIdCollisions() {
  const nodes: GraphNode[] = [
    { id: 'workspace:/docs/demo.md::storyboard-card-1', label: 'Existing composed card', type: 'Storyboard', properties: {} } as GraphNode,
    { id: 'starter-source-brief-card', label: 'Source brief', type: 'StoryboardElement', properties: {} } as GraphNode,
  ]
  const nextId = createStoryboardNewRecordId(nodes)
  if (nextId !== 'storyboard-card-2') {
    throw new Error(`expected next storyboard record id to skip composed inner id collisions, got ${nextId}`)
  }
}
