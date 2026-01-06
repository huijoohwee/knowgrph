import {
  AgenticGraphRagPathValue,
  AgenticRagChunkText,
  AgenticRagEmbedding,
  AgenticRagGeo,
  AgenticRagMediaUrl,
  AgenticRagNodeId,
  AgenticRagNodeProvenance,
  AgenticRagNodeView,
  GraphData,
  GraphNode,
  GraphEdge,
  JSONValue,
  JsonLdGraphMappingConfig,
  ParsedAgenticGraphRagExamplePath,
  ParsedAgenticGraphRagTraversePath,
} from './types';
import {
  isGraphRagPathValue,
  toParsedExamplePath,
  toParsedTraversePath,
} from '@/lib/graph/graphragTraversal';
import { AGENTIC_RAG_CONTEXT_URL, AGENTIC_RAG_EDGE_TYPE_IRI, AGENTIC_RAG_NODE_TYPE_IRI } from '@/lib/agenticrag';

function stripKg(x: unknown): string {
  const s = String(x ?? '');
  return s.startsWith('kg:') ? s.slice(3) : s;
}

const isRecord = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object';

const AGENTIC_RAG_MINIMAL_CONTEXT: Record<string, unknown> = {
  source: { '@type': '@id' },
  target: { '@type': '@id' },
  media_url: { '@type': '@id' },
  provenance: { '@type': '@id' },
  documentUrl: { '@type': '@id' },
};

function isIdPropertyKey(ctx: Record<string, unknown>, key: string): boolean {
  const entry = ctx[key];
  if (!entry || !isRecord(entry)) return false;
  const t = entry['@type'];
  return typeof t === 'string' && t === '@id';
}

function isCompactIriLike(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith('kg:')) return true;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return true;
  return trimmed.includes(':');
}

export type JsonLdGraphMappingSummary = {
  nodeCount: number;
  edgeCount: number;
  edgeProps: string[];
  selectedEdgeProps: string[];
  sampleNodes: { id: string; type: string; label: string }[];
};

export type AgenticRagIgnoreFiltersSummary = {
  rawPatterns: string[];
  resolvedPatterns: string[];
};

export function resolveAgenticRagIgnorePattern(pattern: string): string {
  const text = pattern.trim();
  if (!text) return '';
  if (text.includes(':')) {
    const parts = text.split(':', 2);
    const key = (parts[0] || '').trim().toLowerCase();
    const value = (parts[1] || '').trim();
    if (!value) return '';
    if (key === 'dir') {
      let valueNorm = value.replace(/\\/g, '/');
      if (!valueNorm.endsWith('/')) valueNorm = `${valueNorm}/`;
      return valueNorm;
    }
    if (key === 'glob') {
      return value;
    }
    if (key === 'path') {
      return value.replace(/\\/g, '/');
    }
  }
  return pattern;
}

export function buildAgenticRagIgnoreFiltersFromRawPatterns(
  rawPatternsInput: string[],
): AgenticRagIgnoreFiltersSummary {
  const rawPatterns: string[] = [];
  const resolvedPatterns: string[] = [];
  rawPatternsInput.forEach((item) => {
    const value = String(item || '').trim();
    if (!value) return;
    rawPatterns.push(value);
    const resolved = resolveAgenticRagIgnorePattern(value);
    if (resolved) resolvedPatterns.push(resolved);
  });
  return { rawPatterns, resolvedPatterns };
}

