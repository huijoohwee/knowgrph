import * as d3 from 'd3';
import type { MutableRefObject } from 'react';
import type { GraphEdge } from '@/lib/graph/types';
import type { GraphSchema } from '@/lib/graph/schema';
import type { TempLinkSelection } from '@/features/edge-creation';
import { emitPropsPanelOpen } from '@/features/canvas/utils';
import type { HoverInfo } from '@/components/GraphHoverTooltip';
import { getEdgeBaseStroke, getEdgeStrokeWidth } from '@/components/GraphCanvas/helpers';

type GSelection = d3.Selection<SVGGElement, unknown, null, undefined>;

export const createLinksLayer = (args: {
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
  const isTree = schema.layout?.mode === 'tree';
  const treeCfg = schema.layout?.tree || {};
  const treeColorMode = treeCfg.colorMode === 'schema' ? 'schema' : 'observable';
  const linkRoot = g.append('g').attr('data-kg-layer', 'links');
  const link = isTree
    ? linkRoot.selectAll<SVGPathElement, GraphEdge>('path').data(edgesForDisplay).enter().append('path').attr('fill', 'none')
    : linkRoot.selectAll<SVGLineElement, GraphEdge>('line').data(edgesForDisplay).enter().append('line');
  (link as d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown>)
    .attr('stroke', (d: GraphEdge) => {
      if (isTree) {
        const override = typeof treeCfg.linkStroke === 'string' ? treeCfg.linkStroke.trim() : '';
        if (override) return override;
        if (treeColorMode === 'observable') return '#555';
        return getEdgeBaseStroke(d, schema);
      }
      return getEdgeBaseStroke(d, schema);
    })
    .attr('stroke-opacity', () => {
      if (!isTree) return 0.6;
      const raw = treeCfg.linkOpacity;
      if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.min(1, raw));
      return 0.4;
    })
    .attr('stroke-width', (d: GraphEdge) => {
      if (!isTree) return getEdgeStrokeWidth(d, schema);
      const raw = treeCfg.linkWidth;
      if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
      if (treeColorMode === 'observable') return 1.5;
      return getEdgeStrokeWidth(d, schema);
    })
    .style('cursor', 'pointer')
    .on('click', (event: MouseEvent, d: GraphEdge) => {
      event.stopPropagation();
      setSelectionSource('canvas');
      selectEdge(d.id);
    })
    .on('mouseover', (event: MouseEvent, d: GraphEdge) => {
      if (!hoverEnabled) return;
      setHoverInfo(() => ({
        kind: 'edge',
        id: d.id,
        clientX: event.clientX,
        clientY: event.clientY,
      }));
    })
    .on('mousemove', (event: MouseEvent, d: GraphEdge) => {
      if (!hoverEnabled) return;
      setHoverInfo(() => ({
        kind: 'edge',
        id: d.id,
        clientX: event.clientX,
        clientY: event.clientY,
      }));
    })
    .on('mouseout', () => {
      if (!hoverEnabled) return;
      setHoverInfo(prev => (prev && prev.kind === 'edge' ? null : prev));
    })
    .on('contextmenu', (event: MouseEvent, d: GraphEdge) => {
      event.preventDefault();
      event.stopPropagation();
      setSelectionSource('menu');
      selectNode(null);
      selectEdge(d.id);
      emitPropsPanelOpen({ clientX: event.clientX, clientY: event.clientY });
    });
  if (!isTree) {
    (link as d3.Selection<SVGLineElement, GraphEdge, SVGGElement, unknown>).attr(
      'marker-end',
      (d: GraphEdge) => (schema.edgeStyles[d.label]?.arrow ? 'url(#arrowhead)' : null),
    );
  } else {
    (link as d3.Selection<SVGPathElement, GraphEdge, SVGGElement, unknown>)
      .attr('stroke-linecap', 'round')
      .attr('stroke-linejoin', 'round');
  }
  return link as unknown as d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown>;
};

export const createTempLink = (g: GSelection, tempLinkSelRef: MutableRefObject<TempLinkSelection>) => {
  const tempLink = g
    .append('line')
    .attr('stroke', '#3B82F6')
    .attr('stroke-opacity', 0.6)
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '4,2')
    .style('pointer-events', 'none')
    .style('display', 'none');
  tempLinkSelRef.current = tempLink;
};
