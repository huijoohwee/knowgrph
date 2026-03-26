import * as d3 from 'd3'

import { computeZoomTransformFromRequest } from '@/lib/zoom/actions'
import { defaultSchema } from '@/lib/graph/schema'

export function testZoomPinnedDoesNotBlockManualZoomRequests() {
  const graphData: any = {
    nodes: [
      { id: 'a', x: 0, y: 0 },
      { id: 'b', x: 200, y: 0 },
    ],
    edges: [],
    metadata: {},
  }

  const baseCtx: any = {
    graphData,
    schema: defaultSchema as any,
    documentSemanticMode: 'document',
    graphDataRevision: 1,
    viewportW: 1000,
    viewportH: 800,
    pinned: true,
    selectedNodeId: 'a',
    selectedEdgeId: null,
    selectedGroupId: null,
    selectedNodeIds: [],
    selectedEdgeIds: [],
    selectedGroupIds: [],
    currentTransform: d3.zoomIdentity,
    scaleExtent: { minK: 0.05, maxK: 8 },
    cacheKeyBase: 'test',
  }

  const fitRes = computeZoomTransformFromRequest({ type: 'fit', intent: 'fitToView' }, baseCtx)
  if (!fitRes) throw new Error('expected fit request to compute a transform even when pinned')

  const selRes = computeZoomTransformFromRequest({ type: 'selection' }, baseCtx)
  if (!selRes) throw new Error('expected selection request to compute a transform even when pinned')

  const tRes = computeZoomTransformFromRequest({ type: 'transform', payload: { k: 1.2, x: 10, y: 20 } }, baseCtx)
  if (!tRes) throw new Error('expected transform request to compute a transform even when pinned')
}

