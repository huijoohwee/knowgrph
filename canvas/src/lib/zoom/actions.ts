import * as d3 from 'd3'

import { LRUCache } from '@/lib/cache/LRUCache'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { readFitAllOptions, readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { centerAllTransform, fitAllTransform } from '@/components/GraphCanvas/fit'
import { computeZoomSubset } from '@/components/GraphCanvas/selectionZoom'
import type { ZoomRequest, ZoomFitIntent } from '@/lib/zoom/requests'
import { computeTransformScaleAboutViewportCenter } from '@/lib/zoom/viewport'

export type ZoomComputeContext = {
  graphData: GraphData | null
  schema: GraphSchema
  graphDataRevision: number
  viewportW: number
  viewportH: number
  pinned: boolean
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedNodeIds?: string[]
  selectedEdgeIds?: string[]
  currentTransform: d3.ZoomTransform
  scaleExtent: { minK: number; maxK: number }
  cacheKeyBase: string
}

export type ZoomComputeResult = {
  nextTransform: d3.ZoomTransform
  durationMs: number
  nextMinScale?: number
} | null

const FIT_CACHE = new LRUCache<string, d3.ZoomTransform>(200)

function safeScaleExtent(scaleExtent: { minK: number; maxK: number }): { minK: number; maxK: number } {
  const minK = Number.isFinite(scaleExtent.minK) ? scaleExtent.minK : 0.05
  const maxK = Number.isFinite(scaleExtent.maxK) ? scaleExtent.maxK : 8
  const lo = Math.max(0.001, Math.min(minK, maxK))
  const hi = Math.max(lo, maxK)
  return { minK: lo, maxK: hi }
}

function clampScale(k: number, extent: { minK: number; maxK: number }): number {
  const { minK, maxK } = safeScaleExtent(extent)
  const kk = Number.isFinite(k) ? k : 1
  return Math.max(minK, Math.min(maxK, kk))
}

function schemaFitSig(schema: GraphSchema): string {
  const l = schema.layout || {}
  const b = schema.behavior
  const label = schema.labelStyles || {}
  const perf = schema.performance
  const zoom = perf?.zoom
  const lod = perf?.lod
  return [
    String(l.mode ?? ''),
    String(l.fitPadding ?? ''),
    String(l.fitDetectClusters ?? ''),
    String(l.fitTargetAspectRatio ?? ''),
    String(l.fitEnforceAspectRatio ?? ''),
    String(b.nodeShapeMode ?? ''),
    String(b.selectMode ?? ''),
    String(b.portHandles?.enabled ? 1 : 0),
    String(label.fontSize ?? ''),
    String(label.halo?.width ?? ''),
    String(lod?.hideLabelsBelowScale ?? ''),
    String(zoom?.minScale ?? ''),
    String(zoom?.maxScale ?? ''),
  ].join('|')
}

function getFitTransformCached(args: {
  graphData: GraphData
  schema: GraphSchema
  graphDataRevision: number
  viewportW: number
  viewportH: number
  intent: ZoomFitIntent | 'fitSelection'
  cacheKeyBase: string
  selectionKey?: string
  nodes: GraphNode[]
}): d3.ZoomTransform {
  const w = Math.max(1, Math.floor(args.viewportW))
  const h = Math.max(1, Math.floor(args.viewportH))
  const mode = readLayoutMode(args.schema)
  const opts = readFitAllOptions({
    schema: args.schema,
    mode,
    intent: args.intent === 'fitSelection' ? 'fitSelection' : args.intent,
  })
  const key = [
    args.cacheKeyBase,
    String(args.graphDataRevision),
    String(w),
    String(h),
    args.intent,
    args.selectionKey || '',
    schemaFitSig(args.schema),
    String(opts.pad ?? ''),
    String(opts.detectClusters ? 1 : 0),
    String(opts.targetAspectRatio ?? ''),
    String(opts.enforceAspectRatio === false ? 0 : 1),
    String(opts.targetFillRatio ?? ''),
    String(opts.minScale ?? ''),
    String(opts.maxScale ?? ''),
  ].join('|')
  const cached = FIT_CACHE.get(key)
  if (cached) return cached
  const computed = fitAllTransform(args.nodes, w, h, opts)
  FIT_CACHE.set(key, computed)
  return computed
}

function buildSelectionKey(args: {
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedNodeIds?: string[]
  selectedEdgeIds?: string[]
}): string {
  const nodeIds = Array.isArray(args.selectedNodeIds) && args.selectedNodeIds.length > 0
    ? args.selectedNodeIds
    : args.selectedNodeId
      ? [args.selectedNodeId]
      : []
  const edgeIds = Array.isArray(args.selectedEdgeIds) && args.selectedEdgeIds.length > 0
    ? args.selectedEdgeIds
    : args.selectedEdgeId
      ? [args.selectedEdgeId]
      : []
  const n = nodeIds.map(v => String(v)).filter(Boolean).sort().join(',')
  const e = edgeIds.map(v => String(v)).filter(Boolean).sort().join(',')
  return `${n}|${e}`
}

export function computeZoomTransformFromRequest(
  zoomRequest: ZoomRequest,
  ctx: ZoomComputeContext,
): ZoomComputeResult {
  const type = zoomRequest.type
  const pinned = ctx.pinned
  if (pinned && type !== 'in' && type !== 'out') return null
  if (pinned && type === 'selection') return null

  const graphData = ctx.graphData
  const w = Math.max(1, Math.floor(ctx.viewportW))
  const h = Math.max(1, Math.floor(ctx.viewportH))
  const extent = safeScaleExtent(ctx.scaleExtent)

  const computeFitAll = (intent: ZoomFitIntent) => {
    if (!graphData || (graphData.nodes || []).length === 0) return null
    return getFitTransformCached({
      graphData,
      schema: ctx.schema,
      graphDataRevision: ctx.graphDataRevision,
      viewportW: w,
      viewportH: h,
      intent,
      cacheKeyBase: ctx.cacheKeyBase,
      nodes: graphData.nodes,
    })
  }

  if (type === 'in') {
    const k2 = clampScale(ctx.currentTransform.k * 1.2, extent)
    const scaled = computeTransformScaleAboutViewportCenter({
      transform: ctx.currentTransform,
      viewportW: w,
      viewportH: h,
      nextK: k2,
    })
    return {
      nextTransform: d3.zoomIdentity.translate(scaled.x, scaled.y).scale(scaled.k),
      durationMs: 200,
    }
  }

  if (type === 'out') {
    const fitT = computeFitAll('fitToView')
    const autoMinScale = fitT ? Math.min(extent.minK, fitT.k) : extent.minK
    const k2 = clampScale(ctx.currentTransform.k / 1.2, { minK: autoMinScale, maxK: extent.maxK })
    const scaled = computeTransformScaleAboutViewportCenter({
      transform: ctx.currentTransform,
      viewportW: w,
      viewportH: h,
      nextK: k2,
    })
    return {
      nextTransform: d3.zoomIdentity.translate(scaled.x, scaled.y).scale(scaled.k),
      durationMs: 200,
      nextMinScale: autoMinScale,
    }
  }

  if (type === 'reset') {
    if (graphData && (graphData.nodes || []).length > 0) {
      return {
        nextTransform: centerAllTransform(graphData.nodes, w, h),
        durationMs: 250,
      }
    }
    return { nextTransform: d3.zoomIdentity, durationMs: 250 }
  }

  if (type === 'fit') {
    const next = computeFitAll(zoomRequest.intent)
    if (!next) return null
    return { nextTransform: next, durationMs: 300, nextMinScale: next.k }
  }

  if (type === 'selection') {
    if (!graphData) return null
    const subset = computeZoomSubset({
      graphData,
      selectedNodeId: ctx.selectedNodeId,
      selectedEdgeId: ctx.selectedEdgeId,
      selectedNodeIds: ctx.selectedNodeIds,
      selectedEdgeIds: ctx.selectedEdgeIds,
    })
    if (subset.length > 0) {
      const selectionKey = buildSelectionKey({
        selectedNodeId: ctx.selectedNodeId,
        selectedEdgeId: ctx.selectedEdgeId,
        selectedNodeIds: ctx.selectedNodeIds,
        selectedEdgeIds: ctx.selectedEdgeIds,
      })
      const next = getFitTransformCached({
        graphData,
        schema: ctx.schema,
        graphDataRevision: ctx.graphDataRevision,
        viewportW: w,
        viewportH: h,
        intent: 'fitSelection',
        cacheKeyBase: ctx.cacheKeyBase,
        selectionKey,
        nodes: subset as GraphNode[],
      })
      return { nextTransform: next, durationMs: 300, nextMinScale: next.k }
    }
    const fallback = computeFitAll('fitToView')
    if (!fallback) return null
    return { nextTransform: fallback, durationMs: 300, nextMinScale: fallback.k }
  }

  if (type === 'transform') {
    const p = zoomRequest.payload
    if (!p) return null
    const k = clampScale(p.k, extent)
    const x = Number.isFinite(p.x) ? p.x : 0
    const y = Number.isFinite(p.y) ? p.y : 0
    return {
      nextTransform: d3.zoomIdentity.translate(x, y).scale(k),
      durationMs: 0,
    }
  }

  return null
}
