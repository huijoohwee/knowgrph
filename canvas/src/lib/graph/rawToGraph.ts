import type { GraphData, GraphNode, GraphEdge, JSONValue } from './types';

import { isPlainObject } from './value';
import { buildFullStackRadarGraph } from './fullStackRadarGraph'

const pickNodesArray = (obj: Record<string, unknown>): unknown[] => {
  if (Array.isArray(obj.nodes)) return obj.nodes as unknown[];
  const keys = Object.keys(obj);
  const key = keys.find(k => /nodes$/i.test(k) && Array.isArray((obj as Record<string, unknown>)[k]));
  if (key) return (obj as Record<string, unknown>)[key] as unknown[];
  return [];
};

const pickEdgesArray = (obj: Record<string, unknown>): unknown[] => {
  if (Array.isArray(obj.edges)) return obj.edges as unknown[];
  if (Array.isArray(obj.links)) return obj.links as unknown[];
  const keys = Object.keys(obj);
  const key = keys.find(k => /edges$/i.test(k) && Array.isArray((obj as Record<string, unknown>)[k]));
  if (key) return (obj as Record<string, unknown>)[key] as unknown[];
  return [];
};

const JSON_FALLBACK_MAX_NODES = 480;
const JSON_FALLBACK_MAX_DEPTH = 8;
const JSON_FALLBACK_MAX_ARRAY_ITEMS = 40;
const JSON_FALLBACK_MAX_OBJECT_KEYS = 40;

const toShortText = (value: unknown, max = 140): string => {
  const raw = typeof value === 'string' ? value : String(value ?? '');
  const text = raw.replace(/\s+/g, ' ').trim();
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
};

const singularize = (value: string): string => {
  const text = String(value || '').trim();
  if (!text) return 'item';
  if (text.endsWith('ies') && text.length > 3) return `${text.slice(0, -3)}y`;
  if (text.endsWith('s') && text.length > 1) return text.slice(0, -1);
  return text;
};