export function getJsonLdGraphMappingSummary(data: GraphData | null | undefined): JsonLdGraphMappingSummary | null {
  if (!data || data.type !== 'Graph') return null;
  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  const edges = Array.isArray(data.edges) ? data.edges : [];

  let selectedEdgeProps: string[] = [];
  const metaRaw = data.metadata as unknown;
  if (metaRaw && typeof metaRaw === 'object' && !Array.isArray(metaRaw)) {
    const meta = metaRaw as Record<string, unknown>;
    const cfgRaw = meta.jsonLdMapping as unknown;
    if (cfgRaw && typeof cfgRaw === 'object' && !Array.isArray(cfgRaw)) {
      const cfg = cfgRaw as JsonLdGraphMappingConfig;
      const listRaw = (cfg as unknown as Record<string, unknown>).contextEdgeProperties as unknown;
      if (Array.isArray(listRaw)) {
        selectedEdgeProps = listRaw.filter(entry => typeof entry === 'string');
      }
    }
  }

  const contextValue = data.context as unknown;
  let ctx: Record<string, unknown> | null = null;
  if (typeof contextValue === 'string') {
    try {
      const parsed = JSON.parse(contextValue) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        ctx = parsed as Record<string, unknown>;
      }
    } catch {
      ctx = null;
    }
  } else if (contextValue && typeof contextValue === 'object' && !Array.isArray(contextValue)) {
    ctx = contextValue as Record<string, unknown>;
  }

  if (!ctx) {
    const sampleNodes = nodes.slice(0, 3).map(node => ({
      id: String(node.id),
      type: String(node.type),
      label: String(node.label),
    }));
    return {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      edgeProps: [],
      selectedEdgeProps,
      sampleNodes,
    };
  }

  const edgeProps: string[] = [];
  Object.keys(ctx).forEach(key => {
    const entry = ctx ? (ctx as Record<string, unknown>)[key] : undefined;
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return;
    const typeValue = (entry as Record<string, unknown>)['@type'];
    if (typeValue === '@id') edgeProps.push(key);
  });

  if (edgeProps.length === 0 && edges.length > 0) {
    const labels = new Set<string>();
    edges.forEach(e => {
      if (e && typeof e.label === 'string' && e.label.trim()) labels.add(e.label.trim());
    });
    edgeProps.push(...Array.from(labels).sort());
  }

  const sampleNodes = nodes.slice(0, 3).map(node => ({
    id: String(node.id),
    type: String(node.type),
    label: String(node.label),
  }));

  return {
    nodeCount: nodes.length,
    edgeCount: edges.length,
    edgeProps,
    selectedEdgeProps,
    sampleNodes,
  };
}

export function getAgenticRagIgnoreFiltersSummary(
  data: GraphData | null | undefined,
): AgenticRagIgnoreFiltersSummary | null {
  if (!data) return null;
  const metaRaw = data.metadata as unknown;
  if (!metaRaw || typeof metaRaw !== 'object' || Array.isArray(metaRaw)) return null;
  const meta = metaRaw as Record<string, unknown>;
  const raw = meta.ignoreCodebasePaths as unknown;
  const resolved = meta.ignoreCodebasePathsResolved as unknown;
  const rawPatterns = Array.isArray(raw) ? raw.filter((x) => typeof x === 'string') as string[] : [];
  const resolvedPatterns = Array.isArray(resolved) ? resolved.filter((x) => typeof x === 'string') as string[] : [];
  if (rawPatterns.length === 0 && resolvedPatterns.length === 0) return null;
  return { rawPatterns, resolvedPatterns };
}

export type AgenticRagContextComparison = {
  canonicalContextUrl: string;
  graphContextUrl: string | null;
  isCanonicalMatch: boolean | null;
};

