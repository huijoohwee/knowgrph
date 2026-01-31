import dagre from 'dagre'

export const FLOW_NODE_W = 180
export const FLOW_NODE_H = 48

export function buildGraphMetaKey(graph: { metadata?: unknown } | null): string {
  const meta = graph?.metadata
  if (!meta || typeof meta !== 'object') return ''
  const rec = meta as Record<string, unknown>
  return `${String(rec.kind ?? '')}:${String(rec.source ?? '')}`
}

export function deriveRankdir(args: { schemaOrientation: unknown }): 'TB' | 'LR' {
  const o = args.schemaOrientation
  if (o === 'horizontal') return 'LR'
  return 'TB'
}

export function buildDagreLayout(args: {
  nodes: ReadonlyArray<{ id: string }>
  edges: ReadonlyArray<{ source: string; target: string }>
  rankdir: 'TB' | 'LR'
}): Record<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: args.rankdir })
  g.setDefaultEdgeLabel(() => ({}))

  for (let i = 0; i < args.nodes.length; i += 1) {
    const id = String(args.nodes[i].id)
    if (!id) continue
    g.setNode(id, { width: FLOW_NODE_W, height: FLOW_NODE_H })
  }
  for (let i = 0; i < args.edges.length; i += 1) {
    const e = args.edges[i]
    const s = String(e.source)
    const t = String(e.target)
    if (!s || !t) continue
    if (!g.node(s) || !g.node(t)) continue
    g.setEdge(s, t)
  }

  dagre.layout(g)

  const out: Record<string, { x: number; y: number }> = {}
  g.nodes().forEach(id => {
    const n = g.node(id) as { x: number; y: number } | undefined
    if (!n) return
    if (!Number.isFinite(n.x) || !Number.isFinite(n.y)) return
    out[String(id)] = {
      x: n.x - FLOW_NODE_W / 2,
      y: n.y - FLOW_NODE_H / 2,
    }
  })
  return out
}
