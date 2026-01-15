import { useEffect, MutableRefObject } from 'react';
import * as d3 from 'd3';
import { GraphNode, GraphEdge } from '@/lib/graph/types';
import { type GraphSchema } from '@/lib/graph/schema';
import { getNodeBaseFill, getRenderNodeRadius2d, getEdgeBaseStroke, getEdgeStrokeWidth } from '@/components/GraphCanvas/helpers';
import { type EdgeWithRuntime } from '@/components/GraphCanvas/utils';
import { UI_THEME_COLORS } from '@/lib/ui/theme-tokens';
import type { ThemeMode } from '@/lib/ui/theme';

type UseGraphCanvasStylesProps = {
  nodesSelRef: MutableRefObject<d3.Selection<SVGElement, GraphNode, SVGGElement, unknown> | null>;
  linksSelRef: MutableRefObject<d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null>;
  labelsSelRef: MutableRefObject<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>;
  schema: GraphSchema;
  themeMode: ThemeMode;
};

export function useGraphCanvasStyles({
  nodesSelRef,
  linksSelRef,
  labelsSelRef,
  schema,
  themeMode,
}: UseGraphCanvasStylesProps) {
  useEffect(() => {
    const isDark = themeMode === 'dark' || (themeMode === 'system' && typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const colors = isDark ? UI_THEME_COLORS.dark : UI_THEME_COLORS.light;

    const isMermaid = schema.layout?.mode === 'mermaid';
    const isTree = schema.layout?.mode === 'tree';
    const treeCfg = schema.layout?.tree || {};
    const treeColorMode = treeCfg.colorMode === 'schema' ? 'schema' : 'observable';

    if (nodesSelRef.current) {
      nodesSelRef.current.each(function (d: GraphNode) {
        const radius = getRenderNodeRadius2d(d, schema);
        const el = d3.select(this);
        if (this.tagName === 'circle') {
          el.attr('r', radius);
        } else if (this.tagName === 'rect') {
          const x = typeof d.x === 'number' ? d.x : 0;
          const y = typeof d.y === 'number' ? d.y : 0;
          const props = (d.properties || {}) as Record<string, unknown>;
          const visualW = typeof props['visual:width'] === 'number' ? props['visual:width'] : null;
          const visualH = typeof props['visual:height'] === 'number' ? props['visual:height'] : null;
          const w = isMermaid && visualW != null && Number.isFinite(visualW) && visualW > 0 ? visualW : radius * 2;
          const h = isMermaid && visualH != null && Number.isFinite(visualH) && visualH > 0 ? visualH : radius * 2;
          el.attr('x', x - w / 2)
            .attr('y', y - h / 2)
            .attr('width', w)
            .attr('height', h);
        }
      });
      if (isTree && treeColorMode === 'observable') {
        nodesSelRef.current.attr('stroke', 'none').attr('stroke-width', 0);
      } else {
        nodesSelRef.current
          .attr('stroke', (d: GraphNode) => {
            const override = schema.nodeStroke?.[d.type]?.color;
            if (override) return override;
            if (isTree) return 'none';
            if (isMermaid) return getNodeBaseFill(d, schema);
            return colors.nodeStroke;
          })
          .attr('stroke-width', (d: GraphNode) => {
            const override = schema.nodeStroke?.[d.type]?.width;
            if (typeof override === 'number' && Number.isFinite(override) && override >= 0) return override;
            if (isTree) return 0;
            return 1.5;
          });
      }
    }

    if (linksSelRef.current) {
      linksSelRef.current.attr('stroke', (d: GraphEdge) => {
        if (isTree) {
          const override = typeof treeCfg.linkStroke === 'string' ? treeCfg.linkStroke.trim() : '';
          if (override) return override;
          return getEdgeBaseStroke(d, schema) || colors.edgeStroke;
        }
        return getEdgeBaseStroke(d, schema) || colors.edgeStroke;
      });
      linksSelRef.current.attr('stroke-opacity', () => {
        if (!isTree) return 0.6;
        const raw = treeCfg.linkOpacity;
        if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.min(1, raw));
        return 0.4;
      });
      linksSelRef.current.attr('stroke-width', (d: GraphEdge) => {
        if (isTree) {
          const raw = treeCfg.linkWidth;
          if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
        }
        return getEdgeStrokeWidth(d as EdgeWithRuntime, schema);
      });
      if (schema.layout?.mode === 'tree') {
        linksSelRef.current.attr('marker-end', null);
      } else {
        linksSelRef.current.attr(
          'marker-end',
          (d: GraphEdge) => (schema.edgeStyles[d.label]?.arrow ? 'url(#arrowhead)' : null),
        );
      }
    }

    if (labelsSelRef.current && !isMermaid) {
      const labelFontSize = (() => {
        if (!isTree) return schema.labelStyles?.fontSize ?? 12;
        const raw = treeCfg.labelFontSize;
        if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
        const fromLabelStyles = schema.labelStyles?.fontSize;
        if (typeof fromLabelStyles === 'number' && Number.isFinite(fromLabelStyles) && fromLabelStyles > 0) return fromLabelStyles;
        return 10;
      })();
      const haloColor = schema.labelStyles?.halo?.color ?? colors.labelHalo;
      const haloWidthRaw = schema.labelStyles?.halo?.width;
      const haloWidth =
        typeof haloWidthRaw === 'number' && Number.isFinite(haloWidthRaw) && haloWidthRaw > 0 ? haloWidthRaw : 3;
      const labelFill = (() => {
        if (!isTree || treeColorMode === 'schema') return schema.labelStyles?.color ?? colors.labelFill;
        const override = typeof treeCfg.linkStroke === 'string' ? treeCfg.linkStroke.trim() : '';
        return override || colors.textSecondary;
      })();
      labelsSelRef.current.attr('font-size', labelFontSize).attr('fill', labelFill);
      if (isTree && treeColorMode === 'observable') {
        labelsSelRef.current
          .attr('paint-order', 'stroke')
          .attr('stroke', haloColor)
          .attr('stroke-width', haloWidth)
          .attr('stroke-linejoin', 'round');
      } else {
        labelsSelRef.current.attr('paint-order', null).attr('stroke', null).attr('stroke-width', null).attr('stroke-linejoin', null);
      }
      if (!isTree) {
        labelsSelRef.current
          .attr('dx', (schema.labelStyles?.offset?.dx ?? 12))
          .attr('dy', (schema.labelStyles?.offset?.dy ?? 4));
      } else {
        const visibleMode = schema.performance?.lod?.tree?.labelMode ?? 'auto';
        if (visibleMode === 'none') {
          labelsSelRef.current.attr('opacity', 0).attr('pointer-events', 'none');
        } else {
          labelsSelRef.current.attr('opacity', 1).attr('pointer-events', null);
        }
      }
    }
  }, [nodesSelRef, linksSelRef, labelsSelRef, schema, themeMode]);
}
