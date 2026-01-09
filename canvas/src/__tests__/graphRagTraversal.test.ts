import type { AgenticRagNodeId, GraphData, JSONValue } from '@/lib/graph/types'
import { findGraphRagTraversalEdgeIds } from '@/lib/graph/graphragTraversal'
import {
  buildEdgeIdsForPath,
  buildGraphRagTraversalSummary,
  persistTraversalSummaryToGraph,
  type TraversalSummary,
  findGraphRagOwnerNode,
} from '@/features/panels/utils/orchestratorTraversal'

function makeGraph(
  nodes: Array<{ id: string }>,
  edges: Array<{ id: string; source: string; target: string }>,
  ownerId: string,
  traverse: JSONValue,
): GraphData {
  return {
    context: 'test',
    type: 'Graph',
    nodes: nodes.map(n => {
      const props: Record<string, JSONValue> =
        n.id === ownerId ? { graphRAGPath: { traverse } as JSONValue } : {}
      return {
        id: n.id,
        label: n.id,
        type: 'test',
        properties: props,
      }
    }),
    edges: edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: 'relatedTo',
      properties: {},
    })),
  }
}

export function testGraphRagTraversalHappyPath() {
  const graph = makeGraph(
    [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
    [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'B', target: 'C' },
    ],
    'A',
    ['B', 'C'],
  )
  const edgeIds = findGraphRagTraversalEdgeIds(graph)
  if (edgeIds.length !== 2) throw new Error(`expected 2 edges, got ${edgeIds.length}`)
  if (edgeIds[0] !== 'e1' || edgeIds[1] !== 'e2') throw new Error(`unexpected edge sequence: ${edgeIds.join(',')}`)
}

export function testGraphRagTraversalIgnoresInvalidShapes() {
  const graph = makeGraph(
    [{ id: 'A' }, { id: 'B' }, { id: 'C' }],
    [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'B', target: 'C' },
    ],
    'A',
    ['B', {}, []],
  )
  const edgeIds = findGraphRagTraversalEdgeIds(graph)
  if (!edgeIds.includes('e1')) {
    throw new Error(`expected edge e1 to be included, got ${edgeIds.join(',')}`)
  }
}

export function testGraphRagTraversalHandlesMissingOwner() {
  const graph: GraphData = {
    context: 'test',
    type: 'Graph',
    nodes: [
      { id: 'A', label: 'A', type: 'test', properties: {} },
      { id: 'B', label: 'B', type: 'test', properties: {} },
    ],
    edges: [
      { id: 'e1', source: 'A', target: 'B', label: 'relatedTo', properties: {} },
    ],
  }
  const edgeIds = findGraphRagTraversalEdgeIds(graph)
  if (edgeIds.length !== 0) throw new Error(`expected no edges, got ${edgeIds.join(',')}`)
}

export function testBuildEdgeIdsForPath() {
  const graph: GraphData = {
    context: 'test',
    type: 'Graph',
    nodes: [
      { id: 'A', label: 'A', type: 'test', properties: {} },
      { id: 'B', label: 'B', type: 'test', properties: {} },
      { id: 'C', label: 'C', type: 'test', properties: {} },
    ],
    edges: [
      { id: 'e1', source: 'A', target: 'B', label: 'relatedTo', properties: {} },
      { id: 'e2', source: 'B', target: 'C', label: 'relatedTo', properties: {} },
    ],
  }

  const edgeIds = buildEdgeIdsForPath(graph, ['A', 'B', 'C'])
  if (edgeIds.length !== 2) throw new Error(`expected 2 edges, got ${edgeIds.length}`)
  if (edgeIds[0] !== 'e1' || edgeIds[1] !== 'e2') {
    throw new Error(`unexpected edgeIds sequence: ${edgeIds.join(',')}`)
  }
}

export function testPersistTraversalSummaryToGraph() {
  const graph: GraphData = {
    context: 'test',
    type: 'Graph',
    nodes: [
      {
        id: 'owner',
        label: 'owner',
        type: 'test',
        properties: {
          graphRAGPath: {
            traverse: ['B'],
            hops: ['step 1'],
            multiHop: ['filter 1'],
          } as JSONValue,
        },
      },
      { id: 'B', label: 'B', type: 'test', properties: {} },
    ],
    edges: [],
  }

  const summary: TraversalSummary = {
    mode: 'graphRag',
    ownerNodeId: 'owner',
    ownerNodeLabel: 'owner',
    query: 'new query',
    example: 'new example',
    traverseNodeIds: ['B', 'C'].map(id => id as AgenticRagNodeId),
    multiHop: ['filter 1', 'filter 2'],
    hops: ['step 1', 'step 2'],
    edgeIds: [],
  }

  const updated = persistTraversalSummaryToGraph(graph, summary)
  if (!updated || !Array.isArray(updated.nodes)) {
    throw new Error('expected graph nodes to be updated')
  }
  const owner = updated.nodes.find(n => String(n.id) === 'owner')
  if (!owner) throw new Error('expected owner node to be present')
  const props = owner.properties ?? {}
  const raw = (props as Record<string, JSONValue>).graphRAGPath
  if (!raw) throw new Error('expected graphRAGPath property to be present')
  const path = raw as { traverse?: JSONValue; hops?: string[]; multiHop?: string[]; query?: string; example?: string }

  if (path.query !== 'new query') throw new Error(`expected query to be updated, got ${String(path.query)}`)
  if (path.example !== 'new example') {
    throw new Error(`expected example to be updated, got ${String(path.example)}`)
  }
  const traverse = (path.traverse as string[]) || []
  if (traverse.length !== 2 || traverse[0] !== 'B' || traverse[1] !== 'C') {
    throw new Error(`expected traverse to be updated, got ${JSON.stringify(traverse)}`)
  }
  const hops = path.hops || []
  if (hops.length !== 2 || hops[0] !== 'step 1' || hops[1] !== 'step 2') {
    throw new Error(`expected hops to be updated, got ${JSON.stringify(hops)}`)
  }
  const multiHop = path.multiHop || []
  if (multiHop.length !== 2 || multiHop[0] !== 'filter 1' || multiHop[1] !== 'filter 2') {
    throw new Error(`expected multiHop to be updated, got ${JSON.stringify(multiHop)}`)
  }
}

