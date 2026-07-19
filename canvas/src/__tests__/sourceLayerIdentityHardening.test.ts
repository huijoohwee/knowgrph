import { finalizeEdgeAuthoring } from '@/features/edge-creation/authoring'
import { parseComposedId } from '@/hooks/store/graph-data-slice/graphDataComposedSource'
import { composeGraphFromSourceLayers, projectComposedGraphToSourceLayer } from '@/lib/graph/sourceLayers'
import type { GraphData } from '@/lib/graph/types'

const layerId = 'ws:caca068a'

export function testSourceLayerCompositionCollapsesRepeatedAliasesWithoutLosingEdgeTopology() {
  const repeatedPrefixGraph: GraphData = {
    type: 'Graph',
    nodes: [
      { id: `${layerId}::n1`, label: 'A', type: 'Thing', properties: {} },
      { id: `${layerId}::${layerId}::n1`, label: 'A duplicate', type: 'Thing', properties: {} },
      { id: 'n2', label: 'B', type: 'Thing', properties: {} },
    ],
    edges: [
      { id: `${layerId}::e1`, source: `${layerId}::n1`, target: `${layerId}::n2`, label: 'first', properties: {} },
      { id: `${layerId}::${layerId}::e1`, source: `${layerId}::${layerId}::n1`, target: `${layerId}::n2`, label: 'first', properties: {} },
      { id: 'e1', source: 'n2', target: 'n1', label: 'collision', properties: {} },
      { id: `${layerId}::${layerId}::e1`, source: `${layerId}::n2`, target: `${layerId}::n1`, label: 'collision', properties: {} },
    ],
    metadata: {},
  }
  const normalized = composeGraphFromSourceLayers({
    layers: [{ id: layerId, name: 'workspace.md', enabled: true, parsedGraphData: repeatedPrefixGraph }],
  }).graphData
  const normalizedNodeIds = normalized.nodes.map(node => String(node.id || ''))
  if (JSON.stringify(normalizedNodeIds) !== JSON.stringify([`${layerId}::n1`, `${layerId}::n2`])) {
    throw new Error(`expected composition to collapse repeated same-layer node prefixes, got ${JSON.stringify(normalizedNodeIds)}`)
  }
  const normalizedEdges = normalized.edges.map(edge => ({ id: edge.id, source: edge.source, target: edge.target }))
  if (JSON.stringify(normalizedEdges) !== JSON.stringify([
    { id: `${layerId}::e1`, source: `${layerId}::n1`, target: `${layerId}::n2` },
    { id: `${layerId}::e2`, source: `${layerId}::n2`, target: `${layerId}::n1` },
  ])) {
    throw new Error(`expected composition to dedupe aliases and rekey a topology collision, got ${JSON.stringify(normalizedEdges)}`)
  }
  const parsedRepeatedId = parseComposedId(`${layerId}::${layerId}::n1`)
  if (parsedRepeatedId?.layerId !== layerId || parsedRepeatedId.innerId !== 'n1') {
    throw new Error(`expected composed id parsing to collapse repeated same-layer prefixes, got ${JSON.stringify(parsedRepeatedId)}`)
  }
}

export function testSourceLayerProjectionHealsRepeatedAliasesWithoutLosingEdgeTopology() {
  const nestedProjection = projectComposedGraphToSourceLayer({
    graphData: {
      type: 'Graph',
      nodes: [
        { id: `${layerId}::${layerId}::n2`, type: 'Thing', label: 'A', properties: {}, metadata: { sourceLayerId: layerId } },
        { id: `${layerId}::${layerId}::${layerId}::n2`, type: 'Thing', label: 'A duplicate', properties: {}, metadata: { sourceLayerId: layerId } },
        { id: `${layerId}::n18`, type: 'Thing', label: 'B', properties: {}, metadata: { sourceLayerId: layerId } },
      ],
      edges: [
        { id: `${layerId}::${layerId}::e1`, source: `${layerId}::${layerId}::n2`, target: `${layerId}::n18`, label: 'first', properties: {}, metadata: { sourceLayerId: layerId } },
        { id: `${layerId}::${layerId}::${layerId}::e1`, source: `${layerId}::${layerId}::${layerId}::n2`, target: `${layerId}::n18`, label: 'first', properties: {}, metadata: { sourceLayerId: layerId } },
        { id: 'e1', source: `${layerId}::n18`, target: `${layerId}::n2`, label: 'collision', properties: {} },
        { id: `${layerId}::${layerId}::e1`, source: `${layerId}::n18`, target: `${layerId}::n2`, label: 'collision', properties: {} },
      ],
      metadata: { sourceLayerComposition: 'compose' },
    },
    layer: {
      id: layerId,
      name: 'workspace.md',
      enabled: true,
      parsedGraphData: {
        type: 'Graph',
        nodes: [
          { id: `${layerId}::n2`, type: 'Thing', label: 'A', properties: {} },
          { id: 'n18', type: 'Thing', label: 'B', properties: {} },
        ],
        edges: [],
      },
    },
  })
  const nestedProjectedIds = nestedProjection.nodes.map(node => String(node.id || '')).sort()
  if (JSON.stringify(nestedProjectedIds) !== JSON.stringify(['n18', 'n2'])) {
    throw new Error(`expected projection to heal repeated same-layer node prefixes, got ${JSON.stringify(nestedProjectedIds)}`)
  }
  const nestedProjectedEdges = nestedProjection.edges.map(edge => ({ id: edge.id, source: edge.source, target: edge.target }))
  if (JSON.stringify(nestedProjectedEdges) !== JSON.stringify([
    { id: 'e1', source: 'n2', target: 'n18' },
    { id: 'e2', source: 'n18', target: 'n2' },
  ])) {
    throw new Error(`expected projection to dedupe aliases and preserve a topology collision, got ${JSON.stringify(nestedProjectedEdges)}`)
  }
}

export function testEdgeAuthoringReservesCanonicalIdsFromQualifiedEdges() {
  const graphData: GraphData = {
    type: 'Graph',
    nodes: [
      { id: 'existing-a', type: 'Thing', label: 'Existing A', properties: {} },
      { id: 'existing-b', type: 'Thing', label: 'Existing B', properties: {} },
      { id: 'next-a', type: 'Thing', label: 'Next A', properties: {} },
      { id: 'next-b', type: 'Thing', label: 'Next B', properties: {} },
    ],
    edges: [{ id: `${layerId}::e1`, source: 'existing-a', target: 'existing-b', label: 'linksTo', properties: {} }],
  }
  const collisionSafe = finalizeEdgeAuthoring({
    mode: 'create',
    data: graphData,
    schema: null,
    label: 'linksTo',
    selectedEdgeId: null,
    from: { nodeId: 'next-a', portKey: 'output' },
    to: { nodeId: 'next-b', portKey: 'input' },
  })
  if (collisionSafe.kind !== 'create' || collisionSafe.edge.id !== 'e2') {
    throw new Error(`expected qualified e1 to reserve canonical edge id e1, got ${JSON.stringify(collisionSafe)}`)
  }
}
