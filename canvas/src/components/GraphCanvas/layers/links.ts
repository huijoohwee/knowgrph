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
  const link = linkRoot.selectAll<SVGLineElement, GraphEdge>('line').data(edgesForDisplay).enter().append('line');

  (link as d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown>)
    .attr('stroke', 'transparent')
    .attr('stroke-opacity', 1)
    .attr('stroke-width', (d: GraphEdge) => Math.max(10, getEdgeStrokeWidth(d, schema) * 6))
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
  const link = linkRoot.selectAll<SVGLineElement, GraphEdge>('line').data(edgesForDisplay).enter().append('line')

  ;(link as d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown>)
    .attr('stroke', (d: GraphEdge) => getEdgeBaseStroke(d, schema))
    .attr('stroke-opacity', 1)
    .attr('stroke-width', (d: GraphEdge) => getEdgeStrokeWidth(d, schema))
    .style('pointer-events', 'none')

  ;(link as d3.Selection<SVGLineElement, GraphEdge, SVGGElement, unknown>).attr(
    'marker-end',
    (d: GraphEdge) => (shouldShowEdgeArrow(d, schema) ? 'url(#arrowhead)' : null),
  )

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
