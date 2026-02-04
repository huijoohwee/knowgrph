import * as d3 from 'd3'
import type { GraphSchema } from '@/lib/graph/schema'

type GSelection = d3.Selection<SVGGElement, unknown, null, undefined>

const DEFAULT_LAYER_ORDER: ReadonlyArray<{ id: string; rank: number }> = [
  { id: 'links', rank: -20 },
  { id: 'links-hit', rank: -15 },
  { id: 'groups', rank: -10 },
  { id: 'edge-labels', rank: 5 },
  { id: 'temp-link', rank: 7 },
  { id: 'nodes', rank: 10 },
  { id: 'node-chevrons', rank: 12 },
  { id: 'media', rank: 14 },
  { id: 'port-handles', rank: 16 },
  { id: 'labels', rank: 18 },
  { id: 'group-labels', rank: 20 },
]

const MERMAID_RENDER_ORDER_KEY_TO_LAYER_ID: Readonly<Record<string, string>> = {
  MermaidSubgraph: 'groups',
  MermaidNode: 'nodes',
  edge: 'links',
  edgeLabels: 'edge-labels',
  nodeLabels: 'labels',
}

export function applyGraphCanvasZOrder(g: GSelection, schema?: GraphSchema | null) {
  const renderOrderRaw = schema?.layout?.mermaid?.renderOrder
  const renderOrder = renderOrderRaw && typeof renderOrderRaw === 'object' && !Array.isArray(renderOrderRaw)
    ? (renderOrderRaw as Record<string, unknown>)
    : null

  const rankByLayerId: Record<string, number> = {}
  for (const x of DEFAULT_LAYER_ORDER) {
    rankByLayerId[x.id] = x.rank
  }

  if (renderOrder) {
    for (const [key, v] of Object.entries(renderOrder)) {
      if (typeof v !== 'number' || !Number.isFinite(v)) continue
      const mapped = MERMAID_RENDER_ORDER_KEY_TO_LAYER_ID[key] || key
      if (!mapped) continue
      rankByLayerId[mapped] = v
    }
  }

  const parent = g.node()
  if (!parent) return

  const layers = Object.entries(rankByLayerId)
    .map(([id, rank]) => ({
      id,
      rank,
      el: g.select(`[data-kg-layer="${id}"]`).node() as SVGGElement | null,
    }))
    .filter(x => !!x.el)
    .sort((a, b) => a.rank - b.rank)

  for (const layer of layers) {
    parent.appendChild(layer.el as SVGGElement)
  }
}
