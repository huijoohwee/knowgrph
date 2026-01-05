import * as d3 from 'd3';
import { useGraphStore } from '@/hooks/useGraphStore';
import { GraphNode, GraphEdge } from '@/lib/graph/types';
import { fitAllTransform, fitSubsetTransform, centerAllTransform } from './fit';
import { getAdjacencyMap } from './simulation';

type ZoomType = 'in' | 'out' | 'fit' | 'reset' | 'selection' | 'transform';

export type ZoomRequest =
  | { type: 'in' | 'out' | 'fit' | 'reset' | 'selection'; at?: number }
  | { type: 'transform'; at?: number; payload?: { k: number; x: number; y: number } };

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
    graphData: { nodes: GraphNode[]; edges: GraphEdge[] } | null;
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
  if (type === 'in') {
    const [, maxK] = zoom.scaleExtent();
    const k2 = Math.min(maxK, t.k * 1.2);
    applyScaleTo(svg, zoom, k2);
    try { useGraphStore.getState().setLifecycleStage('zoomUpdate'); } catch { void 0; }
    return;
  }
  if (type === 'out') {
    const [minK] = zoom.scaleExtent();
    const k2 = Math.max(minK, t.k / 1.2);
    applyScaleTo(svg, zoom, k2);
    try { useGraphStore.getState().setLifecycleStage('zoomUpdate'); } catch { void 0; }
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
    return;
  }
  if (type === 'fit') {
    if (!graphData) return;
    const next = fitAllTransform(graphData.nodes, Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)));
    applyTransform(svg, zoom, next, 300);
    try { useGraphStore.getState().setLifecycleStage('zoomUpdate'); } catch { void 0; }
    return;
  }
  if (type === 'selection') {
    if (!graphData) return;
    const nodeIds =
      Array.isArray(selectedNodeIds) && selectedNodeIds.length > 0
        ? selectedNodeIds
        : selectedNodeId
          ? [selectedNodeId]
          : [];
    const edgeIds =
      Array.isArray(selectedEdgeIds) && selectedEdgeIds.length > 0
        ? selectedEdgeIds
        : selectedEdgeId
          ? [selectedEdgeId]
          : [];
    const adj = getAdjacencyMap(graphData);
    const ids = new Set<string>();
    if (nodeIds.length > 0) {
      for (const nid of nodeIds) {
        const id = String(nid);
        if (!id) continue;
        ids.add(id);
        (adj.get(id) || new Set<string>()).forEach(n => ids.add(n));
      }
    } else if (edgeIds.length > 0) {
      for (const eid of edgeIds) {
        const edgeId = String(eid);
        if (!edgeId) continue;
        const e = graphData.edges.find(x => x.id === edgeId);
        if (!e) continue;
        const sId = String(e.source);
        const tId = String(e.target);
        if (sId) ids.add(sId);
        if (tId) ids.add(tId);
        (adj.get(sId) || new Set<string>()).forEach(n => ids.add(n));
        (adj.get(tId) || new Set<string>()).forEach(n => ids.add(n));
      }
    }
    if (ids.size > 0) {
      const subset = graphData.nodes.filter(n => ids.has(n.id));
      if (subset.length > 0) {
        const next = fitSubsetTransform(subset, width, height);
        applyTransform(svg, zoom, next, 300);
        try { useGraphStore.getState().setLifecycleStage('zoomUpdate'); } catch { void 0; }
        return;
      }
    }
    if (graphData) {
      const next = fitAllTransform(graphData.nodes, Math.max(1, Math.floor(width)), Math.max(1, Math.floor(height)));
      applyTransform(svg, zoom, next, 300);
    }
    try { useGraphStore.getState().setLifecycleStage('zoomUpdate'); } catch { void 0; }
    return;
  }
  if (type === 'transform') {
    const payload = zoomRequest.type === 'transform' ? zoomRequest.payload : undefined;
    if (payload) {
      const next = d3.zoomIdentity.translate(payload.x, payload.y).scale(payload.k);
      applyTransform(svg, zoom, next, 0);
    }
    try { useGraphStore.getState().setLifecycleStage('zoomUpdate'); } catch { void 0; }
    return;
  }
};
