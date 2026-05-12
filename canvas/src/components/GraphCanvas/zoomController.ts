import * as d3 from 'd3'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { GraphData } from '@/lib/graph/types'
import type { ZoomRequest } from '@/lib/zoom/requests'
import { readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import { DEFAULT_TOOLBAR_ZOOM_CONFIG } from '@/lib/zoom/toolbarZoom'
import { resolveZoomRequest2d } from '@/lib/zoom/resolveZoomRequest2d'

export type { ZoomRequest } from '@/lib/zoom/requests'

const applyTransform = (
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  zoom: d3.ZoomBehavior<SVGSVGElement, unknown>,
  next: d3.ZoomTransform,
  durationMs: number,
) => {
  const duration = Math.max(0, Math.floor(durationMs))
  if (duration === 0) {
    svg.call(
      zoom.transform as unknown as (
        sel: d3.Selection<SVGSVGElement, unknown, null, undefined>,
        t: d3.ZoomTransform,
      ) => void,
      next,
    )
    return
  }
  svg.interrupt()
  svg
    .transition()
    .duration(duration)
    .ease(d3.easeCubicOut)
    .call(
      zoom.transform as (sel: d3.Transition<SVGSVGElement, unknown, null, undefined>, t: d3.ZoomTransform) => void,
      next,
    )
}

export const applyZoomRequest = (
  zoomRequest: ZoomRequest | null,
  ctx: {
    svg: d3.Selection<SVGSVGElement, unknown, null, undefined>;
    zoom: d3.ZoomBehavior<SVGSVGElement, unknown>;
    graphData: GraphData | null;
    width: number;
    height: number;
    selectedNodeId: string | null;
    selectedEdgeId: string | null;
    selectedGroupId?: string | null;
    selectedNodeIds?: string[];
    selectedEdgeIds?: string[];
    selectedGroupIds?: string[];
  }
) => {
  if (!zoomRequest) return;
  const { svg, zoom, graphData, width, height, selectedNodeId, selectedEdgeId, selectedGroupId, selectedNodeIds, selectedEdgeIds, selectedGroupIds } = ctx
  const clear = () => {
    try {
      useGraphStore.getState().clearZoomRequest()
    } catch {
      void 0
    }
  }
  const node = svg.node()
  const t0 = node ? d3.zoomTransform(node) : d3.zoomIdentity
  const state = useGraphStore.getState()
  const schema = state.schema
  const [curMinK, curMaxK] = zoom.scaleExtent()
  const schemaExtent = schema
    ? (() => {
        const [minK, maxK] = readZoomScaleExtent(schema)
        return { minK, maxK }
      })()
    : { minK: curMinK, maxK: curMaxK }
  const resolved = resolveZoomRequest2d({
    zoomRequest,
    graphData,
    schema,
    documentSemanticMode: (state.documentSemanticMode as 'document' | 'keyword' | undefined) ?? undefined,
    graphDataRevision: state.graphDataRevision || 0,
    viewportW: width,
    viewportH: height,
    viewportFitReferenceWidth: state.viewportFitReferenceWidth,
    viewportFitReferenceHeight: state.viewportFitReferenceHeight,
    fitFillRatio: state.viewportFitFillRatio,
    viewPinned: state.viewPinned === true,
    durations: { fitMs: state.zoomDurationFitMs, selectionMs: state.zoomDurationSelectionMs },
    toolbarZoom: DEFAULT_TOOLBAR_ZOOM_CONFIG,
    selectedNodeId,
    selectedEdgeId,
    selectedGroupId,
    selectedNodeIds,
    selectedEdgeIds,
    selectedGroupIds,
    currentTransform: t0,
    schemaExtent,
    currentExtent: { minK: curMinK, maxK: curMaxK },
    cacheKeyBase: '2d',
  })
  if (!resolved) {
    clear()
    return
  }
  const scaleExtent = resolved.scaleExtent
  if (scaleExtent.minK !== curMinK || scaleExtent.maxK !== curMaxK) {
    zoom.scaleExtent([scaleExtent.minK, scaleExtent.maxK])
  }
  const nextMinScale = resolved.nextMinScale
  if (typeof nextMinScale === 'number' && Number.isFinite(nextMinScale)) {
    const [minK0, maxK0] = zoom.scaleExtent()
    if (nextMinScale < minK0) {
      zoom.scaleExtent([nextMinScale, maxK0])
    }
  }
  applyTransform(svg, zoom, resolved.nextTransform, resolved.durationMs)
  try {
    useGraphStore.getState().setLifecycleStage('zoomUpdate')
  } catch {
    void 0
  }
  clear()
};
