import type { GraphData, GraphNode, GraphEdge, JSONValue } from './types';

type RawNode = { id: string; data?: Record<string, JSONValue>; name?: string; type?: string };
type RawEdge = { id: string; source: string; target: string; data?: Record<string, JSONValue>; type?: string };

const isRecord = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object';

export function rawToGraphData(raw: unknown): GraphData {
  const obj = isRecord(raw) ? raw as Record<string, unknown> : {};
  const nodesSrc = Array.isArray(obj.nodes) ? (obj.nodes as RawNode[]) : []
  const nodes: GraphNode[] = nodesSrc.map((n) => {
    const id = String(n.id)
    const d = (isRecord(n.data) ? n.data as Record<string, JSONValue> : {})
    const label = typeof n.name === 'string' ? n.name : (typeof d['name'] === 'string' ? d['name'] as string : id)
    const type = typeof n.type === 'string' ? n.type : (typeof d['type'] === 'string' ? d['type'] as string : 'Entity')
    return { id, label, type, properties: d };
  });

  const edgesSrc = Array.isArray(obj.edges) ? (obj.edges as RawEdge[]) : (Array.isArray((obj as Record<string, unknown>).links) ? ((obj as Record<string, unknown>).links as RawEdge[]) : [])
  const edges: GraphEdge[] = edgesSrc.map((e) => {
    const id = String(e.id)
    const source = String(e.source)
    const target = String(e.target)
    const d = (isRecord(e.data) ? e.data as Record<string, JSONValue> : {})
    const label = typeof e.type === 'string' ? e.type : (typeof d['type'] === 'string' ? d['type'] as string : 'relatedTo')
    return { id, source, target, label, properties: d };
  });

  return {
    context: 'raw-nodes-edges',
    type: 'Graph',
    nodes,
    edges,
  };
}

export function graphToRawJson(data: GraphData): Record<string, unknown> {
  const nodes = data.nodes.map(n => ({ id: n.id, data: { name: n.label, type: n.type, ...n.properties } }))
  const edges = data.edges.map(e => ({ id: e.id, source: e.source, target: e.target, data: { type: e.label, ...e.properties } }))
  return { nodes, edges }
}
