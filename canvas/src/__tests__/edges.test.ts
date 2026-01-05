import { edgeExists } from '@/lib/graph/edges';
import { normalizeEdgesForSim } from '@/components/GraphCanvas/utils';
import type { GraphEdge, GraphNode } from '@/lib/graph/types';

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
