import { useEffect, MutableRefObject } from 'react';
import * as d3 from 'd3';
import { GraphNode, GraphEdge } from '@/lib/graph/types';
import { type GraphSchema } from '@/lib/graph/schema';
import { getRenderNodeRadius2d, getEdgeBaseStroke, getEdgeStrokeWidth } from '@/components/GraphCanvas/helpers';
import { type EdgeWithRuntime } from '@/components/GraphCanvas/utils';
import { UI_THEME_COLORS_CSS } from '@/lib/ui/theme-tokens';
import { getNodeRectDimensions2d } from '@/components/GraphCanvas/nodeSizing2d';

type UseGraphCanvasStylesProps = {
  gRef?: MutableRefObject<d3.Selection<SVGGElement, unknown, null, undefined> | null>;
  nodesSelRef: MutableRefObject<d3.Selection<SVGElement, GraphNode, SVGGElement, unknown> | null>;
  linksSelRef: MutableRefObject<d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null>;
  labelsSelRef: MutableRefObject<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>;
  schema: GraphSchema;
  paused?: boolean;
  graphDataRevision?: number;
};

export function useGraphCanvasStyles({
  gRef,
  nodesSelRef,
  linksSelRef,
  labelsSelRef,
  schema,
  paused,
  graphDataRevision,
}: UseGraphCanvasStylesProps) {
  useEffect(() => {
    if (paused) return;
    const colors = UI_THEME_COLORS_CSS;
    const labelFill = schema.labelStyles?.color ?? colors.labelFill
    const haloColor = schema.labelStyles?.halo?.color ?? colors.labelHalo
    const haloWidthRaw = schema.labelStyles?.halo?.width
    const haloWidth = typeof haloWidthRaw === 'number' && Number.isFinite(haloWidthRaw) && haloWidthRaw > 0 ? haloWidthRaw : 3

    if (nodesSelRef.current) {
      nodesSelRef.current.each(function (d: GraphNode) {
        const radius = getRenderNodeRadius2d(d, schema);
        const el = d3.select(this);
        if (this.tagName === 'circle') {
          el.attr('r', radius);
        } else if (this.tagName === 'rect') {
          const x = typeof d.x === 'number' ? d.x : 0;
          const y = typeof d.y === 'number' ? d.y : 0;
          const { width: w, height: h } = getNodeRectDimensions2d(d, schema);
          el.attr('x', x - w / 2)
            .attr('y', y - h / 2)
            .attr('width', w)
            .attr('height', h);
        }
      });
      nodesSelRef.current
        .attr('stroke', (d: GraphNode) => {
          const override = schema.nodeStroke?.[d.type]?.color;
          if (override) return override;
          return colors.nodeStroke;
        })
        .attr('stroke-width', (d: GraphNode) => {
          const override = schema.nodeStroke?.[d.type]?.width;
          if (typeof override === 'number' && Number.isFinite(override) && override >= 0) return override;
          return 1.5;
        });
    }

    if (linksSelRef.current) {
      linksSelRef.current.attr('stroke', (d: GraphEdge) => {
        return getEdgeBaseStroke(d, schema) || colors.edgeStroke;
      });
      linksSelRef.current.attr('stroke-opacity', () => {
        return 0.6;
      });
      linksSelRef.current.attr('stroke-width', (d: GraphEdge) => {
        return getEdgeStrokeWidth(d as EdgeWithRuntime, schema);
      });
      linksSelRef.current.attr(
        'marker-end',
        (d: GraphEdge) => (schema.edgeStyles[d.label]?.arrow ? 'url(#arrowhead)' : null),
      );
    }

    if (labelsSelRef.current) {
      labelsSelRef.current
        .attr('font-size', schema.labelStyles?.fontSize ?? 12)
        .attr('fill', labelFill)
        .attr('stroke', haloColor)
        .attr('stroke-width', haloWidth)
        .attr('stroke-linejoin', 'round')
        .attr('paint-order', 'stroke')
    }

    const root = gRef?.current ?? null
    if (root) {
      const styleTextSel = (sel: d3.Selection<SVGTextElement, unknown, SVGGElement, unknown>, fontSizePx?: number) => {
        sel
          .attr('fill', labelFill)
          .attr('stroke', haloColor)
          .attr('stroke-width', Math.max(2, haloWidth * 0.85))
          .attr('stroke-linejoin', 'round')
          .attr('paint-order', 'stroke')
        if (typeof fontSizePx === 'number' && Number.isFinite(fontSizePx) && fontSizePx > 0) {
          sel.attr('font-size', fontSizePx)
        }
      }

      const baseFontSizeRaw = schema.labelStyles?.fontSize
      const baseFontSize = typeof baseFontSizeRaw === 'number' && Number.isFinite(baseFontSizeRaw) && baseFontSizeRaw > 0 ? baseFontSizeRaw : 12
      styleTextSel(root.selectAll<SVGTextElement, unknown>('[data-kg-layer="group-labels"] text'), baseFontSize)
      styleTextSel(root.selectAll<SVGTextElement, unknown>('[data-kg-layer="edge-labels"] text'), Math.max(9, baseFontSize * 0.9))
      root
        .selectAll<SVGPathElement, unknown>('path[data-kg-group-chevron]')
        .attr('stroke', labelFill)
    }
  }, [paused, gRef, nodesSelRef, linksSelRef, labelsSelRef, schema, graphDataRevision]);
}
