import * as d3 from 'd3'
import type { GraphEdge } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { HoverInfo } from '@/components/GraphHoverTooltip'
import { estimateMaxCharsForWidthPx, truncateTextWithEllipsis } from '@/components/GraphCanvas/layout/utils'
import { attachEdgeInteractionHandlers } from '@/components/GraphCanvas/layers/edgeInteractions'

type GSelection = d3.Selection<SVGGElement, unknown, null, undefined>

export const createEdgeLabelsLayer = (args: {
  g: GSelection
  edgesForDisplay: GraphEdge[]
  schema: GraphSchema
  hoverEnabled: boolean
  setHoverInfo: (updater: (prev: HoverInfo | null) => HoverInfo | null) => void
  setSelectionSource: (src: 'menu' | 'canvas' | 'toolbar' | 'editor' | 'unknown') => void
  selectEdge: (id: string | null) => void
}): d3.Selection<SVGTextElement, GraphEdge, SVGGElement, unknown> | null => {
  const { g, edgesForDisplay, schema, hoverEnabled, setHoverInfo, setSelectionSource, selectEdge } = args
  const edges = Array.isArray(edgesForDisplay) ? edgesForDisplay.filter(e => String(e.label || '').trim()) : []
  if (edges.length === 0) return null
  if (edges.length > 600) return null

  const fontSizeRaw = schema.labelStyles?.fontSize
  const fontSize = typeof fontSizeRaw === 'number' && Number.isFinite(fontSizeRaw) && fontSizeRaw > 0 ? fontSizeRaw : 12
  const maxChars = Math.max(6, Math.min(60, estimateMaxCharsForWidthPx(160, fontSize)))

  const root = g.append('g').attr('data-kg-layer', 'edge-labels')
  const labelSel = root
    .selectAll<SVGTextElement, GraphEdge>('text')
    .data(edges, d => String(d.id))
    .enter()
    .append('text')
    .attr('data-kg-edge-label', '1')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .style('user-select', 'none')
    .style('pointer-events', 'all')
    .text(d => truncateTextWithEllipsis(String(d.label || ''), maxChars))
    .each(function (d) {
      this.setAttribute('data-label-full', String(d.label || ''))
    })

  attachEdgeInteractionHandlers(labelSel as unknown as d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown>, {
    hoverEnabled,
    setHoverInfo,
    setSelectionSource,
    selectEdge,
  })

  return labelSel
}
