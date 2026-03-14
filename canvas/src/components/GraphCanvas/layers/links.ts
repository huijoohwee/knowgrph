import * as d3 from 'd3';
import type { MutableRefObject } from 'react';
import type { GraphEdge, GraphNode } from '@/lib/graph/types';
import type { GraphSchema } from '@/lib/graph/schema';
import type { TempLinkSelection } from '@/features/edge-creation';
import type { HoverInfo } from '@/components/GraphHoverTooltip';
import { getEdgeBaseStroke, getEdgeStrokeWidth } from '@/components/GraphCanvas/helpers';
import { attachEdgeInteractionHandlers } from '@/components/GraphCanvas/layers/edgeInteractions'
import { shouldShowEdgeArrow } from '@/components/GraphCanvas/edgeDisplay'
import { edgeDragBehavior } from '@/components/GraphCanvas/utils';

type GSelection = d3.Selection<SVGGElement, unknown, null, undefined>;

function readEdgeVisualPathD(e: GraphEdge): string {
  const props = (e as unknown as { properties?: unknown }).properties
  if (!props || typeof props !== 'object' || Array.isArray(props)) return ''
  const d = (props as Record<string, unknown>)['visual:pathD']
  return typeof d === 'string' ? d : ''
}

function readEdgeVisualArrowD(e: GraphEdge): string {
  const props = (e as unknown as { properties?: unknown }).properties
  if (!props || typeof props !== 'object' || Array.isArray(props)) return ''
  const d = (props as Record<string, unknown>)['visual:arrowD']
  return typeof d === 'string' ? d : ''
}

function readEdgeVisualPathTranslate(e: GraphEdge): { x: number; y: number } | null {
  const props = (e as unknown as { properties?: unknown }).properties
  if (!props || typeof props !== 'object' || Array.isArray(props)) return null
  const txRaw = (props as Record<string, unknown>)['visual:pathTx']
  const tyRaw = (props as Record<string, unknown>)['visual:pathTy']
  const tx = typeof txRaw === 'number' ? txRaw : typeof txRaw === 'string' ? Number(txRaw) : null
  const ty = typeof tyRaw === 'number' ? tyRaw : typeof tyRaw === 'string' ? Number(tyRaw) : null
  if (typeof tx !== 'number' || !Number.isFinite(tx) || typeof ty !== 'number' || !Number.isFinite(ty)) return null
  if (!tx && !ty) return null
  return { x: tx, y: ty }
}

function coerceEdgeEndpointId(v: unknown): string {
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const id = (v as any).id
    if (typeof id === 'string' || typeof id === 'number') return String(id)
  }
  return ''
}

function coerceEdgeId(v: unknown): string {
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  return ''
}

