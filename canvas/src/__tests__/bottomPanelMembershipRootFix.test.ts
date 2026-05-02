import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { readSelectionSubgraphMembershipForIds } from '@/lib/graph/file'
import { readTraversalSummaryMembership, type TraversalSummary } from '@/features/panels/utils/orchestratorTraversal'
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

export function testBottomPanelMembershipHelpersPreserveNeighborhoodAndTraversalBehavior() {
  const graph = makeGraph()
  const selectionMembership = readSelectionSubgraphMembershipForIds(graph, ['b'], [])
  if (!selectionMembership) throw new Error('expected selection membership for node-centered neighborhood')
  const selectionNodeIds = Array.from(selectionMembership.nodeIdSet).sort().join(',')
  const selectionEdgeIds = Array.from(selectionMembership.edgeIdSet).sort().join(',')
  if (selectionNodeIds !== 'a,b,c') {
    throw new Error(`expected selection membership to include incident node endpoints, got ${selectionNodeIds}`)
  }
  if (selectionEdgeIds !== 'ab,bc') {
    throw new Error(`expected selection membership to include incident edges, got ${selectionEdgeIds}`)
  }

  const traversalSummary: TraversalSummary = {
    mode: 'generic',
    startNodeId: 'a',
    maxDepth: 2,
    labelFilter: '',
    edgeIds: ['bc', 'missing', 'ab', 'bc'],
  }
  const traversalMembership = readTraversalSummaryMembership(graph, traversalSummary)
  if (!traversalMembership) throw new Error('expected traversal membership for traversal summary')
  const traversalNodeIds = Array.from(traversalMembership.nodeIdSet).sort().join(',')
  const traversalEdgeIds = traversalMembership.edgeIds.join(',')
  if (traversalNodeIds !== 'a,b,c') {
    throw new Error(`expected traversal membership to derive endpoint nodes from matched traversal edges, got ${traversalNodeIds}`)
  }
  if (traversalEdgeIds !== 'bc,missing,ab') {
    throw new Error(`expected traversal membership to preserve unique traversal edge ordering, got ${traversalEdgeIds}`)
  }
  if (traversalMembership.edgeStepById.get('ab') !== 3) {
    throw new Error('expected traversal step map to preserve summary ordering for visible edge rows')
  }
}

export function testBottomPanelVisibleRowsReuseSharedMembershipHelpers() {
  const graphFileText = readFileSync(resolve(process.cwd(), 'src', 'lib', 'graph', 'file.ts'), 'utf8')
  const traversalText = readFileSync(
    resolve(process.cwd(), 'src', 'features', 'panels', 'utils', 'orchestratorTraversal.ts'),
    'utf8',
  )
  const visibleRowsText = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'BottomPanel', 'hooks', 'useBottomPanelCuratorVisibleRows.ts'),
    'utf8',
  )
  const fieldAggregatesText = readFileSync(
    resolve(
      process.cwd(),
      'src',
      'components',
      'BottomPanel',
      'hooks',
      'useBottomPanelCuratorFieldAggregates.ts',
    ),
    'utf8',
  )

  if (
    !graphFileText.includes('const selectionSubgraphMembershipCache = new Map<string, SelectionSubgraphMembership | null>()')
    || !graphFileText.includes('export function readSelectionSubgraphMembershipForAnchorIds(')
    || !graphFileText.includes('subgraph,')
    || !graphFileText.includes('nodeIdSet: new Set(subgraph.nodes.map(node => String(node.id)))')
    || !graphFileText.includes('edgeIdSet: new Set(subgraph.edges.map(edge => String(edge.id)))')
  ) {
    throw new Error('expected graph selection membership to be centralized in the selection-subgraph helper layer')
  }

  if (
    !traversalText.includes('const traversalSummaryMembershipCache = new Map<string, TraversalSummaryMembership | null>()')
    || !traversalText.includes("cacheScope: 'orchestrator-traversal-membership'")
    || !traversalText.includes('const edge = graphLookup?.edgeById.get(edgeId)')
    || traversalText.includes('for (const edge of edges)')
  ) {
    throw new Error('expected traversal membership to derive nodes from cached edge lookup reuse instead of rescanning raw edge arrays')
  }

  if (
    !visibleRowsText.includes('readSelectionSubgraphMembershipForAnchorIds(graphData, selectionAnchorIds)')
    || !visibleRowsText.includes('readTraversalSummaryMembership(graphData, lastTraversalSummary, {')
    || !visibleRowsText.includes('graphRevision: graphDataRevision')
    || !visibleRowsText.includes("const graphDataRef = React.useRef<{ key: string; value: GraphData } | null>(null)")
    || !visibleRowsText.includes("'bottom-panel-curator-visible-rows-graph'")
    || visibleRowsText.includes('selectionSubgraph.nodes.map(')
    || visibleRowsText.includes('selectionSubgraph.edges.map(')
    || visibleRowsText.includes('for (const edge of edges)')
  ) {
    throw new Error('expected bottom-panel visible rows to consume shared membership helpers and semantic graph snapshots instead of rebuilding local membership sets')
  }

  if (
    !fieldAggregatesText.includes('readSelectionSubgraphMembershipForAnchorIds(graphData, selectionAnchorIds)')
    || !fieldAggregatesText.includes('const sampleGraphData = selectionMembership?.subgraph ?? graphData')
    || fieldAggregatesText.includes('buildSelectionSubgraphForAnchorIds(')
    || fieldAggregatesText.includes("value: { type: 'Graph', nodes: sampleNodes, edges: sampleEdges }")
  ) {
    throw new Error('expected bottom-panel field aggregates to reuse the shared selection membership subgraph instead of rebuilding a local sample graph')
  }
}
