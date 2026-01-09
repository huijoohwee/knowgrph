import type { GraphData, GraphNode, GraphEdge, JSONValue } from './types';

const isRecord = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === 'object' && !Array.isArray(x);

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

export function rawToGraphData(raw: unknown): GraphData {
  const obj = isRecord(raw) ? (raw as Record<string, unknown>) : {};

  const nodesSrc = pickNodesArray(obj);
  const nodes: GraphNode[] = nodesSrc
    .filter(entry => isRecord(entry))
    .map((entry, index) => {
      const rec = entry as Record<string, unknown>;

      const rawId = rec.id;
      const id = typeof rawId === 'string' && rawId.trim() ? rawId : `n${index}`;

      const dataRaw = rec.data;
      const dataProps: Record<string, JSONValue> =
        isRecord(dataRaw) ? (dataRaw as Record<string, JSONValue>) : {};

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
    .filter(entry => isRecord(entry))
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
        isRecord(dataRaw) ? (dataRaw as Record<string, JSONValue>) : {};

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
