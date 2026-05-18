import { builtInParsers } from '@/features/parsers/default'
import { deriveKeywordGraphFromText } from '@/features/semantic-mode/keywordGraph'
import { applyCanvasRenderBudget } from '@/lib/graph/canvasRenderBudget'
import { buildScopedGraphSemanticKey } from '@/lib/graph/semanticKey'
import {
  readGraphTopologySummary,
  withGraphTopologyMetadata,
} from '@/lib/graph/graphTopology'
import type { GraphData } from '@/lib/graph/types'

export const testGraphTopologyAnnotatesNodesEdgesAndMetadata = () => {
  const graph = {
    type: 'Graph',
    nodes: [
      { id: 'doc', label: 'Document', type: 'Document', properties: {} },
      { id: 'section', label: 'Section', type: 'Section', properties: {} },
      { id: 'image', label: 'Image', type: 'Image', properties: { media_url: '/asset.png' } },
    ],
    edges: [
      { id: 'doc:section', source: 'doc', target: 'section', label: 'hasSection', properties: {} },
      { id: 'section:image', source: 'section', target: 'image', label: 'embedsImage', properties: {} },
      { id: 'dangling', source: 'section', target: 'missing', label: 'linksTo', properties: {} },
    ],
  } as GraphData

  const enriched = withGraphTopologyMetadata({ graphData: graph, stage: 'parser', annotate: true })
  if (!enriched) throw new Error('expected enriched graph')
  const summary = readGraphTopologySummary(enriched)
  if (!summary) throw new Error('expected graph topology metadata')
  if (summary.nodeCount !== 3 || summary.edgeCount !== 3) throw new Error('expected topology node/edge counts')
  if (summary.structuralEdgeCount !== 1) throw new Error('expected structural edge count')
  if (summary.unresolvedEdgeCount !== 1) throw new Error('expected unresolved edge count')
  if (summary.mediaNodeCount !== 1) throw new Error('expected media node count')

  const doc = (enriched.nodes || []).find(node => node.id === 'doc')
  const docProps = (doc?.properties || {}) as Record<string, unknown>
  if (docProps['graph:degree'] !== 1 || docProps['graph:outDegree'] !== 1) {
    throw new Error('expected node degree annotations')
  }
  const structuralEdge = (enriched.edges || []).find(edge => edge.id === 'doc:section')
  if (((structuralEdge?.properties || {}) as Record<string, unknown>)['graph:structural'] !== true) {
    throw new Error('expected structural edge annotation')
  }
  const dangling = (enriched.edges || []).find(edge => edge.id === 'dangling')
  if (((dangling?.properties || {}) as Record<string, unknown>)['graph:endpointState'] !== 'unresolved') {
    throw new Error('expected unresolved edge annotation')
  }
}

export const testGraphTopologyReusesCurrentGraphWithoutStageChurn = () => {
  const graph = {
    type: 'Graph',
    nodes: [
      { id: 'a', label: 'A', type: 'Entity', properties: {} },
      { id: 'b', label: 'B', type: 'Entity', properties: {} },
    ],
    edges: [
      { id: 'a:b', source: 'a', target: 'b', label: 'linksTo', properties: {} },
    ],
  } as GraphData
  const keyBefore = buildScopedGraphSemanticKey('topology-stage-test', { graphData: graph, graphRevision: 1 })
  const enriched = withGraphTopologyMetadata({ graphData: graph, graphRevision: 1, stage: 'parser', annotate: true })
  if (!enriched) throw new Error('expected enriched graph')
  const keyAfter = buildScopedGraphSemanticKey('topology-stage-test', { graphData: enriched, graphRevision: 1 })
  if (keyAfter !== keyBefore) throw new Error('expected topology metadata to avoid changing shared semantic key')
  const reused = withGraphTopologyMetadata({ graphData: enriched, graphRevision: 1, stage: 'render', annotate: true })
  if (reused !== enriched) throw new Error('expected current topology graph to be reused without stage-only churn')
  const summary = readGraphTopologySummary(reused)
  if (!summary || summary.nodeCount !== 2 || summary.edgeCount !== 1) throw new Error('expected retained topology summary')
}

export const testParserOutputsCarryTopologyForRenderPipeline = () => {
  const markdownParser = builtInParsers.find(parser => String(parser.id) === 'markdown')
  if (!markdownParser) throw new Error('expected markdown parser')
  const parsed = markdownParser.parse('doc.md', '# Title\n\nA paragraph with [Link](https://example.com).\n\n- Item')
  const summary = readGraphTopologySummary(parsed.graphData)
  if (!summary) throw new Error('expected parser graph topology metadata')
  if (summary.nodeCount <= 0 || summary.edgeCount <= 0) throw new Error('expected parsed topology counts')
  const annotatedNode = (parsed.graphData.nodes || []).find(node => typeof ((node.properties || {}) as Record<string, unknown>)['graph:degree'] === 'number')
  if (!annotatedNode) throw new Error('expected parser nodes to carry topology annotations')
}

