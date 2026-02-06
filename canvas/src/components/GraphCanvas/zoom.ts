import * as d3 from 'd3';
import { GraphNode } from '@/lib/graph/types';
import { GraphSchema } from '@/lib/graph/schema';
import { readZoomScaleExtent } from '@/lib/graph/layoutDefaults'
import { computeD3WheelDelta } from '@/lib/canvas/zoom-input'
import { shouldIgnoreCanvasWheelEvent } from '@/lib/canvas/wheel-target-guard'
import { UI_SELECTORS } from '@/lib/config'

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
  let lastResponsiveTs = 0
  let lastKEffective: number | null = null
  const [minScale, maxScale] = readZoomScaleExtent(schema)
  const baseFontSizeRaw = schema.labelStyles?.fontSize
  const baseFontSize = typeof baseFontSizeRaw === 'number' && Number.isFinite(baseFontSizeRaw) && baseFontSizeRaw > 0 ? baseFontSizeRaw : 12
  const haloWidthRaw = schema.labelStyles?.halo?.width
  const baseHaloWidth = typeof haloWidthRaw === 'number' && Number.isFinite(haloWidthRaw) && haloWidthRaw > 0 ? haloWidthRaw : 3
  const zoom = d3.zoom<SVGSVGElement, unknown>()
    .filter(event => {
      const anyEvent = event as unknown as { type?: unknown; ctrlKey?: unknown; button?: unknown }
      if (anyEvent.type === 'wheel') {
        if (shouldIgnoreCanvasWheelEvent({ event: event as WheelEvent, ignoreSelector: UI_SELECTORS.canvasWheelIgnore })) {
          try {
            ;(event as WheelEvent).preventDefault()
          } catch {
            void 0
          }
          try {
            ;(event as WheelEvent).stopPropagation()
          } catch {
            void 0
          }
          return false
        }
      }
      const ctrlKey = anyEvent.ctrlKey === true
      const button = typeof anyEvent.button === 'number' ? anyEvent.button : 0
      return (!ctrlKey || anyEvent.type === 'wheel') && button === 0
    })
    .scaleExtent([minScale, maxScale])
    .wheelDelta(event => computeD3WheelDelta(event as WheelEvent))
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
      const now = Date.now();
      const transform = event.transform as d3.ZoomTransform;
      const k = transform.k || 1;

      const kEffective = Math.max(1, k)
      if (!lastResponsiveTs || now - lastResponsiveTs > 16) {
        lastResponsiveTs = now
        const rounded = Math.round(kEffective * 1000) / 1000
        if (lastKEffective == null || Math.abs(rounded - lastKEffective) > 1e-9) {
          lastKEffective = rounded
          const scaledFontSize = baseFontSize / kEffective
          const scaledHaloWidth = baseHaloWidth / kEffective

          g.selectAll<SVGTextElement, unknown>('[data-kg-layer="labels"] text.node-label')
            .attr('font-size', scaledFontSize)
            .attr('stroke-width', scaledHaloWidth)
            .attr('dx', function () {
              const raw = (this as SVGTextElement).getAttribute('data-base-dx')
              const base = raw == null ? 0 : Number(raw)
              return Number.isFinite(base) ? (base / kEffective) : 0
            })
            .attr('dy', function () {
              const raw = (this as SVGTextElement).getAttribute('data-base-dy')
              const base = raw == null ? 0 : Number(raw)
              return Number.isFinite(base) ? (base / kEffective) : 0
            })

          g.selectAll<SVGTextElement, unknown>('[data-kg-layer="group-labels"] text')
            .attr('font-size', scaledFontSize)
            .attr('stroke-width', Math.max(2 / kEffective, scaledHaloWidth * 0.85))

          g.selectAll<SVGTextElement, unknown>('[data-kg-layer="edge-labels"] text')
            .attr('font-size', Math.max(9 / kEffective, (baseFontSize * 0.9) / kEffective))
            .attr('stroke-width', Math.max(2 / kEffective, scaledHaloWidth * 0.85))
        }
      }

      const hideBelow = schema.performance?.lod?.hideLabelsBelowScale ?? 0;
      const hidden = hideBelow > 0 && k < hideBelow;
      if (!lastOpacityTs || now - lastOpacityTs > 16) {
        lastOpacityTs = now;
        if (hidden !== lastHidden) {
          lastHidden = hidden;
          if (labelsSelRef.current) {
            labelsSelRef.current.attr('data-zoom-lod-hidden', hidden ? '1' : '0');
          }
          g.selectAll('[data-kg-layer="group-labels"]').style('display', hidden ? 'none' : '')
          g.selectAll('[data-kg-layer="edge-labels"]').style('display', hidden ? 'none' : '')
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
