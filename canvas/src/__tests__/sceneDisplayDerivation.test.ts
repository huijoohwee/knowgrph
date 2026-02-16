import { deriveSceneDisplayGraph } from '@/lib/scene/sceneDerivation'
import type { GraphData, GraphEdge } from '@/lib/graph/types'

export const testSceneDisplayDerivationMemoizesDisplayGraphAndMaps = () => {
  const graphData: GraphData = {
    type: 'Graph',
    context: 'test',
    metadata: {},
    nodes: [
      { id: 'h1', type: 'Section', label: 'H1', properties: { level: 1 }, metadata: {} },
      { id: 'a', type: 'Entity', label: 'A', properties: {}, metadata: {} },
      { id: 'b', type: 'Entity', label: 'B', properties: {}, metadata: {} },
    ],
    edges: [
      { id: 'e1', source: 'h1', target: 'a', label: 'contains', properties: {}, metadata: {} },
      { id: 'e2', source: 'a', target: 'b', label: 'rel', properties: {}, metadata: {} },
    ],
  }

  const d1 = deriveSceneDisplayGraph({ graphData })
  const d2 = deriveSceneDisplayGraph({ graphData })
  if (!d1 || !d2) throw new Error('expected derivation to return non-null')
  if (d1.displayGraphData !== d2.displayGraphData) throw new Error('expected displayGraphData to be memoized per graphData+edges source')
  if (d1.nodeIndexById !== d2.nodeIndexById) throw new Error('expected nodeIndexById to be memoized per graphData')
  if (d1.nodeById !== d2.nodeById) throw new Error('expected nodeById to be memoized per graphData')
  if (d1.displayNodeIdSet !== d2.displayNodeIdSet) throw new Error('expected displayNodeIdSet to be memoized per graphData')
  if (d1.edgeIndexById !== d2.edgeIndexById) throw new Error('expected edgeIndexById to be memoized per graphData+edges source')

  const overrideEdges = ((graphData.edges || []) as GraphEdge[]).slice()
  const o1 = deriveSceneDisplayGraph({ graphData, edges: overrideEdges })
  const o2 = deriveSceneDisplayGraph({ graphData, edges: overrideEdges })
  if (!o1 || !o2) throw new Error('expected override derivation to return non-null')
  if (o1.displayGraphData !== o2.displayGraphData) throw new Error('expected override displayGraphData to be memoized per edges array identity')
  if (o1.edgeIndexById !== o2.edgeIndexById) throw new Error('expected override edgeIndexById to be memoized per edges array identity')
}

