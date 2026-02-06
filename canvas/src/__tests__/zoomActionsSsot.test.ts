import * as d3 from 'd3'

import { computeZoomTransformFromRequest } from '@/lib/zoom/actions'
import { defaultSchema } from '@/lib/graph/schema'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { readZoomScaleExtent } from '@/lib/graph/layoutDefaults'

function buildOutlierGraphData(): GraphData {
  const nodes: GraphNode[] = []
  for (let i = 0; i < 20; i += 1) {
    nodes.push({
      id: `n${i}`,
      label: `n${i}`,
      type: 'Entity',
      x: i * 8,
      y: 0,
      vx: 0,
      vy: 0,
      properties: {},
    })
  }
  nodes.push({
    id: 'outlier',
    label: 'outlier',
    type: 'Entity',
    x: 50_000,
    y: 0,
    vx: 0,
    vy: 0,
    properties: {},
  })
  return { type: 'graph', nodes, edges: [] }
}

export function testZoomActionsFitTransformIsCachedAcrossRequests() {
  const graphData = buildOutlierGraphData()
  const schema: GraphSchema = {
    ...defaultSchema,
    performance: {
      ...(defaultSchema.performance || {}),
      zoom: { minScale: 0.1, maxScale: 4 },
    },
    layout: {
      ...defaultSchema.layout,
      fitPadding: 80,
      fitDetectClusters: true,
    },
  }
  const [minK, maxK] = readZoomScaleExtent(schema)
  const ctx = {
    graphData,
    schema,
    graphDataRevision: 1,
    viewportW: 800,
    viewportH: 600,
    pinned: false,
    selectedNodeId: null,
    selectedEdgeId: null,
    currentTransform: d3.zoomIdentity,
    scaleExtent: { minK, maxK },
    cacheKeyBase: '2d',
  } as const

  const r1 = computeZoomTransformFromRequest({ type: 'fit', intent: 'fitToView', at: 1 }, ctx)
  const r2 = computeZoomTransformFromRequest({ type: 'fit', intent: 'fitToView', at: 2 }, ctx)
  if (!r1 || !r2) throw new Error('expected fit transform result')
  if (r1.nextTransform !== r2.nextTransform) {
    throw new Error('expected fit transform to be cached and reused by reference')
  }
}

export function testZoomActionsZoomOutAutoMinScaleTracksFitToView() {
  const graphData = buildOutlierGraphData()
  const schema: GraphSchema = {
    ...defaultSchema,
    performance: {
      ...(defaultSchema.performance || {}),
      zoom: { minScale: 0.1, maxScale: 4 },
    },
    layout: {
      ...defaultSchema.layout,
      fitPadding: 80,
      fitDetectClusters: true,
    },
  }
  const [minK, maxK] = readZoomScaleExtent(schema)
  const baseCtx = {
    graphData,
    schema,
    graphDataRevision: 2,
    viewportW: 800,
    viewportH: 600,
    pinned: false,
    selectedNodeId: null,
    selectedEdgeId: null,
    selectedNodeIds: [],
    selectedEdgeIds: [],
    scaleExtent: { minK, maxK },
    cacheKeyBase: '2d',
  }

  const fit = computeZoomTransformFromRequest(
    { type: 'fit', intent: 'fitToView', at: 1 },
    { ...baseCtx, currentTransform: d3.zoomIdentity },
  )
  if (!fit) throw new Error('expected fit result')
  const out = computeZoomTransformFromRequest(
    { type: 'out', at: 2 },
    { ...baseCtx, currentTransform: d3.zoomIdentity.scale(1) },
  )
  if (!out) throw new Error('expected out result')
  const nextMin = out.nextMinScale
  if (typeof nextMin !== 'number' || !Number.isFinite(nextMin)) {
    throw new Error('expected zoom out to report nextMinScale')
  }
  const expected = Math.min(minK, fit.nextTransform.k)
  if (Math.abs(nextMin - expected) > 1e-9) {
    throw new Error(`expected nextMinScale to match min(minK, fitK); got ${nextMin} expected ${expected}`)
  }
}
