import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { buildSelectionSubgraph, buildSelectionSubgraphForIds } from '@/lib/graph/file'
import type { GraphData } from '@/lib/graph/types'

function makeGraph(): GraphData {
  return {
    type: 'Graph',
    nodes: [
      { id: 'a', label: 'A', type: 'node', properties: {} },
      { id: 'b', label: 'B', type: 'node', properties: {} },
      { id: 'c', label: 'C', type: 'node', properties: {} },
    ],
    edges: [
      { id: 'ab', source: 'a', target: 'b', label: 'ab', properties: {} },
      { id: 'bc', source: 'b', target: 'c', label: 'bc', properties: {} },
    ],
  }
}

export function testSelectionSubgraphForIdsPreservesNeighborhoodBehavior() {
  const graph = makeGraph()

  const byNode = buildSelectionSubgraphForIds(graph, ['b'], [])
  if (!byNode) throw new Error('expected node-centered selection subgraph')
  const byNodeNodeIds = byNode.nodes.map(node => String(node.id)).join(',')
  const byNodeEdgeIds = byNode.edges.map(edge => String(edge.id)).join(',')
  if (byNodeNodeIds !== 'a,b,c') {
    throw new Error(`expected node selection neighborhood to include incident endpoints, got ${byNodeNodeIds}`)
  }
  if (byNodeEdgeIds !== 'ab,bc') {
    throw new Error(`expected node selection neighborhood to include incident edges, got ${byNodeEdgeIds}`)
  }

  const byEdge = buildSelectionSubgraph(graph, null, 'ab')
  if (!byEdge) throw new Error('expected edge-centered selection subgraph')
  const byEdgeNodeIds = byEdge.nodes.map(node => String(node.id)).join(',')
  const byEdgeEdgeIds = byEdge.edges.map(edge => String(edge.id)).join(',')
  if (byEdgeNodeIds !== 'a,b') {
    throw new Error(`expected edge selection to include edge endpoints, got ${byEdgeNodeIds}`)
  }
  if (byEdgeEdgeIds !== 'ab') {
    throw new Error(`expected edge selection to keep the selected edge only, got ${byEdgeEdgeIds}`)
  }
}

export function testSelectionSubgraphSsotReusesSharedLookupAndSemanticCache() {
  const selectionSubgraphText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'graph', 'selectionSubgraph.ts'), 'utf8')
  const selectionInspectorText = readFileSync(
    resolve(process.cwd(), 'src', 'features', 'graph-inspector', 'ui', 'GraphRecordSelectionInspector.tsx'),
    'utf8',
  )
  const datasetInspectorText = readFileSync(
    resolve(process.cwd(), 'src', 'features', 'panels', 'views', 'DatasetInspectorSection.tsx'),
    'utf8',
  )
  const statsSelectionText = readFileSync(
    resolve(process.cwd(), 'src', 'features', 'graph-stats', 'hooks', 'useStatsSelection.ts'),
    'utf8',
  )

  if (
    !selectionSubgraphText.includes("const selectionSubgraphCache = new Map<string, GraphData | null>()")
    || !selectionSubgraphText.includes("buildScopedGraphSemanticKey('graph-file-selection-subgraph'")
    || !selectionSubgraphText.includes("cacheScope: 'graph-file-selection-subgraph-lookup'")
    || !selectionSubgraphText.includes('const edgeById = graphLookup?.edgeById')
    || !selectionSubgraphText.includes('const incidentEdgesByNodeId = graphLookup?.incidentEdgesByNodeId')
  ) {
    throw new Error('expected selection subgraph SSOT to reuse shared graph lookups and semantic-keyed caching instead of rebuilding node and edge maps per caller')
  }

  if (
    !selectionInspectorText.includes('buildFallbackInspectorRow(')
    || !selectionInspectorText.includes('baseGraphLookup.edgeById.get(rowId)')
    || !selectionInspectorText.includes('baseGraphLookup.nodeById.get(rowId)')
    || selectionInspectorText.includes('nodes.find(')
    || selectionInspectorText.includes('edges.find(')
  ) {
    throw new Error('expected GraphRecordSelectionInspector fallback rows to reuse the shared base graph lookup instead of scanning raw arrays')
  }

  if (
    !datasetInspectorText.includes('readSelectionSubgraphMembershipForAnchorIds(graph, selectionAnchorIds)')
    || !datasetInspectorText.includes('const selectionSubgraph = selectionMembership?.subgraph ?? null')
    || datasetInspectorText.includes('buildSelectionSubgraphForAnchorIds(')
  ) {
    throw new Error('expected DatasetInspectorSection to reuse the shared selection membership subgraph instead of rebuilding local selection subgraphs')
  }

  if (
    !statsSelectionText.includes('readSelectionSubgraphMembershipForAnchorIds(graph, selectionAnchorIds)')
    || !statsSelectionText.includes('const selectionSubgraph = selectionMembership?.subgraph ?? null')
    || statsSelectionText.includes('buildSelectionSubgraphForAnchorIds(')
  ) {
    throw new Error('expected useStatsSelection to reuse the shared selection membership subgraph instead of rebuilding local selection subgraphs')
  }
}
