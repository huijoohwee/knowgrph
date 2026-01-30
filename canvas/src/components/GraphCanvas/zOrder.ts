import * as d3 from 'd3'

type GSelection = d3.Selection<SVGGElement, unknown, null, undefined>

export function applyGraphCanvasZOrder(g: GSelection) {
  g.selectAll('[data-kg-layer="groups"]').lower()
  g.selectAll('[data-kg-layer="links-hit"]').raise()
  g.selectAll('[data-kg-layer="links"]').raise()
  g.selectAll('[data-kg-layer="edge-labels"]').raise()
  g.selectAll('[data-kg-layer="temp-link"]').raise()
  g.selectAll('[data-kg-layer="nodes"]').raise()
  g.selectAll('[data-kg-layer="node-chevrons"]').raise()
  g.selectAll('[data-kg-layer="media"]').raise()
  g.selectAll('[data-kg-layer="port-handles"]').raise()
  g.selectAll('[data-kg-layer="labels"]').raise()
  g.selectAll('[data-kg-layer="group-labels"]').raise()
}
