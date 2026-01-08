import { useEffect, MutableRefObject } from 'react';
import * as d3 from 'd3';
import { GraphNode, GraphEdge } from '@/lib/graph/types';
import { type GraphSchema } from '@/lib/graph/schema';
import { getRenderNodeRadius2d, getEdgeBaseStroke, getEdgeStrokeWidth } from '@/components/GraphCanvas/helpers';
import { type EdgeWithRuntime } from '@/components/GraphCanvas/utils';

type UseGraphCanvasStylesProps = {
  nodesSelRef: MutableRefObject<d3.Selection<SVGElement, GraphNode, SVGGElement, unknown> | null>;
  linksSelRef: MutableRefObject<d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null>;
  labelsSelRef: MutableRefObject<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>;
  schema: GraphSchema;
};

export function useGraphCanvasStyles({
  nodesSelRef,
  linksSelRef,
  labelsSelRef,
  schema,
}: UseGraphCanvasStylesProps) {
  useEffect(() => {
    const isTidyTree = schema.layout?.mode === 'tidy-tree';
    const tidyCfg = schema.layout?.tidyTree || {};
    const tidyColorMode = tidyCfg.colorMode === 'schema' ? 'schema' : 'observable';

    if (nodesSelRef.current) {
      nodesSelRef.current.each(function (d: GraphNode) {
        const radius = getRenderNodeRadius2d(d, schema);
        const el = d3.select(this);
        if (this.tagName === 'circle') {
          el.attr('r', radius);
        } else if (this.tagName === 'rect') {
          const x = typeof d.x === 'number' ? d.x : 0;
          const y = typeof d.y === 'number' ? d.y : 0;
          el.attr('x', x - radius)
            .attr('y', y - radius)
            .attr('width', radius * 2)
            .attr('height', radius * 2);
        }
      });
      if (isTidyTree && tidyColorMode === 'observable') {
        nodesSelRef.current.attr('stroke', 'none').attr('stroke-width', 0);
      } else {
        nodesSelRef.current
          .attr('stroke', (d: GraphNode) => (schema.nodeStroke?.[d.type]?.color ?? (isTidyTree ? 'none' : '#ffffff')))
          .attr('stroke-width', (d: GraphNode) => (schema.nodeStroke?.[d.type]?.width ?? (isTidyTree ? 0 : 1.5)));
      }
    }

    if (linksSelRef.current) {
      linksSelRef.current.attr('stroke', (d: GraphEdge) => {
        if (isTidyTree) {
          const override = typeof tidyCfg.linkStroke === 'string' ? tidyCfg.linkStroke.trim() : '';
          if (override) return override;
          return getEdgeBaseStroke(d, schema);
        }
        return getEdgeBaseStroke(d, schema);
      });
      linksSelRef.current.attr('stroke-opacity', () => {
        if (!isTidyTree) return 0.6;
        const raw = tidyCfg.linkOpacity;
        if (typeof raw === 'number' && Number.isFinite(raw)) return Math.max(0, Math.min(1, raw));
        return 0.4;
      });
      linksSelRef.current.attr('stroke-width', (d: GraphEdge) => {
        if (isTidyTree) {
          const raw = tidyCfg.linkWidth;
          if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
        }
        return getEdgeStrokeWidth(d as EdgeWithRuntime, schema);
      });
      if (schema.layout?.mode === 'tidy-tree') {
        linksSelRef.current.attr('marker-end', null);
      } else {
        linksSelRef.current.attr(
          'marker-end',
          (d: GraphEdge) => (schema.edgeStyles[d.label]?.arrow ? 'url(#arrowhead)' : null),
        );
      }
    }

    if (labelsSelRef.current) {
      const labelFontSize = (() => {
        if (!isTidyTree) return schema.labelStyles?.fontSize ?? 12;
        const raw = tidyCfg.labelFontSize;
        if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw;
        const fromLabelStyles = schema.labelStyles?.fontSize;
        if (typeof fromLabelStyles === 'number' && Number.isFinite(fromLabelStyles) && fromLabelStyles > 0) return fromLabelStyles;
        return 10;
      })();
      const haloColor = schema.labelStyles?.halo?.color ?? '#ffffff';
      const haloWidthRaw = schema.labelStyles?.halo?.width;
      const haloWidth =
        typeof haloWidthRaw === 'number' && Number.isFinite(haloWidthRaw) && haloWidthRaw > 0 ? haloWidthRaw : 3;
      const labelFill = (() => {
        if (!isTidyTree || tidyColorMode === 'schema') return schema.labelStyles?.color ?? '#111';
        const override = typeof tidyCfg.linkStroke === 'string' ? tidyCfg.linkStroke.trim() : '';
        return override || '#555';
      })();
      labelsSelRef.current.attr('font-size', labelFontSize).attr('fill', labelFill);
      if (isTidyTree && tidyColorMode === 'observable') {
        labelsSelRef.current
          .attr('paint-order', 'stroke')
          .attr('stroke', haloColor)
          .attr('stroke-width', haloWidth)
          .attr('stroke-linejoin', 'round');
      } else {
        labelsSelRef.current.attr('paint-order', null).attr('stroke', null).attr('stroke-width', null).attr('stroke-linejoin', null);
      }
      if (!isTidyTree) {
        labelsSelRef.current
          .attr('dx', (schema.labelStyles?.offset?.dx ?? 12))
          .attr('dy', (schema.labelStyles?.offset?.dy ?? 4));
      } else {
        const visibleMode = schema.performance?.lod?.tidyTree?.labelMode ?? 'auto';
        if (visibleMode === 'none') {
          labelsSelRef.current.attr('opacity', 0).attr('pointer-events', 'none');
        } else {
          labelsSelRef.current.attr('opacity', 1).attr('pointer-events', null);
        }
      }
    }
  }, [schema, nodesSelRef, linksSelRef, labelsSelRef]);
}