const sanitizeNodeType = (value: string): string => {
  const cleaned = String(value || '')
    .replace(/[^a-zA-Z0-9:_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'JsonObject';
};

const isScalarValue = (value: unknown): value is string | number | boolean | null => {
  return value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
};

const buildScalarProps = (obj: Record<string, unknown>, maxKeys = 12): Record<string, JSONValue> => {
  const out: Record<string, JSONValue> = {};
  const keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i += 1) {
    if (Object.keys(out).length >= maxKeys) break;
    const key = keys[i]!;
    const value = obj[key];
    if (!isScalarValue(value)) continue;
    if (typeof value === 'string') {
      const text = toShortText(value, 220);
      if (!text) continue;
      out[key] = text;
      continue;
    }
    out[key] = value;
  }
  return out;
};

const buildObjectLabel = (obj: Record<string, unknown>, fallback: string): string => {
  const candidates = ['label', 'title', 'name', 'tool', 'task', 'project', 'id', 'cp'];
  for (let i = 0; i < candidates.length; i += 1) {
    const key = candidates[i]!;
    const value = obj[key];
    if (typeof value === 'string') {
      const text = toShortText(value, 88);
      if (text) return text;
      continue;
    }
    if (typeof value === 'number' && Number.isFinite(value)) return `${key}:${value}`;
  }
  const scalarKeys = Object.keys(obj).filter(k => isScalarValue(obj[k]));
  if (scalarKeys.length > 0) {
    const text = scalarKeys.slice(0, 3).join(' · ');
    if (text) return toShortText(text, 88);
  }
  return fallback;
};

const buildFallbackGraphFromAnyJson = (raw: unknown): GraphData => {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const seenObjects = new WeakMap<object, string>();
  const depthRowCounters = new Map<number, number>();
  let idCounter = 0;

  const nextNodeId = (prefix: string): string => {
    idCounter += 1;
    return `${prefix}:${idCounter}`;
  };

  const nextLayout = (depth: number): { x: number; y: number } => {
    const row = depthRowCounters.get(depth) || 0;
    depthRowCounters.set(depth, row + 1);
    return {
      x: 120 + depth * 260,
      y: 120 + row * 86,
    };
  };

  const pushNode = (node: GraphNode, depth: number): string => {
    if (nodes.length >= JSON_FALLBACK_MAX_NODES) return '';
    const pos = nextLayout(depth);
    nodes.push({
      ...node,
      ...(typeof node.x === 'number' ? {} : { x: pos.x }),
      ...(typeof node.y === 'number' ? {} : { y: pos.y }),
    });
    return node.id;
  };

  const pushEdge = (source: string, target: string, label: string): void => {
    if (!source || !target) return;
    edges.push({
      id: `edge:${edges.length + 1}`,
      source,
      target,
      label: label || 'contains',
      properties: {},
    });
  };

  const visit = (value: unknown, parentId: string | null, rel: string, depth: number): string => {
    if (nodes.length >= JSON_FALLBACK_MAX_NODES) return '';
    if (depth > JSON_FALLBACK_MAX_DEPTH) {
      const id = nextNodeId('json:depth');
      const nodeId = pushNode({
        id,
        type: 'JsonDepthLimit',
        label: `${rel} (depth limit)`,
        properties: { relation: rel, depth },
      }, depth);
      if (nodeId && parentId) pushEdge(parentId, nodeId, rel || 'contains');
      return nodeId;
    }

    if (isScalarValue(value)) {
      const text = value === null ? 'null' : toShortText(value, 100);
      const id = nextNodeId('json:value');
      const nodeId = pushNode({
        id,
        type: value === null ? 'JsonNull' : `Json${typeof value === 'number' ? 'Number' : typeof value === 'boolean' ? 'Boolean' : 'String'}`,
        label: rel ? `${rel}: ${text}` : text || 'value',
        properties: { relation: rel, value: typeof value === 'string' ? toShortText(value, 220) : (value as JSONValue) },
      }, depth);
      if (nodeId && parentId) pushEdge(parentId, nodeId, rel || 'contains');
      return nodeId;
    }

    if (Array.isArray(value)) {
      const id = nextNodeId('json:array');
      const nodeId = pushNode({
        id,
        type: 'JsonArray',
        label: rel ? `${rel} [${value.length}]` : `array [${value.length}]`,
        properties: { relation: rel, length: value.length },
      }, depth);
      if (nodeId && parentId) pushEdge(parentId, nodeId, rel || 'contains');
      if (!nodeId) return '';

      const limit = Math.min(value.length, JSON_FALLBACK_MAX_ARRAY_ITEMS);
      for (let i = 0; i < limit; i += 1) {
        const childRel = `${singularize(rel || 'item')}#${i + 1}`;
        visit(value[i], nodeId, childRel, depth + 1);
        if (nodes.length >= JSON_FALLBACK_MAX_NODES) break;
      }
      if (value.length > limit && nodes.length < JSON_FALLBACK_MAX_NODES) {
        const omitted = value.length - limit;
        const omittedId = nextNodeId('json:omitted');
        const pushed = pushNode({
          id: omittedId,
          type: 'JsonOmitted',
          label: `${rel || 'array'} (+${omitted} omitted)`,
          properties: { relation: rel, omitted },
        }, depth + 1);
        if (pushed) pushEdge(nodeId, pushed, 'omitted');
      }
      return nodeId;
    }

    if (!isPlainObject(value)) {
      const id = nextNodeId('json:value');
      const nodeId = pushNode({
        id,
        type: 'JsonValue',
        label: rel || 'value',
        properties: { relation: rel, value: toShortText(value, 220) },
      }, depth);
      if (nodeId && parentId) pushEdge(parentId, nodeId, rel || 'contains');
      return nodeId;
    }

    if (seenObjects.has(value)) {
      const existingId = String(seenObjects.get(value) || '');
      if (existingId && parentId) pushEdge(parentId, existingId, rel || 'references');
      return existingId;
    }

    const obj = value as Record<string, unknown>;
    const fallbackLabel = rel ? singularize(rel) : 'root';
    const label = buildObjectLabel(obj, fallbackLabel);
    const typeHint = rel ? `${sanitizeNodeType(singularize(rel))}Item` : 'JsonRoot';
    const id = nextNodeId('json:object');
    const properties: Record<string, JSONValue> = { relation: rel, ...buildScalarProps(obj) };
    const nodeId = pushNode({
      id,
      type: typeHint,
      label,
      properties,
    }, depth);
    if (!nodeId) return '';
    seenObjects.set(value, nodeId);
    if (parentId) pushEdge(parentId, nodeId, rel || 'contains');

    const keys = Object.keys(obj);
    const keyLimit = Math.min(keys.length, JSON_FALLBACK_MAX_OBJECT_KEYS);
    for (let i = 0; i < keyLimit; i += 1) {
      const key = keys[i]!;
      const child = obj[key];
      if (isScalarValue(child)) continue;
      visit(child, nodeId, key, depth + 1);
      if (nodes.length >= JSON_FALLBACK_MAX_NODES) break;
    }
    if (keys.length > keyLimit && nodes.length < JSON_FALLBACK_MAX_NODES) {
      const omitted = keys.length - keyLimit;
      const omittedId = nextNodeId('json:keys');
      const pushed = pushNode({
        id: omittedId,
        type: 'JsonOmitted',
        label: `${label} (+${omitted} keys omitted)`,
        properties: { omitted },
      }, depth + 1);
      if (pushed) pushEdge(nodeId, pushed, 'omitted');
    }
    return nodeId;
  };

  visit(raw, null, 'root', 0);
  return {
    context: 'raw-json-fallback',
    type: 'Graph',
    metadata: {
      source: 'raw-json-fallback',
      graphKind: 'graph',
      layoutHint: 'left-to-right depth lanes',
    },
    nodes,
    edges,
  };
};

export function rawToGraphData(raw: unknown): GraphData {
  const fullStackRadar = buildFullStackRadarGraph(raw)
  if (fullStackRadar) return fullStackRadar
  const obj = isPlainObject(raw) ? (raw as Record<string, unknown>) : {};

  const nodesSrc = pickNodesArray(obj);
  const nodes: GraphNode[] = nodesSrc
    .filter(entry => isPlainObject(entry))
    .map((entry, index) => {
      const rec = entry as Record<string, unknown>;

      const rawId = rec.id;
      const id = typeof rawId === 'string' && rawId.trim() ? rawId : `n${index}`;

      const dataRaw = rec.data;
      const dataProps: Record<string, JSONValue> =
        isPlainObject(dataRaw) ? (dataRaw as Record<string, JSONValue>) : {};

      const props: Record<string, JSONValue> = { ...dataProps };
      Object.keys(rec).forEach((key) => {
        if (key === 'id' || key === 'name' || key === 'label' || key === 'type' || key === 'data') return;
        const value = rec[key] as JSONValue;
        if (value === undefined) return;
        props[key] = value;
      });

      const nameValue = rec.name;
      const labelValue = rec.label;
      const labelFromName =
        typeof nameValue === 'string' && nameValue.trim()
          ? nameValue
          : typeof labelValue === 'string' && labelValue.trim()
          ? labelValue
          : null;
      const labelFromPropsName =
        typeof props.name === 'string' && (props.name as string).trim()
          ? (props.name as string)
          : typeof props.label === 'string' && (props.label as string).trim()
          ? (props.label as string)
          : null;
      const label = labelFromName || labelFromPropsName || id;

      const typeValue = rec.type;
      const typeFromProps =
        typeof props.type === 'string' && (props.type as string).trim()
          ? (props.type as string)
          : null;
      const type =
        (typeof typeValue === 'string' && typeValue.trim()
          ? typeValue
          : typeFromProps) || 'Entity';

      return { id, label, type, properties: props };
    });

  const edgesSrc = pickEdgesArray(obj);
  const edges: GraphEdge[] = edgesSrc
    .filter(entry => isPlainObject(entry))
    .map((entry, index) => {
      const rec = entry as Record<string, unknown>;

      const rawId = rec.id;
      const id = typeof rawId === 'string' && rawId.trim() ? rawId : `e${index}`;

      const sourceValue = rec.source ?? rec.from;
      const targetValue = rec.target ?? rec.to;
      const source = String(sourceValue ?? '');
      const target = String(targetValue ?? '');

      const dataRaw = rec.data;
      const dataProps: Record<string, JSONValue> =
        isPlainObject(dataRaw) ? (dataRaw as Record<string, JSONValue>) : {};

      const props: Record<string, JSONValue> = { ...dataProps };
      Object.keys(rec).forEach((key) => {
        if (key === 'id' || key === 'source' || key === 'target' || key === 'from' || key === 'to' || key === 'type' || key === 'label' || key === 'data') {
          return;
        }
        const value = rec[key] as JSONValue;
        if (value === undefined) return;
        props[key] = value;
      });

      const typeValue = rec.type ?? rec.label;
      const labelFromProps =
        typeof props.type === 'string' && (props.type as string).trim()
          ? (props.type as string)
          : typeof props.label === 'string' && (props.label as string).trim()
          ? (props.label as string)
          : null;
      const label =
        (typeof typeValue === 'string' && typeValue.trim()
          ? typeValue
          : labelFromProps) || 'relatedTo';

      return { id, source, target, label, properties: props };
    });

  if (nodes.length > 0 || edges.length > 0) {
    return {
      context: 'raw-nodes-edges',
      type: 'Graph',
      nodes,
      edges,
    };
  }

  return buildFallbackGraphFromAnyJson(raw);
}

export function graphToRawJson(data: GraphData): Record<string, unknown> {
  const nodes = data.nodes.map(n => ({ id: n.id, data: { name: n.label, type: n.type, ...n.properties } }))
  const edges = data.edges.map(e => ({ id: e.id, source: e.source, target: e.target, data: { type: e.label, ...e.properties } }))
  return { nodes, edges }
}
