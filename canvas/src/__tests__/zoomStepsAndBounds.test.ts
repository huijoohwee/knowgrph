import * as d3 from 'd3'

import { computeZoomTransformFromRequest } from '@/lib/zoom/actions'
import { defaultSchema } from '@/lib/graph/schema'
import type { GraphSchema } from '@/lib/graph/schema'
import { readZoomScaleExtent } from '@/lib/graph/layoutDefaults'

export function testZoomActionsUseDiscreteStepsWhenConfigured() {
  const schema: GraphSchema = {
    ...defaultSchema,
    performance: {
      ...(defaultSchema.performance || {}),
      zoom: { minScale: 0.1, maxScale: 6, steps: [0.25, 0.5, 1, 2, 4] },
    },
  }
  const [minK, maxK] = readZoomScaleExtent(schema)
  const ctx = {
    graphData: null,
    schema,
    graphDataRevision: 1,
    viewportW: 800,
    viewportH: 600,
    pinned: false,
    selectedNodeId: null,
    selectedEdgeId: null,
    currentTransform: d3.zoomIdentity.scale(1),
    scaleExtent: { minK, maxK },
    cacheKeyBase: '2d',
  } as const

  const zin = computeZoomTransformFromRequest({ type: 'in', at: 1 }, ctx)
  if (!zin) throw new Error('expected zoom-in result')
  if (Math.abs(zin.nextTransform.k - 2) > 1e-12) throw new Error(`expected zoom-in to step to 2, got ${zin.nextTransform.k}`)

  const zout = computeZoomTransformFromRequest({ type: 'out', at: 2 }, ctx)
  if (!zout) throw new Error('expected zoom-out result')
  if (Math.abs(zout.nextTransform.k - 0.5) > 1e-12) throw new Error(`expected zoom-out to step to 0.5, got ${zout.nextTransform.k}`)
}

export function testZoomActionsDefaultToPow2StepsWhenUnset() {
  const schema: GraphSchema = {
    ...defaultSchema,
    performance: {
      ...(defaultSchema.performance || {}),
      zoom: { minScale: 0.1, maxScale: 6 },
    },
  }
  const [minK, maxK] = readZoomScaleExtent(schema)
  const ctx = {
    graphData: null,
    schema,
    graphDataRevision: 1,
    viewportW: 800,
    viewportH: 600,
    pinned: false,
    selectedNodeId: null,
    selectedEdgeId: null,
    currentTransform: d3.zoomIdentity.scale(1),
    scaleExtent: { minK, maxK },
    cacheKeyBase: '2d',
  } as const

  const zin = computeZoomTransformFromRequest({ type: 'in', at: 1 }, ctx)
  if (!zin) throw new Error('expected zoom-in result')
  if (Math.abs(zin.nextTransform.k - 2) > 1e-12) throw new Error(`expected default zoom-in to step to 2, got ${zin.nextTransform.k}`)

  const zout = computeZoomTransformFromRequest({ type: 'out', at: 2 }, ctx)
  if (!zout) throw new Error('expected zoom-out result')
  if (Math.abs(zout.nextTransform.k - 0.5) > 1e-12) throw new Error(`expected default zoom-out to step to 0.5, got ${zout.nextTransform.k}`)
}

export function testZoomActionsToolbarZoomDoesNotNoopOnDegenerateScaleExtent() {
  const schema: GraphSchema = {
    ...defaultSchema,
    performance: {
      ...(defaultSchema.performance || {}),
      zoom: { minScale: 1, maxScale: 1 },
    },
  }
  const ctx = {
    graphData: null,
    schema,
    graphDataRevision: 1,
    viewportW: 800,
    viewportH: 600,
    pinned: false,
    selectedNodeId: null,
    selectedEdgeId: null,
    currentTransform: d3.zoomIdentity.scale(1),
    scaleExtent: { minK: 1, maxK: 1 },
    cacheKeyBase: '2d',
    toolbarZoom: { scaleFactor: 1.25, durationMs: 0 },
  } as const

  const zin = computeZoomTransformFromRequest({ type: 'in', at: 1 }, ctx)
  if (!zin) throw new Error('expected zoom-in result')
  if (!(zin.nextTransform.k > 1 + 1e-12)) throw new Error(`expected zoom-in to increase k, got ${zin.nextTransform.k}`)
}

export function testZoomToBoundsFitsWithInset() {
  const schema: GraphSchema = {
    ...defaultSchema,
    performance: {
      ...(defaultSchema.performance || {}),
      zoom: { minScale: 0.1, maxScale: 10 },
    },
  }
  const [minK, maxK] = readZoomScaleExtent(schema)
  const ctx = {
    graphData: null,
    schema,
    graphDataRevision: 1,
    viewportW: 200,
    viewportH: 200,
    pinned: false,
    selectedNodeId: null,
    selectedEdgeId: null,
    currentTransform: d3.zoomIdentity,
    scaleExtent: { minK, maxK },
    cacheKeyBase: '2d',
  } as const

  const r = computeZoomTransformFromRequest(
    { type: 'bounds', at: 1, payload: { bounds: { x: 0, y: 0, w: 100, h: 50 }, insetPx: 20, origin: { x: 0.5, y: 0.5 } } },
    ctx,
  )
  if (!r) throw new Error('expected bounds result')
  if (Math.abs(r.nextTransform.k - 1.6) > 1e-9) throw new Error(`expected k=1.6, got ${r.nextTransform.k}`)
  if (Math.abs(r.nextTransform.x - 20) > 1e-6) throw new Error(`expected x=20, got ${r.nextTransform.x}`)
  if (Math.abs(r.nextTransform.y - 60) > 1e-6) throw new Error(`expected y=60, got ${r.nextTransform.y}`)
}
