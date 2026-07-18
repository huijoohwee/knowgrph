import { resolveStoryboardWidgetPostCommitDraftGraphData } from '@/components/StoryboardWidgetCanvas/runtime/useStoryboardWidgetGraphActions'
import type { GraphData } from '@/lib/graph/types'
import { projectComposedGraphToSourceLayer } from '@/lib/graph/sourceLayers'

export function testStoryboardWidgetPostCommitDraftKeepsComposedSourceAuthority() {
  const layerId = 'ws:caca068a'
  const parsedGraph: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'n2', type: 'TextGeneration', label: 'Existing Widget', properties: {} }],
    edges: [],
    metadata: { graphDataRevision: 7 },
  }
  const staleDraft: GraphData = {
    ...parsedGraph,
    nodes: [...parsedGraph.nodes],
  }
  const committedNode = {
    id: `${layerId}::n18`,
    type: 'TextGeneration',
    label: 'Deliverables Widget Card',
    properties: {},
    metadata: { sourceLayerId: layerId },
  }
  const liveComposedGraph: GraphData = {
    type: 'Graph',
    nodes: [
      { ...parsedGraph.nodes[0]!, id: `${layerId}::n2`, metadata: { sourceLayerId: layerId } },
      committedNode,
    ],
    edges: [],
    metadata: { graphDataRevision: 8, sourceLayerComposition: 'compose' },
  }
  const resolved = resolveStoryboardWidgetPostCommitDraftGraphData({
    liveGraphData: liveComposedGraph,
    draftGraphData: staleDraft,
    baseGraphData: staleDraft,
    committedNode,
    revisionFloor: 8,
  })
  if (resolved !== liveComposedGraph) {
    throw new Error('expected the post-commit Storyboard draft to adopt the composed store graph that owns the committed node')
  }
  const projected = projectComposedGraphToSourceLayer({
    graphData: resolved,
    layer: {
      id: layerId,
      name: 'knowgrph.md',
      enabled: true,
      parsedGraphData: parsedGraph,
    },
  })
  const projectedIds = (projected.nodes || []).map(node => String(node.id || '')).sort()
  if (JSON.stringify(projectedIds) !== JSON.stringify(['n18', 'n2'])) {
    throw new Error(`expected composed post-commit draft to project exactly one inner id per node, got ${JSON.stringify(projectedIds)}`)
  }
}
