import { cloneGraphDataForRender } from '@/components/GraphCanvas/renderClone'
import { deriveSceneDisplayGraph } from '@/lib/scene/sceneDerivation'

export function testRenderCloneMemoizesPerGraphObject() {
  const g = {
    type: 'Graph',
    context: 'test',
    nodes: [{ id: 'a', type: 'Node', label: 'a', properties: null }],
    edges: [{ id: 'e1', type: 'Edge', source: 'a', target: 'a', properties: [] }],
  } as never

  const a = cloneGraphDataForRender(g)
  const b = cloneGraphDataForRender(g)
  if (a !== b) {
    throw new Error('expected cloneGraphDataForRender to return a stable cached object for same graphData reference')
  }
  const n = (a.nodes as any[])[0]
  const e = (a.edges as any[])[0]
  if (!n || typeof n.properties !== 'object' || Array.isArray(n.properties)) {
    throw new Error('expected node.properties to be a record object in render clone')
  }
  if (!e || typeof e.properties !== 'object' || Array.isArray(e.properties)) {
    throw new Error('expected edge.properties to be a record object in render clone')
  }
}

export function testSceneDisplayDerivationReusesDisplayNodesForStableGraphObject() {
  const g = {
    type: 'Graph',
    context: 'test',
    nodes: [{ id: 'a', type: 'Node', label: 'a', properties: {} }],
    edges: [],
  } as never
  const cloned = cloneGraphDataForRender(g)
  const a = deriveSceneDisplayGraph({ graphData: cloned })
  const b = deriveSceneDisplayGraph({ graphData: cloned })
  if (!a || !b) throw new Error('expected derivation to succeed')
  if (a.displayNodes !== b.displayNodes) {
    throw new Error('expected displayNodes array to be reused for stable graphData object')
  }
}

