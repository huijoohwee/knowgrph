import * as d3 from 'd3'

import { computeZoomTransformFromRequest } from '@/lib/zoom/actions'
import { defaultSchema } from '@/lib/graph/schema'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { readZoomScaleExtent } from '@/lib/graph/layoutDefaults'

function buildGraphData(): GraphData {
  const nodes: GraphNode[] = []
  for (let i = 0; i < 20; i += 1) {
    nodes.push({ id: `n${i}`, label: `n${i}`, type: 'Entity', x: i * 100, y: i * 30, vx: 0, vy: 0, properties: {} })
  }
  return { type: 'graph', nodes, edges: [] }
}

function assertViewportCenterPreserved(args: {
  before: d3.ZoomTransform
  after: d3.ZoomTransform
  viewportW: number
  viewportH: number
}) {
  const cx = args.viewportW / 2
  const cy = args.viewportH / 2
  const worldCx = (cx - args.before.x) / args.before.k
  const worldCy = (cy - args.before.y) / args.before.k
  const screenCx2 = worldCx * args.after.k + args.after.x
  const screenCy2 = worldCy * args.after.k + args.after.y
  if (Math.abs(screenCx2 - cx) > 1e-6) throw new Error('expected zoom to preserve viewport center x')
  if (Math.abs(screenCy2 - cy) > 1e-6) throw new Error('expected zoom to preserve viewport center y')
}

export function testZoomActionsZoomInOutPreserveViewportCenterNoBounce() {
  const graphData = buildGraphData()
  const schema: GraphSchema = {
    ...defaultSchema,
    performance: {
      ...(defaultSchema.performance || {}),
      zoom: { minScale: 0.05, maxScale: 6 },
    },
  }
  const [minK, maxK] = readZoomScaleExtent(schema)
  const viewportW = 800
  const viewportH = 600
  const currentTransform = d3.zoomIdentity.translate(-900, -650).scale(1.4)
  const ctx = {
    graphData,
    schema,
    graphDataRevision: 1,
    viewportW,
    viewportH,
    pinned: false,
    selectedNodeId: null,
    selectedEdgeId: null,
    currentTransform,
    scaleExtent: { minK, maxK },
    cacheKeyBase: '2d',
  } as const

  const zin = computeZoomTransformFromRequest({ type: 'in', at: 1 }, ctx)
  if (!zin) throw new Error('expected zoom-in result')
  assertViewportCenterPreserved({ before: currentTransform, after: zin.nextTransform, viewportW, viewportH })

  const zout = computeZoomTransformFromRequest({ type: 'out', at: 2 }, ctx)
  if (!zout) throw new Error('expected zoom-out result')
  assertViewportCenterPreserved({ before: currentTransform, after: zout.nextTransform, viewportW, viewportH })
}