export function getAgenticRagContextComparison(
  data: GraphData | null | undefined,
): AgenticRagContextComparison | null {
  if (!data) return null;
  const value = data.context as JSONValue | undefined;
  let graphContextUrl: string | null = null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    graphContextUrl = trimmed.length > 0 ? trimmed : null;
  } else if (value && typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, JSONValue>;
    const vocab = record['@vocab'];
    if (typeof vocab === 'string' && vocab.trim().length > 0) {
      graphContextUrl = vocab.trim();
    }
  }
  let isCanonicalMatch: boolean | null = null;
  if (graphContextUrl) {
    isCanonicalMatch = graphContextUrl === AGENTIC_RAG_CONTEXT_URL;
  }
  return {
    canonicalContextUrl: AGENTIC_RAG_CONTEXT_URL,
    graphContextUrl,
    isCanonicalMatch,
  };
}

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
    const hasReified = item['kg:subject'] && item['kg:object'] && item['kg:predicate'];
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
    const src = stripKg(e['kg:subject'] as unknown);
    const tgt = stripKg(e['kg:object'] as unknown);
    let label = e['kg:predicate'] as unknown;
    if (typeof label === 'string') label = stripKg(label);
    const props: Record<string, JSONValue> = {};
    let metadata: Record<string, JSONValue> | undefined;
    Object.keys(e).forEach((k) => {
      if (k === '@id' || k === 'kg:subject' || k === 'kg:object' || k === 'kg:predicate') return;
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
    const src = stripKg(e['source_node'] as unknown);
    const tgt = stripKg(e['target_node'] as unknown);
    let label = e['relation'] as unknown;
    if (!src || !tgt || !label) continue;
    if (typeof label === 'string') label = stripKg(label);
    const props: Record<string, JSONValue> = {};
    let metadata: Record<string, JSONValue> | undefined;
    Object.keys(e).forEach((k) => {
      if (k === '@id' || k === '@type' || k === 'source_node' || k === 'target_node' || k === 'relation') return;
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

export function agenticRagNodeFromGraphNode(node: GraphNode): AgenticRagNodeView {
  const id = node.id as AgenticRagNodeId;
  const labels = [node.type].filter(label => label && label.length > 0);
  const props = node.properties || {};
  const meta = node.metadata || {};

  let graphRagPath: AgenticGraphRagPathValue | undefined;
  let parsedTraversePath: ParsedAgenticGraphRagTraversePath | null = null;
  let parsedExamplePath: ParsedAgenticGraphRagExamplePath | null = null;

  const graphRagPathRaw = (props as Record<string, JSONValue>).graphRAGPath as JSONValue | undefined;
  if (isGraphRagPathValue(graphRagPathRaw)) {
    graphRagPath = graphRagPathRaw as AgenticGraphRagPathValue;
    parsedTraversePath = toParsedTraversePath(graphRagPath);
    parsedExamplePath = toParsedExamplePath(graphRagPath);
  }

  const chunkRaw = props.chunk_text;
  const chunkText =
    typeof chunkRaw === 'string'
      ? (chunkRaw as AgenticRagChunkText)
      : undefined;

  const embeddingRaw = props.embedding;
  const embedding =
    Array.isArray(embeddingRaw) && embeddingRaw.every(v => typeof v === 'number')
      ? (embeddingRaw as number[] as AgenticRagEmbedding)
      : undefined;

  const geoRaw = props.geo;
  const geo =
    geoRaw &&
    typeof geoRaw === 'object' &&
    !Array.isArray(geoRaw) &&
    typeof (geoRaw as Record<string, unknown>).lat === 'number' &&
    typeof (geoRaw as Record<string, unknown>).lng === 'number'
      ? ({
          lat: (geoRaw as Record<string, unknown>).lat as number,
          lng: (geoRaw as Record<string, unknown>).lng as number,
        } as AgenticRagGeo)
      : undefined;

  const mediaRaw = props.media_url;
  const mediaUrl =
    typeof mediaRaw === 'string'
      ? (mediaRaw as AgenticRagMediaUrl)
      : undefined;

  const provenanceRaw = typeof meta === 'object' && !Array.isArray(meta) ? meta : {};
  const provenance: AgenticRagNodeProvenance | undefined =
    provenanceRaw && Object.keys(provenanceRaw).length > 0
      ? (provenanceRaw as AgenticRagNodeProvenance)
      : undefined;

  return {
    id,
    labels,
    properties: props,
    chunkText,
    embedding,
    geo,
    mediaUrl,
    provenance,
    graphRAGPath: graphRagPath,
    parsedGraphRagTraversePath: parsedTraversePath,
    parsedGraphRagExamplePath: parsedExamplePath,
  };
}

export function toJsonLd(
  data: GraphData,
): { '@context': Record<string, unknown> | string; '@graph': Array<Record<string, unknown>>; metadata?: Record<string, JSONValue> } {
  const toKgId = (raw: string): string => {
    const text = String(raw || '').trim();
    if (!text) return '';
    if (text.startsWith('http://') || text.startsWith('https://')) return text;
    if (text.includes(':')) return text;
    return `kg:${text}`;
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
    return `kg:edge_${toSafeIdSegment(text)}`;
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