export const createLinksHitLayer = (args: {
  g: GSelection;
  edgesForDisplay: GraphEdge[];
  schema: GraphSchema;
  simulation: d3.Simulation<GraphNode, GraphEdge>;
  hoverEnabled: boolean;
  setHoverInfo: (updater: (prev: HoverInfo | null) => HoverInfo | null) => void;
  setSelectionSource: (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => void;
  selectNode: (id: string | null) => void;
  selectEdge: (id: string | null) => void;
}) => {
  const {
    g,
    edgesForDisplay,
    schema,
    simulation,
    hoverEnabled,
    setHoverInfo,
    setSelectionSource,
    selectNode,
    selectEdge,
  } = args;

  const linkRoot = g.append('g').attr('data-kg-layer', 'links-hit');
  const withPath = edgesForDisplay.filter(e => !!readEdgeVisualPathD(e))
  const withoutPath = edgesForDisplay.filter(e => !readEdgeVisualPathD(e))

  const pathSel = linkRoot
    .selectAll<SVGPathElement, GraphEdge>('path')
    .data(withPath)
    .enter()
    .append('path')
    .attr('d', (d: GraphEdge) => readEdgeVisualPathD(d))
    .attr('transform', (d: GraphEdge) => {
      const t = readEdgeVisualPathTranslate(d)
      return t ? `translate(${t.x},${t.y})` : null
    })

  const lineSel = linkRoot
    .selectAll<SVGLineElement, GraphEdge>('line')
    .data(withoutPath)
    .enter()
    .append('line')

  const link = (pathSel as unknown as d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown>).merge(
    lineSel as unknown as d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown>,
  );

  (link as d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown>)
    .attr('data-edge-id', (d: GraphEdge) => coerceEdgeId((d as any).id))
    .attr('data-source-id', (d: GraphEdge) => coerceEdgeEndpointId((d as any).source))
    .attr('data-target-id', (d: GraphEdge) => coerceEdgeEndpointId((d as any).target))
    .attr('stroke', 'transparent')
    .attr('stroke-opacity', 1)
    .attr('stroke-width', (d: GraphEdge) => Math.max(12, getEdgeStrokeWidth(d, schema) * 7))
    .attr('stroke-linecap', 'round')
    .style('pointer-events', 'stroke')

  attachEdgeInteractionHandlers(link as unknown as d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown>, {
    hoverEnabled,
    setHoverInfo,
    setSelectionSource,
    selectNode,
    selectEdge,
    enableContextMenu: true,
  })

  if (schema.behavior?.allowNodeDrag !== false) {
    const drag = edgeDragBehavior(simulation, schema);
    (link as d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown>)
      .call(drag as unknown as d3.DragBehavior<SVGElement, GraphEdge, unknown>)
  }

  return link as unknown as d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown>
}

export const createLinksLayer = (args: {
  g: GSelection
  edgesForDisplay: GraphEdge[]
  schema: GraphSchema
}): d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown> => {
  const { g, edgesForDisplay, schema } = args

  const linkRoot = g.append('g').attr('data-kg-layer', 'links')

  const withPath = edgesForDisplay.filter(e => !!readEdgeVisualPathD(e))
  const withoutPath = edgesForDisplay.filter(e => !readEdgeVisualPathD(e))

  const arrowEdges = withPath.filter(e => !!readEdgeVisualArrowD(e))
  linkRoot
    .selectAll<SVGPathElement, GraphEdge>('path.kg-edge-arrow')
    .data(arrowEdges)
    .enter()
    .append('path')
    .attr('class', 'kg-edge-arrow')
    .attr('d', (d: GraphEdge) => readEdgeVisualArrowD(d))
    .attr('transform', (d: GraphEdge) => {
      const t = readEdgeVisualPathTranslate(d)
      return t ? `translate(${t.x},${t.y})` : null
    })
    .attr('fill', (d: GraphEdge) => getEdgeBaseStroke(d, schema))
    .attr('stroke', 'none')
    .style('pointer-events', 'none')

  const pathSel = linkRoot
    .selectAll<SVGPathElement, GraphEdge>('path.kg-edge-path')
    .data(withPath)
    .enter()
    .append('path')
    .attr('class', 'kg-edge-path')
    .attr('d', (d: GraphEdge) => readEdgeVisualPathD(d))
    .attr('transform', (d: GraphEdge) => {
      const t = readEdgeVisualPathTranslate(d)
      return t ? `translate(${t.x},${t.y})` : null
    })

  const lineSel = linkRoot.selectAll<SVGLineElement, GraphEdge>('line').data(withoutPath).enter().append('line')

  const link = (pathSel as unknown as d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown>).merge(
    lineSel as unknown as d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown>,
  )

  ;(link as d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown>)
    .attr('data-edge-id', (d: GraphEdge) => coerceEdgeId((d as any).id))
    .attr('data-source-id', (d: GraphEdge) => coerceEdgeEndpointId((d as any).source))
    .attr('data-target-id', (d: GraphEdge) => coerceEdgeEndpointId((d as any).target))
    .attr('stroke', (d: GraphEdge) => getEdgeBaseStroke(d, schema))
    .attr('stroke-opacity', 1)
    .attr('stroke-width', (d: GraphEdge) => getEdgeStrokeWidth(d, schema))
    .attr('fill', 'none')
    .style('pointer-events', 'none')

  ;(link as d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown>)
    .filter(function () {
      return String((this as unknown as { tagName?: unknown }).tagName || '').toLowerCase() === 'line'
    })
    .attr('marker-end', (d: GraphEdge) => (shouldShowEdgeArrow(d, schema) ? 'url(#arrowhead)' : null))

  return link as unknown as d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown>
};

export const createTempLink = (g: GSelection, tempLinkSelRef: MutableRefObject<TempLinkSelection>) => {
  const tempLink = g
    .append('line')
    .attr('data-kg-layer', 'temp-link')
    .attr('stroke', 'var(--kg-canvas-accent)')
    .attr('stroke-opacity', 0.6)
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '4,2')
    .style('pointer-events', 'none')
    .style('display', 'none');
  tempLinkSelRef.current = tempLink;
};
