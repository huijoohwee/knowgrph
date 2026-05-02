import * as d3 from 'd3'
import type { GraphEdge } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { HoverInfo } from '@/components/GraphHoverTooltip'
import { estimateMaxCharsForWidthPx, truncateTextWithEllipsis } from '@/components/GraphCanvas/layout/utils'
import { attachEdgeInteractionHandlers } from '@/components/GraphCanvas/layers/edgeInteractions'
import { getEdgeLabelForDisplay } from '@/components/GraphCanvas/edgeDisplay'
import { getEdgeLabelColor } from '@/components/GraphCanvas/helpers'
import { readEdgeEndpointId } from '@/lib/graph/edgeEndpoints'

type GSelection = d3.Selection<SVGGElement, unknown, null, undefined>

function coerceEdgeId(v: unknown): string {
  if (typeof v === 'string' || typeof v === 'number') return String(v)
  return ''
}

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

  const edgeLabelForDisplay = (e: GraphEdge): string => getEdgeLabelForDisplay(e)
  const edges = Array.isArray(edgesForDisplay)
    ? edgesForDisplay.filter(e => edgeLabelForDisplay(e))
    : []
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
    .attr('data-edge-id', (d: GraphEdge) => coerceEdgeId((d as any).id))
    .attr('data-source-id', (d: GraphEdge) => readEdgeEndpointId((d as any).source))
    .attr('data-target-id', (d: GraphEdge) => readEdgeEndpointId((d as any).target))
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .style('user-select', 'none')
    .style('pointer-events', 'all')
    .attr('data-kg-label-fill', d => getEdgeLabelColor(d, schema))
    .attr('fill', d => getEdgeLabelColor(d, schema))
    .text(d => truncateTextWithEllipsis(edgeLabelForDisplay(d), maxChars))
    .each(function (d) {
      this.setAttribute('data-label-full', edgeLabelForDisplay(d))
    })

  attachEdgeInteractionHandlers(labelSel as unknown as d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown>, {
    hoverEnabled,
    setHoverInfo,
    setSelectionSource,
    selectEdge,
  })

  return labelSel
}
