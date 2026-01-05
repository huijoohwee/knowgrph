import * as d3 from 'd3';
import { GraphNode } from '@/lib/graph/types';
import { GraphSchema } from '@/lib/graph/schema';

export const createZoom = (
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  labelsSelRef: React.MutableRefObject<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>,
  schema: GraphSchema,
  onZoomTransform?: (t: { k: number; x: number; y: number }) => void,
  onLabelLodVisibilityChange?: (hidden: boolean) => void,
) => {
  let lastOpacityTs = 0;
  let lastHidden: boolean | null = null;
  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 4])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
      const now = Date.now();
      const transform = event.transform as d3.ZoomTransform;
      const k = transform.k || 1;
      const hideBelow = schema.performance?.lod?.hideLabelsBelowScale ?? 0;
      const hidden = hideBelow > 0 && k < hideBelow;
      if (!lastOpacityTs || now - lastOpacityTs > 16) {
        lastOpacityTs = now;
        if (hidden !== lastHidden) {
          lastHidden = hidden;
          if (labelsSelRef.current) {
            labelsSelRef.current.attr('data-zoom-lod-hidden', hidden ? '1' : '0');
          }
          if (onLabelLodVisibilityChange) onLabelLodVisibilityChange(hidden);
        }
      }
      if (onZoomTransform) {
        onZoomTransform({ k: transform.k ?? 1, x: transform.x ?? 0, y: transform.y ?? 0 });
      }
    });
  svg.call(zoom);
  return zoom;
};
