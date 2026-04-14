import { normalizeBipartiteApiGraphData, parseBipartiteApiGraphPayload } from '@/features/bipartite/apiGraphBipartite'
import { buildBipartiteApiMetaUrl, buildBipartiteApiUrl, buildBipartiteSourceMeta } from '@/lib/bipartite/source'

export function testBipartiteNormalizeKeepsNeutralSourceMetadata() {
  const payload = parseBipartiteApiGraphPayload({
    nodes: [
      { id: 'left-1', type: 'problem', label: 'Backlog item', cluster: 'left-cluster' },
      { id: 'right-1', type: 'solution', label: 'Delivery path', cluster: 'right-cluster' },
    ],
    edges: [{ source: 'left-1', target: 'right-1', strength: 0.7 }],
    clusters: [
      { id: 'left-cluster', name: 'Left cluster', side: 'problem' },
      { id: 'right-cluster', name: 'Right cluster', side: 'solution' },
    ],
  })
  if (!payload) throw new Error('expected bipartite payload to parse')

  const graph = normalizeBipartiteApiGraphData({
    payload,
    sourceMeta: buildBipartiteSourceMeta({ kind: 'api', apiRunId: 'published-run' }),
  })

  const meta = (graph.metadata || {}) as Record<string, unknown>
  if (meta.source !== 'api:published-run') {
    throw new Error(`expected neutral source id api:published-run, got ${String(meta.source || '')}`)
  }
  if (meta.sourceKind !== 'api') {
    throw new Error(`expected sourceKind api, got ${String(meta.sourceKind || '')}`)
  }
  if (graph.context !== 'api:published-run') {
    throw new Error(`expected graph context api:published-run, got ${String(graph.context || '')}`)
  }

  const edge = graph.edges?.[0]
  if (!edge) throw new Error('expected one normalized edge')
  const edgeProps = (edge.properties || {}) as Record<string, unknown>
  if (edgeProps['bipartite:edgeRole'] !== 'cross') {
    throw new Error(`expected cross edge role, got ${String(edgeProps['bipartite:edgeRole'] || '')}`)
  }
  if (edgeProps['bipartite:source'] !== 'api:published-run') {
    throw new Error(`expected edge source api:published-run, got ${String(edgeProps['bipartite:source'] || '')}`)
  }
  if ('api:source' in edgeProps) {
    throw new Error('expected legacy api:source property to be removed')
  }
}

export function testBipartiteNormalizeAcceptsSideAliases() {
  const payload = parseBipartiteApiGraphPayload({
    nodes: [
      { id: 'member-a', type: 'left', label: 'Signal A', cluster: 'alpha' },
      { id: 'member-b', type: 'destination', label: 'Signal B', cluster: 'beta' },
      { id: 'hub-a', type: 'hub', label: 'Hub A', cluster: 'alpha', hub: 'hub-a' },
    ],
    edges: [
      { source: 'member-a', target: 'member-b', strength: 0.4 },
      { hub_id: 'hub-a', member_id: 'member-a', type: 'ownership' },
    ],
    clusters: [
      { id: 'alpha', name: 'Alpha', side: 'source' },
      { id: 'beta', name: 'Beta', side: 'right' },
    ],
  })
  if (!payload) throw new Error('expected alias payload to parse')

  const graph = normalizeBipartiteApiGraphData({
    payload,
    sourceMeta: buildBipartiteSourceMeta({ kind: 'workspace', documentName: 'neutral-board.json' }),
  })

  const nodeById = new Map(graph.nodes.map(node => [String(node.id), node]))
  if (String(nodeById.get('member-a')?.type || '') !== 'problem') {
    throw new Error(`expected member-a to normalize to problem, got ${String(nodeById.get('member-a')?.type || '')}`)
  }
  if (String(nodeById.get('member-b')?.type || '') !== 'solution') {
    throw new Error(`expected member-b to normalize to solution, got ${String(nodeById.get('member-b')?.type || '')}`)
  }
  const memberAProps = (nodeById.get('member-a')?.properties || {}) as Record<string, unknown>
  if (memberAProps['bipartite:side'] !== 'problem') {
    throw new Error(`expected member-a side problem, got ${String(memberAProps['bipartite:side'] || '')}`)
  }
  if (memberAProps['bipartite:sourceKind'] !== 'workspace') {
    throw new Error(`expected workspace sourceKind, got ${String(memberAProps['bipartite:sourceKind'] || '')}`)
  }

  const spokeEdge = graph.edges.find(edge => String((edge.properties || {})['bipartite:edgeRole'] || '') === 'spoke')
  if (!spokeEdge) throw new Error('expected spoke edge to be preserved')
  const meta = (graph.metadata || {}) as Record<string, unknown>
  if (meta.graphKind !== 'bipartite') {
    throw new Error(`expected graphKind bipartite, got ${String(meta.graphKind || '')}`)
  }
}

export function testBipartiteApiUrlsStaySharedAcrossRuntimeAndDataFetches() {
  const runtimeUrl = buildBipartiteApiMetaUrl()
  if (runtimeUrl !== '/api/graph?view=meta') {
    throw new Error(`expected shared runtime meta url, got ${runtimeUrl}`)
  }

  const runUrl = buildBipartiteApiUrl({ apiRunId: 'year-series-2026' })
  if (runUrl !== '/api/graph?run=year-series-2026') {
    throw new Error(`expected run url to reuse shared api endpoint, got ${runUrl}`)
  }

  const sourceMeta = buildBipartiteSourceMeta({ kind: 'api', apiRunId: 'year-series-2026' })
  if (sourceMeta.endpoint !== runUrl) {
    throw new Error(`expected source meta endpoint to match shared run url, got ${String(sourceMeta.endpoint || '')}`)
  }
}
