import * as d3 from 'd3';
import type { MutableRefObject } from 'react';
import type { GraphEdge } from '@/lib/graph/types';
import type { GraphSchema } from '@/lib/graph/schema';
import type { TempLinkSelection } from '@/features/edge-creation';
import { emitPropsPanelOpen } from '@/features/canvas/utils';
import type { HoverInfo } from '@/components/GraphHoverTooltip';
import { getEdgeBaseStroke, getEdgeStrokeWidth } from '@/components/GraphCanvas/helpers';
import { isTooltipRelatedTarget } from '@/features/panels/ui/tooltipUtils'

type GSelection = d3.Selection<SVGGElement, unknown, null, undefined>;

const attachLinkInteractionHandlers = (
  link: d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown>,
  args: {
    hoverEnabled: boolean
    setHoverInfo: (updater: (prev: HoverInfo | null) => HoverInfo | null) => void
    setSelectionSource: (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => void
    selectNode: (id: string | null) => void
    selectEdge: (id: string | null) => void
  },
) => {
  const { hoverEnabled, setHoverInfo, setSelectionSource, selectNode, selectEdge } = args

  link
    .style('cursor', 'pointer')
    .on('click', (event: MouseEvent, d: GraphEdge) => {
      event.stopPropagation()
      setSelectionSource('canvas')
      selectEdge(d.id)
    })
    .on('mouseover', (event: MouseEvent, d: GraphEdge) => {
      if (!hoverEnabled) return
      setHoverInfo(() => ({
        kind: 'edge',
        id: d.id,
        clientX: event.clientX,
        clientY: event.clientY,
      }))
    })
    .on('mousemove', (event: MouseEvent, d: GraphEdge) => {
      if (!hoverEnabled) return
      setHoverInfo(() => ({
        kind: 'edge',
        id: d.id,
        clientX: event.clientX,
        clientY: event.clientY,
      }))
    })
    .on('mouseout', (event: MouseEvent) => {
      if (!hoverEnabled) return
      const rt = (event as unknown as { relatedTarget?: unknown }).relatedTarget
      if (isTooltipRelatedTarget(rt)) return
      setHoverInfo(prev => (prev && prev.kind === 'edge' ? null : prev))
    })
    .on('contextmenu', (event: MouseEvent, d: GraphEdge) => {
      event.preventDefault()
      event.stopPropagation()
      setSelectionSource('menu')
      selectNode(null)
      selectEdge(d.id)
      emitPropsPanelOpen({ clientX: event.clientX, clientY: event.clientY })
    })
}

export const createLinksHitLayer = (args: {
  g: GSelection;
  edgesForDisplay: GraphEdge[];
  schema: GraphSchema;
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

  attachLinkInteractionHandlers(link as unknown as d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown>, {
    hoverEnabled,
    setHoverInfo,
    setSelectionSource,
    selectNode,
    selectEdge,
  })

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
    .attr('stroke-opacity', 0.8)
    .attr('stroke-width', (d: GraphEdge) => getEdgeStrokeWidth(d, schema))
    .style('pointer-events', 'none')

  ;(link as d3.Selection<SVGLineElement, GraphEdge, SVGGElement, unknown>).attr(
    'marker-end',
    (d: GraphEdge) => (schema.edgeStyles[d.label]?.arrow ? 'url(#arrowhead)' : null),
  )

  return link as unknown as d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown>
};

export const createTempLink = (g: GSelection, tempLinkSelRef: MutableRefObject<TempLinkSelection>) => {
  const tempLink = g
    .append('line')
    .attr('data-kg-layer', 'temp-link')
    .attr('stroke', '#3B82F6')
    .attr('stroke-opacity', 0.6)
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '4,2')
    .style('pointer-events', 'none')
    .style('display', 'none');
  tempLinkSelRef.current = tempLink;
};
