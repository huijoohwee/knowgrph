import { useEffect, MutableRefObject } from 'react';
import * as d3 from 'd3';
import { GraphNode, GraphEdge } from '@/lib/graph/types';
import { type GraphSchema } from '@/lib/graph/schema';
import { getRenderNodeRadius2d, getEdgeBaseStroke, getEdgeStrokeWidth } from '@/components/GraphCanvas/helpers';
import { type EdgeWithRuntime } from '@/components/GraphCanvas/utils';
import { UI_THEME_COLORS } from '@/lib/ui/theme-tokens';
import type { ThemeMode } from '@/lib/ui/theme';
import { getNodeRectDimensions2d } from '@/components/GraphCanvas/nodeSizing2d';

type UseGraphCanvasStylesProps = {
  nodesSelRef: MutableRefObject<d3.Selection<SVGElement, GraphNode, SVGGElement, unknown> | null>;
  linksSelRef: MutableRefObject<d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null>;
  labelsSelRef: MutableRefObject<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>;
  schema: GraphSchema;
  themeMode: ThemeMode;
  paused?: boolean;
};

export function useGraphCanvasStyles({
  nodesSelRef,
  linksSelRef,
  labelsSelRef,
  schema,
  themeMode,
  paused,
}: UseGraphCanvasStylesProps) {
  useEffect(() => {
    if (paused) return;
    const isDark = themeMode === 'dark' || (themeMode === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const colors = isDark ? UI_THEME_COLORS.dark : UI_THEME_COLORS.light;

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
        .attr('fill', schema.labelStyles?.color ?? colors.labelFill)
    }
  }, [paused, nodesSelRef, linksSelRef, labelsSelRef, schema, themeMode]);
}
