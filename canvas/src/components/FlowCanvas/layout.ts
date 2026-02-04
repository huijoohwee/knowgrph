import dagre from 'dagre'

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
  nodeSize?: { widthPx: number; heightPx: number }
}): Record<string, { x: number; y: number }> {
  const widthPx = Math.max(1, Math.floor(args.nodeSize?.widthPx ?? 180))
  const heightPx = Math.max(1, Math.floor(args.nodeSize?.heightPx ?? 48))
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: args.rankdir })
  g.setDefaultEdgeLabel(() => ({}))

  for (let i = 0; i < args.nodes.length; i += 1) {
    const id = String(args.nodes[i].id)
    if (!id) continue
    g.setNode(id, { width: widthPx, height: heightPx })
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
      x: n.x - widthPx / 2,
      y: n.y - heightPx / 2,
    }
  })
  return out
}

export function buildFastGridLayout(args: {
  nodes: ReadonlyArray<{ id: string }>
  nodeSize?: { widthPx: number; heightPx: number }
  paddingPx?: number
  maxCols?: number
}): Record<string, { x: number; y: number }> {
  const widthPx = Math.max(1, Math.floor(args.nodeSize?.widthPx ?? 180))
  const heightPx = Math.max(1, Math.floor(args.nodeSize?.heightPx ?? 48))
  const paddingPx = Math.max(0, Math.floor(args.paddingPx ?? 40))
  const nodes = Array.isArray(args.nodes) ? args.nodes : []
  const n = nodes.length
  if (n === 0) return {}

  const maxColsRaw = typeof args.maxCols === 'number' && Number.isFinite(args.maxCols) ? Math.floor(args.maxCols) : 0
  const cols = Math.max(1, Math.min(maxColsRaw || Math.ceil(Math.sqrt(n)), 200))
  const cellW = widthPx + paddingPx
  const cellH = heightPx + paddingPx

  const out: Record<string, { x: number; y: number }> = {}
  for (let i = 0; i < n; i += 1) {
    const id = String(nodes[i].id || '').trim()
    if (!id) continue
    const col = i % cols
    const row = Math.floor(i / cols)
    out[id] = {
      x: col * cellW,
      y: row * cellH,
    }
  }
  return out
}
