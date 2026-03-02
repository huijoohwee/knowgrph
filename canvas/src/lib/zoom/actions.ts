import * as d3 from 'd3'

import { LRUCache } from '@/lib/cache/LRUCache'
import type { GraphData, GraphNode } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { readFitAllOptions, readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { fitAllTransform } from '@/components/GraphCanvas/fit'
import { computeZoomSubset } from '@/lib/zoom/selectionTargets'
import type { ZoomRequest, ZoomFitIntent } from '@/lib/zoom/requests'
import { computeTransformScaleAboutViewportCenter } from '@/lib/zoom/viewport'
import { pickNextZoomStep, readZoomStepPolicy } from '@/lib/zoom/steps'
import { computeZoomToBoundsTransform } from '@/lib/zoom/bounds'
import type { ToolbarZoomConfig } from '@/lib/zoom/toolbarZoom'
import { clampScale, safeScaleExtent } from '@/lib/zoom/scaleExtent'

export type ZoomComputeContext = {
  graphData: GraphData | null
  schema: GraphSchema
  documentSemanticMode?: 'document' | 'keyword'
  graphDataRevision: number
  viewportW: number
  viewportH: number
  pinned: boolean
  durations?: Partial<{ fitMs: number; selectionMs: number; inOutMs: number; resetMs: number }>
  toolbarZoom?: ToolbarZoomConfig
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedGroupId?: string | null
  selectedNodeIds?: string[]
  selectedEdgeIds?: string[]
  selectedGroupIds?: string[]
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

function readDurationMs(v: unknown, fallback: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  return Math.max(0, Math.floor(v))
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

function applyDocumentSemanticFitPolicy(schema: GraphSchema, opts: ReturnType<typeof readFitAllOptions>): ReturnType<typeof readFitAllOptions> {
  const next = { ...opts }
  next.detectClusters = false
  next.includeGroupsBounds = true
  next.deriveGroupsOptions = { ...(next.deriveGroupsOptions || {}), forceDocumentStructure: true }
  next.schema = {
    ...schema,
    layout: {
      ...(schema?.layout || {}),
      groups: {
        ...(schema?.layout?.groups || {}),
        enabled: true,
      },
    },
  } as GraphSchema
  return next
}

function getFitTransformCached(args: {
  graphData: GraphData
  schema: GraphSchema
  documentSemanticMode?: 'document' | 'keyword'
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
  let opts = readFitAllOptions({
    schema: args.schema,
    mode,
    intent: args.intent === 'fitSelection' ? 'fitSelection' : args.intent,
  })
  if (args.documentSemanticMode === 'document') {
    opts = applyDocumentSemanticFitPolicy(args.schema, opts)
  }
  const key = [
    args.cacheKeyBase,
    String(args.graphDataRevision),
    String(w),
    String(h),
    args.intent,
    String(args.documentSemanticMode || ''),
    args.selectionKey || '',
    schemaFitSig(args.schema),
    String(opts.pad ?? ''),
    String(opts.detectClusters ? 1 : 0),
    String((opts as unknown as { centerMode?: unknown }).centerMode ?? ''),
    String((opts as unknown as { includeGroupsBounds?: unknown }).includeGroupsBounds === false ? 0 : 1),
    String((opts as unknown as { deriveGroupsOptions?: { forceDocumentStructure?: boolean } }).deriveGroupsOptions?.forceDocumentStructure === true ? 1 : 0),
    String(opts.targetAspectRatio ?? ''),
    String(opts.enforceAspectRatio === false ? 0 : 1),
    String(opts.targetFillRatio ?? ''),
    String(opts.minScale ?? ''),
    String(opts.maxScale ?? ''),
  ].join('|')
  const cached = FIT_CACHE.get(key)
  if (cached) return cached
  const computed = fitAllTransform(args.nodes, w, h, { ...opts, graphData: args.graphData })
  FIT_CACHE.set(key, computed)
  return computed
}

function buildSelectionKey(args: {
  selectedNodeId: string | null
  selectedEdgeId: string | null
  selectedGroupId?: string | null
  selectedNodeIds?: string[]
  selectedEdgeIds?: string[]
  selectedGroupIds?: string[]
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
  const groupIds = Array.isArray(args.selectedGroupIds) && args.selectedGroupIds.length > 0
    ? args.selectedGroupIds
    : args.selectedGroupId
      ? [args.selectedGroupId]
      : []
  const n = nodeIds.map(v => String(v)).filter(Boolean).sort().join(',')
  const e = edgeIds.map(v => String(v)).filter(Boolean).sort().join(',')
  const g = groupIds.map(v => String(v)).filter(Boolean).sort().join(',')
  return `${n}|${e}|${g}`
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
      documentSemanticMode: ctx.documentSemanticMode,
      graphDataRevision: ctx.graphDataRevision,
      viewportW: w,
      viewportH: h,
      intent,
      cacheKeyBase: ctx.cacheKeyBase,
      nodes: graphData.nodes,
    })
  }

  if (type === 'in') {
    const toolbarFactorRaw = ctx.toolbarZoom?.scaleFactor
    const toolbarFactor = typeof toolbarFactorRaw === 'number' && Number.isFinite(toolbarFactorRaw) && toolbarFactorRaw > 1
      ? toolbarFactorRaw
      : null
    const stepPolicy = readZoomStepPolicy(ctx.schema)
    const k2 = toolbarFactor
      ? clampScale(ctx.currentTransform.k * toolbarFactor, extent)
      : stepPolicy.enabled
        ? pickNextZoomStep({ dir: 'in', currentK: ctx.currentTransform.k, steps: stepPolicy.steps, minK: extent.minK, maxK: extent.maxK })
        : clampScale(ctx.currentTransform.k * 1.2, extent)
    const scaled = computeTransformScaleAboutViewportCenter({
      transform: ctx.currentTransform,
      viewportW: w,
      viewportH: h,
      nextK: k2,
    })
    return {
      nextTransform: d3.zoomIdentity.translate(scaled.x, scaled.y).scale(scaled.k),
      durationMs: readDurationMs(ctx.durations?.inOutMs ?? ctx.toolbarZoom?.durationMs, 200),
    }
  }

  if (type === 'out') {
    const fitT = computeFitAll('fitToView')
    const autoMinScale = (() => {
      const kFit = typeof fitT?.k === 'number' && Number.isFinite(fitT.k) ? fitT.k : null
      if (kFit == null || kFit <= 0) return extent.minK
      const kCur = typeof ctx.currentTransform?.k === 'number' && Number.isFinite(ctx.currentTransform.k) ? ctx.currentTransform.k : extent.minK
      return Math.min(kCur, kFit)
    })()
    const toolbarFactorRaw = ctx.toolbarZoom?.scaleFactor
    const toolbarFactor = typeof toolbarFactorRaw === 'number' && Number.isFinite(toolbarFactorRaw) && toolbarFactorRaw > 1
      ? toolbarFactorRaw
      : null
    const stepPolicy = readZoomStepPolicy(ctx.schema)
    const k2 = toolbarFactor
      ? clampScale(ctx.currentTransform.k / toolbarFactor, { minK: autoMinScale, maxK: extent.maxK })
      : stepPolicy.enabled
        ? pickNextZoomStep({ dir: 'out', currentK: ctx.currentTransform.k, steps: stepPolicy.steps, minK: autoMinScale, maxK: extent.maxK })
        : clampScale(ctx.currentTransform.k / 1.2, { minK: autoMinScale, maxK: extent.maxK })
    if (fitT && typeof fitT.k === 'number' && Number.isFinite(fitT.k) && fitT.k > 0) {
      const kCur = typeof ctx.currentTransform?.k === 'number' && Number.isFinite(ctx.currentTransform.k) ? ctx.currentTransform.k : extent.minK
      const kFit = fitT.k
      const wantsFit = k2 <= autoMinScale + 1e-9
      if (wantsFit) {
        if (kCur < kFit - 1e-9) {
          const cx = (w / 2 - fitT.x) / kFit
          const cy = (h / 2 - fitT.y) / kFit
          return {
            nextTransform: d3.zoomIdentity.translate(w / 2 - kCur * cx, h / 2 - kCur * cy).scale(kCur),
            durationMs: readDurationMs(ctx.durations?.inOutMs ?? ctx.toolbarZoom?.durationMs, 200),
            nextMinScale: autoMinScale,
          }
        }
        return {
          nextTransform: fitT,
          durationMs: readDurationMs(ctx.durations?.inOutMs ?? ctx.toolbarZoom?.durationMs, 200),
          nextMinScale: autoMinScale,
        }
      }
    }
    const scaled = computeTransformScaleAboutViewportCenter({
      transform: ctx.currentTransform,
      viewportW: w,
      viewportH: h,
      nextK: k2,
    })
    return {
      nextTransform: d3.zoomIdentity.translate(scaled.x, scaled.y).scale(scaled.k),
      durationMs: readDurationMs(ctx.durations?.inOutMs ?? ctx.toolbarZoom?.durationMs, 200),
      nextMinScale: autoMinScale,
    }
  }

  if (type === 'reset') {
    const next = computeFitAll('fitToView')
    if (next) {
      return {
        nextTransform: next,
        durationMs: readDurationMs(ctx.durations?.resetMs ?? ctx.toolbarZoom?.durationMs, 250),
        nextMinScale: next.k,
      }
    }
    return { nextTransform: d3.zoomIdentity, durationMs: readDurationMs(ctx.durations?.resetMs ?? ctx.toolbarZoom?.durationMs, 250) }
  }

  if (type === 'fit') {
    const next = computeFitAll(zoomRequest.intent)
    if (!next) return null
    return { nextTransform: next, durationMs: readDurationMs(ctx.durations?.fitMs, 300), nextMinScale: next.k }
  }

  if (type === 'selection') {
    if (!graphData) return null
    const subset = computeZoomSubset({
      graphData,
      selectedNodeId: ctx.selectedNodeId,
      selectedEdgeId: ctx.selectedEdgeId,
      selectedGroupId: ctx.selectedGroupId,
      selectedNodeIds: ctx.selectedNodeIds,
      selectedEdgeIds: ctx.selectedEdgeIds,
      selectedGroupIds: ctx.selectedGroupIds,
    })
    if (subset.length > 0) {
      const selectionKey = buildSelectionKey({
        selectedNodeId: ctx.selectedNodeId,
        selectedEdgeId: ctx.selectedEdgeId,
        selectedGroupId: ctx.selectedGroupId,
        selectedNodeIds: ctx.selectedNodeIds,
        selectedEdgeIds: ctx.selectedEdgeIds,
        selectedGroupIds: ctx.selectedGroupIds,
      })
      const next = getFitTransformCached({
        graphData,
        schema: ctx.schema,
        documentSemanticMode: ctx.documentSemanticMode,
        graphDataRevision: ctx.graphDataRevision,
        viewportW: w,
        viewportH: h,
        intent: 'fitSelection',
        cacheKeyBase: ctx.cacheKeyBase,
        selectionKey,
        nodes: subset as GraphNode[],
      })
      return { nextTransform: next, durationMs: readDurationMs(ctx.durations?.selectionMs, 300), nextMinScale: next.k }
    }
    const fallback = computeFitAll('fitToView')
    if (!fallback) return null
    return { nextTransform: fallback, durationMs: readDurationMs(ctx.durations?.selectionMs, 300), nextMinScale: fallback.k }
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

  if (type === 'bounds') {
    if (pinned) return null
    const p = (zoomRequest as Extract<ZoomRequest, { type: 'bounds' }>).payload
    if (!p || !p.bounds) return null
    return {
      nextTransform: computeZoomToBoundsTransform({
        bounds: p.bounds,
        viewportW: w,
        viewportH: h,
        scaleExtent: extent,
        insetPx: p.insetPx,
        origin: p.origin,
      }),
      durationMs: 250,
    }
  }

  return null
}