export const testRenderBudgetRetainsTopologyForD3And3dSurfaces = () => {
  const graph = {
    type: 'Graph',
    nodes: [
      { id: 'root', label: 'Root', type: 'Document', properties: {} },
      ...Array.from({ length: 700 }, (_, i) => ({
        id: `block:${i}`,
        label: `Block ${i}`,
        type: 'Block',
        properties: {},
      })),
    ],
    edges: [
      ...Array.from({ length: 700 }, (_, i) => ({
        id: `root:block:${i}`,
        source: 'root',
        target: `block:${i}`,
        label: 'hasBlock',
        properties: {},
      })),
      ...Array.from({ length: 699 }, (_, i) => ({
        id: `block:next:${i}`,
        source: `block:${i}`,
        target: `block:${i + 1}`,
        label: 'next',
        properties: {},
      })),
    ],
  } as GraphData
  const enriched = withGraphTopologyMetadata({ graphData: graph, stage: 'active-view', annotate: true }) || graph
  const d3 = applyCanvasRenderBudget({ graphData: enriched, surface: 'd3Graph', graphRevision: 1, documentSemanticMode: 'document' })
  const d3Topology = withGraphTopologyMetadata({ graphData: d3, stage: 'render', annotate: true })
  const d3Summary = readGraphTopologySummary(d3Topology)
  if (!d3Summary) throw new Error('expected D3 topology summary')
  if (d3Summary.nodeCount > 420) throw new Error('expected D3 node budget')
  if (d3Summary.structuralEdgeCount < 300) throw new Error(`expected D3 structural edges, got ${d3Summary.structuralEdgeCount}`)

  const surface3d = applyCanvasRenderBudget({ graphData: enriched, surface: 'surface3d', graphRevision: 1, documentSemanticMode: 'document' })
  const surface3dTopology = withGraphTopologyMetadata({ graphData: surface3d, stage: 'render', annotate: true })
  const surface3dSummary = readGraphTopologySummary(surface3dTopology)
  if (!surface3dSummary) throw new Error('expected 3D topology summary')
  if (surface3dSummary.nodeCount > 320) throw new Error('expected 3D node budget')
  if (surface3dSummary.structuralEdgeCount < 220) throw new Error(`expected 3D structural edges, got ${surface3dSummary.structuralEdgeCount}`)
}

export const testKeywordModeCarriesTopologySummary = () => {
  const { graph } = deriveKeywordGraphFromText({
    documentId: 'doc:topology',
    documentText: 'Agentic ingestion builds graph nodes. Graph nodes connect parser edges. Parser edges support 3D rendering.',
  })
  const summary = readGraphTopologySummary(graph)
  if (!summary) throw new Error('expected keyword graph topology summary')
  if (summary.keywordNodeCount <= 0) throw new Error('expected keyword node count')
  if (summary.edgeCount <= 0) throw new Error('expected keyword edge count')
}

export const testGraphTopologyCacheInvalidatesSameCountEndpointMutation = () => {
  const graph = {
    type: 'Graph',
    nodes: [
      { id: 'a', label: 'A', type: 'Node', properties: {} },
      { id: 'b', label: 'B', type: 'Node', properties: {} },
    ],
    edges: [
      { id: 'a:b', source: 'a', target: 'b', label: 'next', properties: {} },
    ],
  } as GraphData
  const keyBefore = buildScopedGraphSemanticKey('topology-mutation-test', { graphData: graph })
  const first = withGraphTopologyMetadata({ graphData: graph, stage: 'test', annotate: true })
  if (readGraphTopologySummary(first)?.unresolvedEdgeCount !== 0) throw new Error('expected initially resolved topology')

  graph.edges[0] = { ...graph.edges[0]!, target: 'missing' }
  const keyAfter = buildScopedGraphSemanticKey('topology-mutation-test', { graphData: graph })
  const second = withGraphTopologyMetadata({ graphData: graph, stage: 'test', annotate: true })
  if (keyBefore === keyAfter) throw new Error('expected shared graph semantic key to track same-count endpoint mutations')
  if (second === first) throw new Error('expected topology cache to refresh after same-count endpoint mutation')
  if (readGraphTopologySummary(second)?.unresolvedEdgeCount !== 1) throw new Error('expected refreshed unresolved topology count')
}
