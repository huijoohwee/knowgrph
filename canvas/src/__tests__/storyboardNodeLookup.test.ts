import type { GraphData, GraphNode } from '@/lib/graph/types'
import { buildStoryboardGraphBackedNodeLookup } from '@/components/StoryboardCanvas/storyboardNodeLookup'

export function testStoryboardGraphBackedNodeLookupIncludesStoreAndComposedIds() {
  const storeGraphData: GraphData = {
    type: 'Graph',
    nodes: [
      {
        id: 'workspace:/docs/demo.md::storyboard-card-1',
        label: 'Store-backed storyboard card',
        type: 'Text',
        properties: {},
      } as GraphNode,
    ],
    edges: [],
  }
  const renderGraphData: GraphData = {
    type: 'Graph',
    nodes: [
      {
        id: 'render-card-1',
        label: 'Render-only card',
        type: 'Text',
        properties: {},
      } as GraphNode,
    ],
    edges: [],
  }

  const nodeById = buildStoryboardGraphBackedNodeLookup([storeGraphData, renderGraphData])
  const composedNode = nodeById.get('workspace:/docs/demo.md::storyboard-card-1') || null
  const innerNode = nodeById.get('storyboard-card-1') || null
  const renderNode = nodeById.get('render-card-1') || null

  if (!composedNode || !innerNode || !renderNode) {
    throw new Error('expected storyboard node lookup to expose store, composed-inner, and render ids')
  }
  if (composedNode !== innerNode) {
    throw new Error('expected composed storyboard node lookup to reuse the same backing node for inner ids')
  }
}
