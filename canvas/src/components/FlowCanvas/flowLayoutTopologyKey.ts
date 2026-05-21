import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'

export function buildFlowLayoutTopologyKey(args: {
  semanticGraphKey: string
  nodes: Array<{ id?: unknown }>
  edges: Array<{ source?: unknown; target?: unknown; label?: unknown }>
}): string {
  const nodeIds = args.nodes
    .map(n => String(n?.id || '').trim())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))
  const edgeIds = args.edges
    .map(e => {
      const source = String(e?.source || '').trim()
      const target = String(e?.target || '').trim()
      const label = String(e?.label || '').trim()
      return source || target ? `${source}->${target}:${label}` : ''
    })
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b))

  return buildScopedGraphSemanticKey('flow-layout-topology', {
    graphSemanticKey: [
      args.semanticGraphKey,
      `n=${args.nodes.length}`,
      `e=${args.edges.length}`,
      nodeIds.join(','),
      edgeIds.join(','),
    ].join('|'),
  })
}
