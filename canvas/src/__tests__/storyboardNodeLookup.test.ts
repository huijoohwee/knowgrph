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
      {
        id: { key: 'id', type: 'string', value: 'typed-frontmatter-card' } as unknown as string,
        label: 'Typed frontmatter card',
        type: { key: 'type', type: 'string', value: 'TextGeneration' } as unknown as string,
        properties: {},
      } as GraphNode,
    ],
    edges: [],
  }

  const nodeById = buildStoryboardGraphBackedNodeLookup([storeGraphData, renderGraphData])
  const composedNode = nodeById.get('workspace:/docs/demo.md::storyboard-card-1') || null
  const innerNode = nodeById.get('storyboard-card-1') || null
  const renderNode = nodeById.get('render-card-1') || null
  const typedFrontmatterNode = nodeById.get('typed-frontmatter-card') || null

  if (!composedNode || !innerNode || !renderNode || !typedFrontmatterNode) {
    throw new Error('expected storyboard node lookup to expose store, composed-inner, render, and typed frontmatter ids')
  }
  if (composedNode !== innerNode) {
    throw new Error('expected composed storyboard node lookup to reuse the same backing node for inner ids')
  }
}
