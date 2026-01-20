import * as d3 from 'd3';
import type { MutableRefObject } from 'react';
import type { GraphNode } from '@/lib/graph/types';
import type { GraphSchema } from '@/lib/graph/schema';
import { wrapTextByMaxChars, truncateTextWithEllipsis, estimateMaxCharsForWidthPx } from '@/components/GraphCanvas/layout/utils'
import { getNodeRectDimensions2d, getNodeRenderShape2d } from '@/components/GraphCanvas/nodeSizing2d'

type GSelection = d3.Selection<SVGGElement, unknown, null, undefined>;

export const createLabelsLayer = (args: {
  g: GSelection;
  nodes: GraphNode[];
  schema: GraphSchema;
  labelsSelRef: MutableRefObject<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>;
}) => {
  const { g, nodes: rawNodes, schema, labelsSelRef } = args;

  const nodes = rawNodes;

  const labelLayer = g.append('g').attr('data-kg-layer', 'labels');
  
  const labelFontSize = schema.labelStyles?.fontSize ?? 12;
  const labelFontFamily = 'Inter, sans-serif';
  const labelFill = schema.labelStyles?.color || '#111111';
  const haloColor = schema.labelStyles?.halo?.color ?? '#ffffff';
  const haloWidthRaw = schema.labelStyles?.halo?.width;
  const haloWidth = typeof haloWidthRaw === 'number' && Number.isFinite(haloWidthRaw) && haloWidthRaw > 0 ? haloWidthRaw : 3;
  const baseDx = schema.labelStyles?.offset?.dx ?? 12;
  const lineHeightPx = labelFontSize * 1.2;

  const label = labelLayer
    .selectAll<SVGTextElement, GraphNode>('text')
    .data(nodes)
    .enter()
    .append('text')
    .attr('class', 'node-label')
    .attr('font-size', labelFontSize)
    .attr('font-family', labelFontFamily)
    .attr('fill', labelFill)
    .attr('data-lod-hidden', '0')
    .attr('data-zoom-lod-hidden', '0')
    .attr('dx', (d: GraphNode) => {
       if (getNodeRenderShape2d(d, schema) === 'rect') return 0
       return schema.labelStyles?.offset?.dx ?? 12
    })
    .attr('dy', (d: GraphNode) => {
        if (getNodeRenderShape2d(d, schema) === 'rect') return 0
        return schema.labelStyles?.offset?.dy ?? 4
    })
    .attr('data-base-anchor', 'middle')
    .attr('data-base-dx', (d: GraphNode) => {
       if (getNodeRenderShape2d(d, schema) === 'rect') return '0'
       return String(baseDx)
    })
    .attr('data-base-dy', (d: GraphNode) => {
        if (getNodeRenderShape2d(d, schema) === 'rect') return '0'
        return String(schema.labelStyles?.offset?.dy ?? 4);
    })
    .attr('dominant-baseline', (d: GraphNode) => {
         if (getNodeRenderShape2d(d, schema) === 'rect') return 'middle'
         return null
    })
    .attr('text-anchor', 'middle')
    .attr('paint-order', 'stroke')
    .attr('stroke', haloColor)
    .attr('stroke-width', haloWidth)
    .attr('stroke-linejoin', 'round')
    .style('pointer-events', 'none');

    const maxCharsPerLine = Math.max(8, Math.min(34, estimateMaxCharsForWidthPx(180, labelFontSize)));
    const compactChars = Math.max(6, Math.min(18, Math.floor(maxCharsPerLine * 0.55)));
    
    label.each(function (d: GraphNode) {
      const el = d3.select(this)
      const baseLabel = String(d.label || d.id || '')
      const isRect = getNodeRenderShape2d(d, schema) === 'rect'
      
      let wrapped = ''
      let visibleLines: string[] = []
      
      if (isRect) {
         const { width, height } = getNodeRectDimensions2d(d, schema)
         const padX = 8
         const padY = 4
         const availW = Math.max(8, width - padX * 2)
         const availH = Math.max(8, height - padY * 2)
         const maxChars = Math.max(4, Math.min(80, estimateMaxCharsForWidthPx(availW, labelFontSize)))
         
         wrapped = wrapTextByMaxChars(baseLabel, maxChars)
         const lines = String(wrapped).replace(/\r\n?/g, '\n').split('\n')
         const maxLines = Math.floor(availH / lineHeightPx)
         
         if (lines.length > maxLines) {
           visibleLines = lines.slice(0, Math.max(1, maxLines))
           const last = visibleLines[visibleLines.length - 1]
           visibleLines[visibleLines.length - 1] = last.endsWith('…') ? last : last + '…'
         } else {
           visibleLines = lines
         }
      } else {
         wrapped = wrapTextByMaxChars(baseLabel, maxCharsPerLine)
         visibleLines = String(wrapped).replace(/\r\n?/g, '\n').split('\n')
      }

      const compact = truncateTextWithEllipsis(baseLabel, compactChars)
      const lineCount = Math.max(1, visibleLines.length)
      let maxLen = 0
      for (let i = 0; i < visibleLines.length; i += 1) {
        const len = visibleLines[i].length
        if (len > maxLen) maxLen = len
      }

      const dy0 = -((Math.max(1, lineCount) - 1) / 2) * lineHeightPx
      
      el
        .attr('data-label-mode', 'wrap')
        .attr('data-label-full', baseLabel)
        .attr('data-label-wrap', wrapped)
        .attr('data-label-compact', compact)
        .attr('data-label-linecount', String(lineCount))
        .attr('data-label-maxlen', String(maxLen))
      el.text(null)
      for (let i = 0; i < visibleLines.length; i += 1) {
        el.append('tspan').attr('x', isRect ? 0 : null).attr('dy', i === 0 ? `${dy0}px` : `${lineHeightPx}px`).text(visibleLines[i])
      }
    })

  labelsSelRef.current = label;
};
