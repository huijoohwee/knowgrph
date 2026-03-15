import * as d3 from 'd3'
import type { GraphNode } from '@/lib/graph/types'
import { UI_THEME_COLORS_CSS } from '@/lib/ui/theme-tokens'

export const createNodeGroupChevronSel = (args: {
  g: d3.Selection<SVGGElement, unknown, null, undefined>
  nodes: GraphNode[]
}) => {
  const groupNodes = args.nodes.filter(n => {
    const props = (n.properties || {}) as Record<string, unknown>
    const groupId = typeof props['kg:groupId'] === 'string' ? String(props['kg:groupId'] || '').trim() : ''
    return !!groupId
  })
  if (groupNodes.length === 0) return null
  const layer = args.g.append('g').attr('data-kg-layer', 'node-chevrons')
  return layer
    .selectAll<SVGPathElement, GraphNode>('path[data-kg-node-chevron]')
    .data(groupNodes, d => String(d.id))
    .enter()
    .append('path')
    .attr('data-kg-node-chevron', '1')
    .attr('data-node-id', d => String(d.id))
    .attr('fill', 'none')
    .attr('stroke', UI_THEME_COLORS_CSS.textSecondary)
    .attr('stroke-width', 1.75)
    .attr('stroke-linecap', 'round')
    .attr('stroke-linejoin', 'round')
    .style('pointer-events', 'all')
    .style('cursor', 'pointer') as unknown as d3.Selection<SVGPathElement, GraphNode, SVGGElement, unknown>
}

