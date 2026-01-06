import {
  GraphData,
  GraphNode,
  GraphEdge,
  JSONValue,
} from '../types';
import {
  AGENTIC_RAG_CONTEXT_URL,
  AGENTIC_RAG_EDGE_TYPE_IRI,
  AGENTIC_RAG_NODE_TYPE_IRI,
  KG_SUBJECT,
  KG_PREDICATE,
  KG_OBJECT,
} from '@/lib/agenticrag';
import {
  stripKg,
  isRecord,
  isIdPropertyKey,
  isCompactIriLike,
  AGENTIC_RAG_MINIMAL_CONTEXT,
} from './utils';

export function parseJsonLd(jsonld: unknown): GraphData {
  const root = jsonld as Record<string, unknown> | unknown[];
  const graph = Array.isArray(root) ? root : ((isRecord(root) && Array.isArray((root as Record<string, unknown>)['@graph'])) ? ((root as Record<string, unknown>)['@graph'] as unknown[]) : []);
  const rawCtx = isRecord(root) ? (root['@context'] as unknown) : undefined;
  const ctx = (() => {
    if (typeof rawCtx === 'string') {
      const trimmed = rawCtx.trim();
      if (trimmed === AGENTIC_RAG_CONTEXT_URL) return AGENTIC_RAG_MINIMAL_CONTEXT;
      try { return JSON.parse(rawCtx) } catch { return {} }
    }
    if (Array.isArray(rawCtx)) {
      const merged: Record<string, unknown> = {};
      rawCtx.forEach((entry) => {
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
          Object.assign(merged, entry as Record<string, unknown>);
        }
      });
      return merged;
    }
    if (isRecord(rawCtx)) {
      const vocab = rawCtx['@vocab'];
      if (typeof vocab === 'string' && vocab.trim() === AGENTIC_RAG_CONTEXT_URL) return AGENTIC_RAG_MINIMAL_CONTEXT;
      return rawCtx;
    }
    return {};
  })();
  const ctxRecord: Record<string, unknown> = isRecord(ctx) ? ctx : {};
  let graphMetadata: Record<string, JSONValue> | undefined;
  if (isRecord(root)) {
    const metaRaw = (root as Record<string, unknown>)['metadata'] as unknown;
    if (isRecord(metaRaw) && Object.keys(metaRaw).length > 0) {
      graphMetadata = metaRaw as Record<string, JSONValue>;
    }
  }
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const nodeMap = new Map<string, Record<string, unknown>>();
  const edgeNodes: Array<Record<string, unknown>> = [];
  const edgeNodesKnowgrph: Array<Record<string, unknown>> = [];
  const edgeNodesAgentic: Array<Record<string, unknown>> = [];
  const isNodeType = (typeList: string[]): boolean =>
    typeList.includes(AGENTIC_RAG_NODE_TYPE_IRI) || typeList.includes('Node') || typeList.includes('knowgrph:Node');
  const isEdgeType = (typeList: string[]): boolean =>
    typeList.includes(AGENTIC_RAG_EDGE_TYPE_IRI) || typeList.includes('Edge');
  for (const itemAny of graph) {
    const item = isRecord(itemAny) ? itemAny : {};
    const hasReified = item[KG_SUBJECT] && item[KG_OBJECT] && item[KG_PREDICATE];
    if (hasReified) {
      edgeNodes.push(item);
      continue;
    }
    const typeRaw = item['@type'] as unknown;
    const typeList: string[] = [];
    if (Array.isArray(typeRaw)) {
      typeList.push(...typeRaw.map(v => String(v)));
    } else if (typeof typeRaw !== 'undefined' && typeRaw !== null) {
      typeList.push(String(typeRaw));
    }
    if (typeList.includes('knowgrph:Edge')) {
      edgeNodesKnowgrph.push(item);
      continue;
    }
    if (isEdgeType(typeList)) {
      edgeNodesAgentic.push(item);
      continue;
    }
    const id = stripKg((item['@id'] as unknown) ?? (item['id'] as unknown));
    if (!id) continue;
    let type = typeList.length > 0 ? typeList[0] : 'Thing';
    if (isNodeType(typeList)) {
      const labelsRaw = item['labels'] as unknown;
      if (Array.isArray(labelsRaw)) {
        const first = labelsRaw.find(v => typeof v === 'string' && v.trim().length > 0);
        if (typeof first === 'string') type = first;
      } else {
        type = stripKg(type);
      }
    } else {
      type = stripKg(type);
    }
    const name =
      (item['name'] as unknown) ??
      (item['title'] as unknown) ??
      (item['label'] as unknown) ??
      id;
    nodeMap.set(id, item);
    const props: Record<string, JSONValue> = {};
    let metadata: Record<string, JSONValue> | undefined;
    Object.keys(item).forEach((k) => {
      const shouldSkipLabelsKey = isNodeType(typeList);
      if (k === '@id' || k === '@type' || k === 'name' || k === 'label') return;
      if (k === 'labels' && shouldSkipLabelsKey) return;
      if (k === 'kg:x' || k === 'kg:y' || k === 'kg:fx' || k === 'kg:fy') return;
      if (k === 'x' || k === 'y' || k === 'fx' || k === 'fy') return;
      if (k === 'metadata') {
        const vMeta = item[k] as unknown;
        if (isRecord(vMeta)) metadata = vMeta as Record<string, JSONValue>;
        return;
      }
      const v = item[k] as unknown;
      const isIdKey = isIdPropertyKey(ctxRecord, k);
      if (Array.isArray(v)) {
        props[k] = v as JSONValue;
      } else if (!isIdKey || (!Array.isArray(v) && !isRecord(v))) {
        props[k] = v as JSONValue;
      }
    });
    const node: GraphNode = { id, label: String(name), type: String(type), properties: props, metadata };
    if (typeof item['kg:x'] === 'number') node.x = item['kg:x'] as number;
    if (typeof item['kg:y'] === 'number') node.y = item['kg:y'] as number;
    if (typeof item['kg:fx'] === 'number') node.fx = item['kg:fx'] as number;
    if (typeof item['kg:fy'] === 'number') node.fy = item['kg:fy'] as number;
    if (typeof item['x'] === 'number') node.x = item['x'] as number;
    if (typeof item['y'] === 'number') node.y = item['y'] as number;
    if (typeof item['fx'] === 'number') node.fx = item['fx'] as number;
    if (typeof item['fy'] === 'number') node.fy = item['fy'] as number;
    nodes.push(node);
  }
  for (const [id, item] of nodeMap.entries()) {
    const keys = Object.keys(item);
    for (const k of keys) {
      if (k === '@id' || k === '@type' || k === 'name' || k === 'label') continue;
      if (k.startsWith('kg:')) continue;
      const v = item[k] as unknown;
      const isIdKey = isIdPropertyKey(ctxRecord, k);
      if (!Array.isArray(v) && !isIdKey) continue;
      const arr = (Array.isArray(v) ? v : [v]) as unknown[];
      if (arr.length === 0) continue;
      const allStringOrIdObject = arr.every((x) => {
        if (typeof x === 'string') return true;
        if (!isRecord(x)) return false;
        const idVal = (x['@id'] as unknown) ?? (x['id'] as unknown);
        return typeof idVal === 'string' && idVal.length > 0;
      });
      if (!allStringOrIdObject) continue;
      const allCompactIri = arr.every((x) => typeof x === 'string' && isCompactIriLike(String(x)));
      const anyTargetExists = arr.some((x) => {
        if (typeof x !== 'string') return false;
        const tgtId = stripKg(x as unknown);
        return !!tgtId && nodeMap.has(tgtId);
      });
      const treatAsEdges = arr.length > 0 && (isIdKey || (allCompactIri && anyTargetExists));
      if (!treatAsEdges) continue;
      for (let i = 0; i < arr.length; i++) {
        const raw = arr[i];
        let tgtId = '';
        const props: Record<string, JSONValue> = {};
        if (typeof raw === 'string') {
          tgtId = stripKg(raw as unknown);
        } else if (isRecord(raw)) {
          const rawId = (raw['@id'] as unknown) ?? (raw['id'] as unknown);
          if (typeof rawId === 'string') {
            tgtId = stripKg(rawId as unknown);
          }
          Object.keys(raw).forEach((pk) => {
            if (pk === '@id' || pk === 'id') return;
            props[pk] = raw[pk] as JSONValue;
          });
        }
        if (!tgtId) continue;
        if (!nodeMap.has(tgtId)) continue;
        edges.push({ id: `${id}-${k}-${tgtId}-${i}`, source: id, target: tgtId, label: k, properties: props });
      }
    }
  }
  for (const e of edgeNodes) {
    const src = stripKg(e[KG_SUBJECT] as unknown);
    const tgt = stripKg(e[KG_OBJECT] as unknown);
    let label = e[KG_PREDICATE] as unknown;
    if (typeof label === 'string') label = stripKg(label);
    const props: Record<string, JSONValue> = {};
    let metadata: Record<string, JSONValue> | undefined;
    Object.keys(e).forEach((k) => {
      if (k === '@id' || k === KG_SUBJECT || k === KG_OBJECT || k === KG_PREDICATE) return;
      if (k === 'metadata') {
        const vMeta = e[k] as unknown;
        if (isRecord(vMeta)) metadata = vMeta as Record<string, JSONValue>;
        return;
      }
      props[k] = e[k] as JSONValue;
    });
    edges.push({ id: `${src}-${String(label)}-${tgt}-${edges.length}`, source: src, target: tgt, label: String(label), properties: props, metadata });
  }
  for (const e of edgeNodesKnowgrph) {
    const src = stripKg((e['source_node'] as unknown) ?? (e['source'] as unknown));
    const tgt = stripKg((e['target_node'] as unknown) ?? (e['target'] as unknown));
    let label = (e['relation'] as unknown) ?? (e['label'] as unknown);
    if (!src || !tgt || !label) continue;
    if (typeof label === 'string') label = stripKg(label);
    const props: Record<string, JSONValue> = {};
    let metadata: Record<string, JSONValue> | undefined;
    Object.keys(e).forEach((k) => {
      if (k === '@id' || k === '@type' || k === 'source_node' || k === 'target_node' || k === 'relation' || k === 'source' || k === 'target' || k === 'label') return;
      if (k === 'metadata') {
        const vMeta = e[k] as unknown;
        if (isRecord(vMeta)) metadata = vMeta as Record<string, JSONValue>;
        return;
      }
      props[k] = e[k] as JSONValue;
    });
    edges.push({ id: `${src}-${String(label)}-${tgt}-${edges.length}`, source: src, target: tgt, label: String(label), properties: props, metadata });
  }
  for (const e of edgeNodesAgentic) {
    const rawSrc = (e['source'] as unknown) ?? (e['source_node'] as unknown);
    const rawTgt = (e['target'] as unknown) ?? (e['target_node'] as unknown);
    const src = stripKg(rawSrc);
    const tgt = stripKg(rawTgt);
    let label = (e['label'] as unknown) ?? (e['relation'] as unknown);
    if (!src || !tgt || !label) continue;
    if (typeof label === 'string') label = stripKg(label);
    const props: Record<string, JSONValue> = {};
    let metadata: Record<string, JSONValue> | undefined;
    Object.keys(e).forEach((k) => {
      if (
        k === '@id' ||
        k === '@type' ||
        k === 'source' ||
        k === 'target' ||
        k === 'label' ||
        k === 'source_node' ||
        k === 'target_node' ||
        k === 'relation'
      ) return;
      if (k === 'metadata') {
        const vMeta = e[k] as unknown;
        if (isRecord(vMeta)) metadata = vMeta as Record<string, JSONValue>;
        return;
      }
      props[k] = e[k] as JSONValue;
    });
    const edgeIdRaw = e['@id'] as unknown;
    const edgeId =
      typeof edgeIdRaw === 'string' && edgeIdRaw.trim().length > 0
        ? stripKg(edgeIdRaw)
        : `${src}-${String(label)}-${tgt}-${edges.length}`;
    edges.push({ id: edgeId, source: src, target: tgt, label: String(label), properties: props, metadata });
  }
  return { context: JSON.stringify(ctx), metadata: graphMetadata, type: 'Graph', nodes, edges };
}