export function testFindGraphRagOwnerNodePrefersSelectedOwner() {
  const graph: GraphData = {
    context: 'test',
    type: 'Graph',
    nodes: [
      {
        id: 'owner1',
        label: 'Owner 1',
        type: 'test',
        properties: {
          graphRAGPath: {
            traverse: ['B'],
          } as JSONValue,
        },
      },
      {
        id: 'owner2',
        label: 'Owner 2',
        type: 'test',
        properties: {
          graphRAGPath: {
            traverse: ['B'],
          } as JSONValue,
        },
      },
      { id: 'B', label: 'B', type: 'test', properties: {} },
    ],
    edges: [],
  }

  const selected = 'owner1'
  const owner = findGraphRagOwnerNode(graph, selected)
  if (!owner) throw new Error('expected an owner node to be returned')
  if (String(owner.id) !== 'owner1') {
    throw new Error(`expected owner1 to be preferred, got ${String(owner.id)}`)
  }
}

export function testFindGraphRagOwnerNodePrefersOwnerWithSelectedInTraverse() {
  const graph: GraphData = {
    context: 'test',
    type: 'Graph',
    nodes: [
      {
        id: 'owner1',
        label: 'Owner 1',
        type: 'test',
        properties: {
          graphRAGPath: {
            traverse: ['X', 'Y'],
          } as JSONValue,
        },
      },
      {
        id: 'owner2',
        label: 'Owner 2',
        type: 'test',
        properties: {
          graphRAGPath: {
            traverse: ['Y'],
          } as JSONValue,
        },
      },
      { id: 'X', label: 'X', type: 'test', properties: {} },
      { id: 'Y', label: 'Y', type: 'test', properties: {} },
    ],
    edges: [],
  }

  const selected = 'Y'
  const owner = findGraphRagOwnerNode(graph, selected)
  if (!owner) throw new Error('expected an owner node to be returned')
  if (String(owner.id) !== 'owner1') {
    throw new Error(`expected owner1 to be preferred based on traverse scoring, got ${String(owner.id)}`)
  }
}

export function testBuildGraphRagTraversalSummaryFromOwner() {
  const graph: GraphData = {
    context: 'test',
    type: 'Graph',
    nodes: [
      {
        id: 'A',
        label: 'Owner node',
        type: 'test',
        properties: {
          graphRAGPath: {
            query: 'q',
            example: 'ex',
            traverse: ['B', 'C'],
            multiHop: ['m1'],
            hops: ['h1', 'h2'],
          } as JSONValue,
        },
      },
      { id: 'B', label: 'B', type: 'test', properties: {} },
      { id: 'C', label: 'C', type: 'test', properties: {} },
    ],
    edges: [
      { id: 'e1', source: 'A', target: 'B', label: 'relatedTo', properties: {} },
      { id: 'e2', source: 'B', target: 'C', label: 'relatedTo', properties: {} },
    ],
  }

  const summary = buildGraphRagTraversalSummary(graph, null)
  if (!summary) throw new Error('expected a traversal summary to be returned')
  if (summary.mode !== 'graphRag') throw new Error(`expected mode graphRag, got ${summary.mode}`)
  if (summary.ownerNodeId !== 'A') {
    throw new Error(`expected ownerNodeId A, got ${summary.ownerNodeId}`)
  }
  if (summary.ownerNodeLabel !== 'Owner node') {
    throw new Error(`expected ownerNodeLabel Owner node, got ${summary.ownerNodeLabel}`)
  }
  if (summary.query !== 'q') throw new Error(`expected query q, got ${String(summary.query)}`)
  if (summary.example !== 'ex') {
    throw new Error(`expected example ex, got ${String(summary.example)}`)
  }
  if (summary.traverseNodeIds.length !== 2 || summary.traverseNodeIds[0] !== 'B' || summary.traverseNodeIds[1] !== 'C') {
    throw new Error(`unexpected traverseNodeIds: ${JSON.stringify(summary.traverseNodeIds)}`)
  }
  if (summary.multiHop.length !== 1 || summary.multiHop[0] !== 'm1') {
    throw new Error(`unexpected multiHop: ${JSON.stringify(summary.multiHop)}`)
  }
  if (summary.hops.length !== 2 || summary.hops[0] !== 'h1' || summary.hops[1] !== 'h2') {
    throw new Error(`unexpected hops: ${JSON.stringify(summary.hops)}`)
  }
  if (summary.edgeIds.length !== 2 || summary.edgeIds[0] !== 'e1' || summary.edgeIds[1] !== 'e2') {
    throw new Error(`unexpected edgeIds: ${JSON.stringify(summary.edgeIds)}`)
  }
}
