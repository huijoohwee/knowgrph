import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { normalizeFlowchartApiGraphData, parseFlowchartApiGraphPayload } from '@/lib/flowchart'
import { buildFlowchartApiMetaUrl, buildFlowchartApiUrl, buildFlowchartSourceMeta } from '@/lib/flowchart/source'
import { readSubgraphs } from '@/lib/graph/subgraphs'

export function testFlowchartNormalizeKeepsNeutralSourceMetadata() {
  const payload = parseFlowchartApiGraphPayload({
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
  if (!payload) throw new Error('expected flowchart payload to parse')

  const graph = normalizeFlowchartApiGraphData({
    payload,
    sourceMeta: buildFlowchartSourceMeta({ kind: 'api', apiRunId: 'published-run' }),
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
  if (edgeProps['flowchart:edgeRole'] !== 'cross') {
    throw new Error(`expected cross edge role, got ${String(edgeProps['flowchart:edgeRole'] || '')}`)
  }
  if (edgeProps['flowchart:source'] !== 'api:published-run') {
    throw new Error(`expected edge source api:published-run, got ${String(edgeProps['flowchart:source'] || '')}`)
  }
  if ('api:source' in edgeProps) {
    throw new Error('expected legacy api:source property to be removed')
  }
}

export function testFlowchartNormalizeAcceptsSideAliases() {
  const payload = parseFlowchartApiGraphPayload({
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

  const graph = normalizeFlowchartApiGraphData({
    payload,
    sourceMeta: buildFlowchartSourceMeta({ kind: 'workspace', documentName: 'neutral-board.json' }),
  })

  const nodeById = new Map(graph.nodes.map(node => [String(node.id), node]))
  if (String(nodeById.get('member-a')?.type || '') !== 'problem') {
    throw new Error(`expected member-a to normalize to problem, got ${String(nodeById.get('member-a')?.type || '')}`)
  }
  if (String(nodeById.get('member-b')?.type || '') !== 'solution') {
    throw new Error(`expected member-b to normalize to solution, got ${String(nodeById.get('member-b')?.type || '')}`)
  }
  const memberAProps = (nodeById.get('member-a')?.properties || {}) as Record<string, unknown>
  if (memberAProps['flowchart:side'] !== 'problem') {
    throw new Error(`expected member-a side problem, got ${String(memberAProps['flowchart:side'] || '')}`)
  }
  if (memberAProps['flowchart:sourceKind'] !== 'workspace') {
    throw new Error(`expected workspace sourceKind, got ${String(memberAProps['flowchart:sourceKind'] || '')}`)
  }

  const spokeEdge = graph.edges.find(edge => String((edge.properties || {})['flowchart:edgeRole'] || '') === 'spoke')
  if (!spokeEdge) throw new Error('expected spoke edge to be preserved')
  const meta = (graph.metadata || {}) as Record<string, unknown>
  if (meta.graphKind !== 'flowchart') {
    throw new Error(`expected graphKind flowchart, got ${String(meta.graphKind || '')}`)
  }
}

export function testFlowchartParserReusesSharedPlainObjectGuard() {
  const filePath = resolve(process.cwd(), 'src', 'lib', 'flowchart', 'apiGraphFlowchart.impl.ts')
  const text = readFileSync(filePath, 'utf8')
  if (!text.includes("const readPlainObject = (value: unknown): Record<string, unknown> | null => {")) {
    throw new Error('expected flowchart parser to centralize plain-object coercion in one local helper')
  }
  if (!text.includes('const meta = readPlainObject(obj.meta)')) {
    throw new Error('expected flowchart payload metadata reads to reuse the shared local plain-object helper')
  }
  if (!text.includes('const c = readPlainObject(clustersRaw[i])')) {
    throw new Error('expected flowchart cluster reads to reuse the shared local plain-object helper')
  }
  if (!text.includes('const o = readPlainObject(n)')) {
    throw new Error('expected flowchart node reads to reuse the shared local plain-object helper')
  }
  if (!text.includes('const o = readPlainObject(e)')) {
    throw new Error('expected flowchart edge reads to reuse the shared local plain-object helper')
  }
  if (!text.includes('const clusterGapRatiosRaw = readPlainObject(meta?.cluster_gap_ratios)')) {
    throw new Error('expected flowchart cluster gap ratio reads to reuse the shared local plain-object helper')
  }
  if (text.includes("typeof obj.meta === 'object' && !Array.isArray(obj.meta)")) {
    throw new Error('expected flowchart parser to stop coercing payload metadata objects inline')
  }
}

export function testFlowchartNormalizeReadsNestedClusterGapRatioObjects() {
  const payload = parseFlowchartApiGraphPayload({
    nodes: [
      { id: 'problem-1', type: 'problem', label: 'Problem 1', cluster: 'Alpha' },
      { id: 'problem-2', type: 'problem', label: 'Problem 2', cluster: 'Alpha' },
      { id: 'solution-1', type: 'solution', label: 'Solution 1', cluster: 'Beta' },
      { id: 'hub-1', type: 'hub', label: 'Hub 1', cluster: 'Alpha', hub: 'hub-1' },
    ],
    edges: [
      { source: 'problem-1', target: 'solution-1', strength: 0.6 },
      { hub_id: 'hub-1', member_id: 'problem-1', type: 'ownership' },
    ],
    meta: {
      cluster_gap_ratios: {
        Alpha: {
          ratio: 0.82,
          side: 'source',
        },
      },
    },
    clusters: [
      { id: 'Alpha', name: 'Alpha', side: 'left' },
      { id: 'Beta', name: 'Beta', side: 'right' },
    ],
  })
  if (!payload) throw new Error('expected nested cluster gap ratio payload to parse')

  const graph = normalizeFlowchartApiGraphData({
    payload,
    settings: { showClusterGapRatio: true },
    sourceMeta: buildFlowchartSourceMeta({ kind: 'fixture' }),
  })

  const alphaCluster = readSubgraphs(graph).find(entry => String(entry.id || '') === 'flowchart:problem:Alpha') || null
  if (!alphaCluster) throw new Error('expected problem cluster subgraph for Alpha')
  if (String(alphaCluster.label || '') !== 'Alpha • 82% gap') {
    throw new Error(`expected nested gap ratio object to drive problem cluster label, got ${String(alphaCluster.label || '')}`)
  }
}

export function testFlowchartApiUrlsStaySharedAcrossRuntimeAndDataFetches() {
  const runtimeUrl = buildFlowchartApiMetaUrl()
  if (runtimeUrl !== '/api/graph?view=meta') {
    throw new Error(`expected shared runtime meta url, got ${runtimeUrl}`)
  }

  const runUrl = buildFlowchartApiUrl({ apiRunId: 'year-series-2026' })
  if (runUrl !== '/api/graph?run=year-series-2026') {
    throw new Error(`expected run url to reuse shared api endpoint, got ${runUrl}`)
  }

  const sourceMeta = buildFlowchartSourceMeta({ kind: 'api', apiRunId: 'year-series-2026' })
  if (sourceMeta.endpoint !== runUrl) {
    throw new Error(`expected source meta endpoint to match shared run url, got ${String(sourceMeta.endpoint || '')}`)
  }
}
