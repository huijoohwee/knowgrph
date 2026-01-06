import {
  GraphData,
  JSONValue,
} from '../types';
import {
  AGENTIC_RAG_CONTEXT_URL,
  AGENTIC_RAG_EDGE_TYPE_IRI,
  AGENTIC_RAG_NODE_TYPE_IRI,
  KG_PREFIX,
} from '@/lib/agenticrag';

export function toJsonLd(
  data: GraphData,
): { '@context': Record<string, unknown> | string; '@graph': Array<Record<string, unknown>>; metadata?: Record<string, JSONValue> } {
  const toKgId = (raw: string): string => {
    const text = String(raw || '').trim();
    if (!text) return '';
    if (text.startsWith('http://') || text.startsWith('https://')) return text;
    if (text.includes(':')) return text;
    return `${KG_PREFIX}${text}`;
  };
  const toSafeIdSegment = (raw: string): string =>
    String(raw || '')
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+/, '')
      .replace(/_+$/, '') || 'edge';
  const toEdgeId = (raw: string): string => {
    const text = String(raw || '').trim();
    if (!text) return '';
    if (text.startsWith('http://') || text.startsWith('https://')) return text;
    if (text.includes(':')) return text;
    return `${KG_PREFIX}edge_${toSafeIdSegment(text)}`;
  };
  const graph: Array<Record<string, unknown>> = [];
  for (const n of data.nodes) {
    const id = toKgId(String(n.id));
    if (!id) continue;
    const item: Record<string, unknown> = {
      '@id': id,
      '@type': AGENTIC_RAG_NODE_TYPE_IRI,
      labels: [String(n.type || 'Node')],
      name: String(n.label || n.id),
    };
    if (typeof n.x === 'number') item.x = n.x;
    if (typeof n.y === 'number') item.y = n.y;
    if (typeof n.fx === 'number') item.fx = n.fx;
    if (typeof n.fy === 'number') item.fy = n.fy;
    Object.keys(n.properties || {}).forEach((k) => {
      if (!k || k === '@id' || k === '@type' || k === 'labels' || k === 'name' || k === 'metadata') return;
      item[k] = (n.properties || {})[k] as JSONValue;
    });
    if (n.metadata && Object.keys(n.metadata).length > 0) {
      item.metadata = n.metadata;
    }
    graph.push(item);
  }
  for (const e of data.edges) {
    const src = toKgId(String(e.source));
    const tgt = toKgId(String(e.target));
    if (!src || !tgt) continue;
    const baseId = `${String(e.source)}-${String(e.label)}-${String(e.target)}`;
    const rawEdgeId = String(e.id || '').trim() ? `${baseId}-${String(e.id)}` : baseId;
    const item: Record<string, unknown> = {
      '@id': toEdgeId(rawEdgeId),
      '@type': AGENTIC_RAG_EDGE_TYPE_IRI,
      source: src,
      target: tgt,
      label: String(e.label),
    };
    Object.keys(e.properties || {}).forEach((k) => {
      if (!k || k === '@id' || k === '@type' || k === 'source' || k === 'target' || k === 'label' || k === 'metadata') return;
      item[k] = (e.properties || {})[k] as JSONValue;
    });
    if (e.metadata && Object.keys(e.metadata).length > 0) {
      item.metadata = e.metadata;
    }
    graph.push(item);
  }
  const doc: { '@context': Record<string, unknown> | string; '@graph': Array<Record<string, unknown>>; metadata?: Record<string, JSONValue> } = {
    '@context': AGENTIC_RAG_CONTEXT_URL,
    '@graph': graph,
  };
  if (data.metadata && Object.keys(data.metadata).length > 0) {
    doc.metadata = data.metadata;
  }
  return doc;
}
