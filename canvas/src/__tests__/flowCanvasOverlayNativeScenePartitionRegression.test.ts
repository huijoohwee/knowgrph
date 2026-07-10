import { deriveFlowCanvasNativeSceneGraph } from '@/components/FlowCanvas/nativeSceneGraph'
import type { GraphData } from '@/lib/graph/types'

export function testFlowCanvasPartitionsOverlayOwnedNodesBeforeNativeSceneBuild() {
  const graphData: GraphData = {
    type: 'Graph',
    nodes: [
      { id: 'native', label: 'Native', type: 'Text', properties: {} },
      { id: 'overlay', label: 'Overlay', type: 'Text', properties: {} },
    ],
    edges: [
      { id: 'incident', source: 'native', target: 'overlay', label: 'linksTo', properties: {} },
      { id: 'retained', source: 'native', target: 'native', label: 'linksTo', properties: {} },
    ],
  }
  const nativeGraph = deriveFlowCanvasNativeSceneGraph({ sceneGraphData: graphData, overlayNodes: [{ id: 'overlay' }] })
  if (nativeGraph?.nodes.map(node => node.id).join('|') !== 'native') {
    throw new Error('expected overlay-owned nodes to be absent from the native graph')
  }
  if (nativeGraph.edges?.map(edge => edge.id).join('|') !== 'retained') {
    throw new Error('expected edges incident to overlay-owned nodes to be absent from the native graph')
  }
}
