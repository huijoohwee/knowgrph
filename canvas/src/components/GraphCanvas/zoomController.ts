import * as d3 from 'd3';
import { useGraphStore } from '@/hooks/useGraphStore';
import type { GraphData } from '@/lib/graph/types'
import type { GraphNode } from '@/lib/graph/types'
import { fitAllTransform, centerAllTransform, scaleCenteredOnGraphCentroidTransform } from './fit';
import { readFitAllOptions, readLayoutMode } from '@/components/GraphCanvas/layout/fitConfig'
import { computeZoomSubset } from '@/components/GraphCanvas/selectionZoom'
import type { ZoomRequest } from '@/lib/zoom/requests'

type ZoomType = 'in' | 'out' | 'fit' | 'reset' | 'selection' | 'transform';

export type { ZoomRequest } from '@/lib/zoom/requests'

export const applyTransform = (
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  zoom: d3.ZoomBehavior<SVGSVGElement, unknown>,
  next: d3.ZoomTransform,
  duration = 250
) => {
  const transition = svg.transition().duration(duration);
  transition.call(zoom.transform as (sel: d3.Transition<SVGSVGElement, unknown, null, undefined>, t: d3.ZoomTransform) => void, next);
};

export const applyScaleTo = (
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  zoom: d3.ZoomBehavior<SVGSVGElement, unknown>,
  k: number,
  duration = 200
) => {
  const transition = svg.transition().duration(duration);
  transition.call(zoom.scaleTo as (sel: d3.Transition<SVGSVGElement, unknown, null, undefined>, scale: number) => void, k);
};

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
    selectedNodeIds?: string[];
    selectedEdgeIds?: string[];
  }
) => {
  if (!zoomRequest) return;
  const { svg, zoom, graphData, width, height, selectedNodeId, selectedEdgeId, selectedNodeIds, selectedEdgeIds } = ctx;
  const node = svg.node();
  const t = node ? d3.zoomTransform(node) : d3.zoomIdentity;
  const type: ZoomType = zoomRequest.type;

  const lowerMinZoomIfNeeded = (targetMinK: number) => {
    const nextMin = typeof targetMinK === 'number' && Number.isFinite(targetMinK) ? targetMinK : null
    if (nextMin == null) return
    const [minK0, maxK0] = zoom.scaleExtent()
    if (nextMin < minK0) {
      zoom.scaleExtent([nextMin, maxK0])
    }
  }
  const clear = () => {
    try {
      useGraphStore.getState().clearZoomRequest()
    } catch {
      void 0
    }
  }
  const pinned = useGraphStore.getState().viewPinned === true
  if (pinned && type !== 'in' && type !== 'out') {
    clear()
    return
  }
  if (type === 'selection') {
    if (pinned) {
      clear()
      return
    }
  }

  const computeFitTransform = () => {
    if (!graphData) return null;
    const schema = useGraphStore.getState().schema
    const mode = readLayoutMode(schema)
    const intent = zoomRequest.type === 'fit' ? zoomRequest.intent : 'fitToView'
    const commonOpts = readFitAllOptions({ schema, mode, intent })

    const w = Math.max(1, Math.floor(width))
    const h = Math.max(1, Math.floor(height))
    return fitAllTransform(graphData.nodes, w, h, commonOpts)
  }

  if (type === 'in') {
    const [, maxK] = zoom.scaleExtent();
    const k2 = Math.min(maxK, t.k * 1.2);
    if (graphData && (graphData.nodes || []).length > 0) {
      const w = Math.max(1, Math.floor(width))
      const h = Math.max(1, Math.floor(height))
      applyTransform(svg, zoom, scaleCenteredOnGraphCentroidTransform(graphData.nodes, w, h, k2), 200)
    } else {
      applyScaleTo(svg, zoom, k2)
    }
    try { useGraphStore.getState().setLifecycleStage('zoomUpdate'); } catch { void 0; }
    clear()
    return;
  }
  if (type === 'out') {
    if (graphData && (graphData.nodes || []).length > 0) {
      const fitT = computeFitTransform()
      if (fitT) lowerMinZoomIfNeeded(fitT.k)
    }
    const [minK] = zoom.scaleExtent();
    const k2 = Math.max(minK, t.k / 1.2);
    if (graphData && (graphData.nodes || []).length > 0) {
      const w = Math.max(1, Math.floor(width))
      const h = Math.max(1, Math.floor(height))
      applyTransform(svg, zoom, scaleCenteredOnGraphCentroidTransform(graphData.nodes, w, h, k2), 200)
    } else {
      applyScaleTo(svg, zoom, k2)
    }
    try { useGraphStore.getState().setLifecycleStage('zoomUpdate'); } catch { void 0; }
    clear()
    return;
  }
  if (type === 'reset') {
    if (graphData && (graphData.nodes || []).length > 0) {
      const next = centerAllTransform(graphData.nodes, Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)));
      applyTransform(svg, zoom, next, 250);
    } else {
      applyTransform(svg, zoom, d3.zoomIdentity);
    }
    try { useGraphStore.getState().setLifecycleStage('zoomUpdate'); } catch { void 0; }
    clear()
    return;
  }
  if (type === 'fit') {
    const next = computeFitTransform()
    if (!next) {
      clear()
      return
    }
    lowerMinZoomIfNeeded(next.k)
    applyTransform(svg, zoom, next, 300)
    try { useGraphStore.getState().setLifecycleStage('zoomUpdate'); } catch { void 0; }
    clear()
    return;
  }
  if (type === 'selection') {
    if (!graphData) {
      clear()
      return
    }
    const subset = computeZoomSubset({ graphData, selectedNodeId, selectedEdgeId, selectedNodeIds, selectedEdgeIds })
    if (subset.length > 0) {
      const schema = useGraphStore.getState().schema
      const mode = readLayoutMode(schema)
      const opts = readFitAllOptions({ schema, mode, intent: 'fitSelection' })
      const w = Math.max(1, Math.floor(width))
      const h = Math.max(1, Math.floor(height))
      const next = fitAllTransform(subset as GraphNode[], w, h, opts)
      applyTransform(svg, zoom, next, 300);
      try { useGraphStore.getState().setLifecycleStage('zoomUpdate'); } catch { void 0; }
      clear()
      return;
    }
    const fallback = computeFitTransform()
    if (fallback) applyTransform(svg, zoom, fallback, 300)
    try { useGraphStore.getState().setLifecycleStage('zoomUpdate'); } catch { void 0; }
    clear()
    return;
  }
  if (type === 'transform') {
    const payload = zoomRequest.type === 'transform' ? zoomRequest.payload : undefined;
    if (payload) {
      const next = d3.zoomIdentity.translate(payload.x, payload.y).scale(payload.k);
      applyTransform(svg, zoom, next, 0);
    }
    try { useGraphStore.getState().setLifecycleStage('zoomUpdate'); } catch { void 0; }
    clear()
    return;
  }
  clear()
};
