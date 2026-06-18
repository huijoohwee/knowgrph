import * as d3 from 'd3'

import { computeZoomTransformFromRequest } from '@/lib/zoom/actions'
import { defaultSchema } from '@/lib/graph/schema'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import { readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import {
  GRAPH_ELEMENT_FIT_ROLE_BOUNDS_ONLY,
  GRAPH_ELEMENT_FIT_ROLE_PROPERTY,
} from '@/lib/canvas/graph-elements/fitRoles'

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

  const boundsOnlyGraphData: GraphData = {
    type: 'graph',
    nodes: [
      {
        id: 'bounds',
        label: 'Bounds',
        type: 'Entity',
        x: 1200,
        y: 400,
        vx: 0,
        vy: 0,
        properties: {
          'visual:height': 1200,
          [GRAPH_ELEMENT_FIT_ROLE_PROPERTY]: GRAPH_ELEMENT_FIT_ROLE_BOUNDS_ONLY,
          'visual:width': 2400,
        },
      },
      {
        id: 'left',
        label: 'Left',
        type: 'Entity',
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        properties: { 'visual:height': 80, 'visual:width': 120 },
      },
      {
        id: 'right',
        label: 'Right',
        type: 'Entity',
        x: 200,
        y: 0,
        vx: 0,
        vy: 0,
        properties: { 'visual:height': 80, 'visual:width': 120 },
      },
    ],
    edges: [],
  }
  const semanticFit = computeZoomTransformFromRequest(
    { type: 'reset', at: 3 },
    {
      ...ctx,
      graphData: boundsOnlyGraphData,
      graphDataRevision: 3,
      cacheKeyBase: '2d-bounds-only',
    },
  )
  if (!semanticFit) throw new Error('expected bounds-only reset fit transform result')
  const screenCentroidX = semanticFit.nextTransform.k * 100 + semanticFit.nextTransform.x
  const screenCentroidY = semanticFit.nextTransform.y
  if (Math.abs(screenCentroidX - ctx.viewportW / 2) > 1) {
    throw new Error('expected reset fit to center the semantic graph centroid X')
  }
  if (Math.abs(screenCentroidY - ctx.viewportH / 2) > 1) {
    throw new Error('expected reset fit to center the semantic graph centroid Y')
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
