import { edgeExists } from '@/lib/graph/edges';
import { normalizeEdgesForSim } from '@/components/GraphCanvas/utils';
import type { GraphEdge, GraphNode } from '@/lib/graph/types';
import type { GraphData } from '@/lib/graph/types'
import { deriveGraphDataForActiveView } from '@/hooks/useActiveGraphData'
import { deriveSceneDisplayGraph } from '@/lib/scene/sceneDerivation'

export const testEdgeExists = () => {
  const edges: GraphEdge[] = [
    { id: 'e1', source: 'a', target: 'b', label: 'link', properties: {} },
    { id: 'e2', source: 'b', target: 'c', label: 'link', properties: {} },
  ];
  if (!edgeExists(edges, 'a', 'b')) throw new Error('should find existing edge');
  if (edgeExists(edges, 'a', 'c')) throw new Error('should not find missing edge');
  if (!edgeExists(edges, 'b', 'a')) throw new Error('should be undirected check');
};

export const testNormalizeEdgesForSimFiltersDanglingEndpoints = () => {
  const nodes: GraphNode[] = [
    { id: 'a', label: 'A', type: 't', properties: {} },
    { id: 'b', label: 'B', type: 't', properties: {} },
  ];
  const edges: GraphEdge[] = [
    { id: 'e1', source: 'a', target: 'b', label: 'link', properties: {} },
    { id: 'e2', source: 'a', target: 'missing', label: 'link', properties: {} },
    { id: 'e3', source: '', target: 'b', label: 'link', properties: {} },
  ];
  const normalized = normalizeEdgesForSim(nodes, edges);
  if (normalized.length !== 1) throw new Error('should drop dangling endpoints for sim');
  if (normalized[0]?.id !== 'e1') throw new Error('should keep only valid edge');
};

const assertVisibleEdgesIn2dPipeline = (graphData: GraphData, mode: string) => {
  const view = deriveGraphDataForActiveView({
    graphData,
    frontmatterModeEnabled: mode === 'frontmatter',
    multiDimTableModeEnabled: mode === 'multiDimTable',
    documentSemanticMode: mode === 'keyword' ? 'keyword' : 'document',
    documentStructureBaselineLock: false,
    collapsedGroupIds: [],
  })
  const edgesForSim = normalizeEdgesForSim(
    (view.nodes || []) as GraphNode[],
    (view.edges || []) as GraphEdge[],
  )
  if (edgesForSim.length < 1) {
    throw new Error(`expected normalized edges in mode=${mode}`)
  }
  const scene = deriveSceneDisplayGraph({ graphData: view, edges: edgesForSim })
  if (!scene) throw new Error(`expected scene derivation in mode=${mode}`)
  if (scene.displayEdges.length < 1) {
    throw new Error(`expected visible edges in mode=${mode}`)
  }
}

export const testD3EdgesVisibleInDocumentStructureMode = () => {
  const graphData: GraphData = {
    type: 'Graph',
    context: 'test',
    metadata: {},
    nodes: [
      { id: '1', type: 'Section', label: 'H1', properties: { level: 1 } },
      { id: '2', type: 'Paragraph', label: 'P1', properties: {} },
    ],
    edges: [{ id: 'e1', source: '1', target: '2', label: 'contains', properties: {} }],
  }
  assertVisibleEdgesIn2dPipeline(graphData, 'document')
}

export const testD3EdgesVisibleInKeywordMode = () => {
  const graphData: GraphData = {
    type: 'Graph',
    context: 'keyword-view',
    metadata: {},
    nodes: [
      { id: 'doc:1', type: 'KeywordSource', label: 'Source', properties: {} },
      { id: '10', type: 'Entity', label: 'Keyword', properties: { 'keyword:kind': 'keyword' } },
    ],
    edges: [{ id: 'e1', source: 'doc:1', target: '10', label: 'mentions', properties: { 'keyword:kind': 'mention' } }],
  }
  assertVisibleEdgesIn2dPipeline(graphData, 'keyword')
}

export const testD3EdgesVisibleInFrontmatterMode = () => {
  const graphData: GraphData = {
    type: 'Graph',
    context: 'frontmatter-view',
    metadata: {},
    nodes: [
      { id: '100', type: 'MermaidNode', label: 'A', properties: { isMermaidFrontmatter: true } },
      { id: '200', type: 'MermaidNode', label: 'B', properties: {} },
    ],
    edges: [{ id: 'e1', source: '100', target: '200', label: 'pointsTo', properties: {} }],
  }
  assertVisibleEdgesIn2dPipeline(graphData, 'frontmatter')
}

export const testD3EdgesVisibleInMultiDimensionalTableMode = () => {
  const graphData: GraphData = {
    type: 'Graph',
    context: 'markdown-table-graph',
    metadata: {},
    nodes: [
      { id: '1', type: 'Task', label: 'A', properties: {} },
      { id: '2', type: 'Task', label: 'B', properties: {} },
    ],
    edges: [{ id: 'e1', source: '1', target: '2', label: 'dependsOn', properties: {} }],
  }
  assertVisibleEdgesIn2dPipeline(graphData, 'multiDimTable')
}
