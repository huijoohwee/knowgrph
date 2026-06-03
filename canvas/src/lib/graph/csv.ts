import type { GraphData, GraphNode, GraphEdge, JSONValue } from './types';
import { generateDelimitedText, parseDelimitedText, rowsToRecords } from '@/lib/delimited-text/delimitedText';

function parseCsv(text: string): Array<Record<string, string>> {
  const parsed = parseDelimitedText(text, { delimiter: ',', header: true });
  const records = rowsToRecords(parsed.rows, parsed.headers);
  return records.map(row => {
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(row)) {
      normalized[String(key || '').toLowerCase().replace(/^\uFEFF/, '')] = value;
    }
    return normalized;
  });
}

function detectKind(rowKeys: string[]): 'nodes' | 'edges' | 'unknown' {
  const set = new Set(rowKeys);
  const isNodes = set.has('id') && (set.has('label') || set.has('name'));
  const isEdgesA = set.has('source_id') && set.has('target_id');
  const isEdgesB = set.has('subject_id') && set.has('object_id');
  const isEdgesC = set.has('source') && set.has('target');
  if (isNodes) return 'nodes';
  if (isEdgesA || isEdgesB || isEdgesC) return 'edges';
  return 'unknown';
}

type CsvNodeRow = Record<string, string> & { id?: string; label?: string; name?: string; type?: string; properties?: string };

function parseCellValue(v: string): JSONValue {
  const s = String(v);
  const trimmed = s.trim();
  if (!trimmed) return s;
  const num = Number(s);
  if (Number.isFinite(num) && /^[-+]?\d*(?:\.\d+)?$/.test(trimmed)) return num;
  return s;
}

function parsePropsJson(raw: string): Record<string, JSONValue> {
  try {
    const obj = JSON.parse(raw) as unknown;
    if (obj && typeof obj === 'object') return obj as Record<string, JSONValue>;
    return {};
  } catch {
    return {};
  }
}

function toGraphFromNodes(rows: Array<CsvNodeRow>): GraphData {
  const nodes: GraphNode[] = rows.map(r => {
    const id = (r['id'] || '').trim();
    const label = (r['label'] || r['name'] || id).trim();
    const type = (r['type'] || 'Entity').trim() || 'Entity';
    let props: Record<string, JSONValue> = {};
    const rawProps = r['properties'] || '';
    if (rawProps) props = parsePropsJson(rawProps);
    const base = new Set(['id','label','name','type','properties']);
    Object.keys(r).forEach(k => {
      if (!base.has(k)) {
        const v = r[k];
        if (v != null && String(v).length > 0) {
          props[k] = parseCellValue(v);
        }
      }
    });
    return { id, label, type, properties: props };
  }).filter(n => n.id.length > 0);
  const edges: GraphEdge[] = [];
  return { context: 'csv-import', type: 'Graph', nodes, edges };
}

type CsvEdgeRow = Record<string, string> & {
  source_id?: string; subject_id?: string; source?: string;
  source_label?: string; subject_name?: string; source_type?: string; subject_type?: string;
  target_id?: string; object_id?: string; target?: string;
  target_label?: string; object_name?: string; target_type?: string; object_type?: string;
  predicate?: string; edge_type?: string; weight?: string;
};

function toGraphFromEdges(rows: Array<CsvEdgeRow>): GraphData {
  const nodesMap = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  let idx = 0;
  for (const r of rows) {
    const sId = (r['source_id'] || r['subject_id'] || r['source'] || '').trim();
    const sLabel = (r['source_label'] || r['subject_name'] || sId).trim();
    const sType = (r['source_type'] || r['subject_type'] || 'Entity').trim() || 'Entity';
    const tId = (r['target_id'] || r['object_id'] || r['target'] || '').trim();
    const tLabel = (r['target_label'] || r['object_name'] || tId).trim();
    const tType = (r['target_type'] || r['object_type'] || 'Entity').trim() || 'Entity';
    const predicate = (r['predicate'] || r['edge_type'] || '').trim() || 'relatedTo';
    if (!sId || !tId) continue;
    if (!nodesMap.has(sId)) nodesMap.set(sId, { id: sId, label: sLabel || sId, type: sType || 'Entity', properties: {} });
    if (!nodesMap.has(tId)) nodesMap.set(tId, { id: tId, label: tLabel || tId, type: tType || 'Entity', properties: {} });
    const wRaw = r['weight'] || '';
    let weight: number | string | undefined = undefined;
    if (wRaw) {
      const num = Number(wRaw);
      weight = Number.isFinite(num) ? num : wRaw;
    }
    edges.push({ id: `${sId}-${predicate}-${tId}-${idx++}`, source: sId, target: tId, label: predicate, properties: weight !== undefined ? { weight } : {} });
  }
  return { context: 'csv-import', type: 'Graph', nodes: Array.from(nodesMap.values()), edges };
}

export function parseCsvToGraph(text: string): GraphData {
  const rows = parseCsv(text);
  if (rows.length === 0) return { context: 'csv-import', type: 'Graph', nodes: [], edges: [] };
  const headers = Object.keys(rows[0]).map(h => h.toLowerCase());
  const hasRowType = headers.includes('row_type');
  const hasKind = headers.includes('kind');
  if (hasRowType) {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeIds = new Set<string>();
    for (const r of rows) {
      const rt = (r['row_type'] || '').trim().toLowerCase();
      if (rt === 'node') {
        const id = (r['id'] || '').trim();
        if (!id) continue;
        const label = (r['label'] || r['name'] || id).trim();
        const type = (r['node_type'] || r['type'] || 'Entity').trim() || 'Entity';
        let props: Record<string, JSONValue> = {};
        const rawProps = r['properties'] || '';
        if (rawProps) props = parsePropsJson(rawProps)
        Object.keys(r).forEach(k => {
          if (!['row_type','id','label','name','type','node_type','properties'].includes(k)) {
            const v = r[k];
            if (v != null && String(v).length > 0) {
              props[k] = parseCellValue(v)
            }
          }
        });
        const node: GraphNode = { id, label, type, properties: props };
        const px = props['x'];
        const py = props['y'];
        const pfx = props['fx'];
        const pfy = props['fy'];
        if (typeof px === 'number') node.x = px
        if (typeof py === 'number') node.y = py
        if (typeof pfx === 'number') node.fx = pfx
        if (typeof pfy === 'number') node.fy = pfy
        nodes.push(node);
        nodeIds.add(id);
      } else if (rt === 'edge') {
        const sId = (r['source_id'] || r['source'] || '').trim();
        const sLabel = (r['source_label'] || r['subject_name'] || sId).trim();
        const sType = (r['source_type'] || r['subject_type'] || 'Entity').trim() || 'Entity';
        const tId = (r['target_id'] || r['target'] || '').trim();
        const tLabel = (r['target_label'] || r['object_name'] || tId).trim();
        const tType = (r['target_type'] || r['object_type'] || 'Entity').trim() || 'Entity';
        const predicate = (r['predicate'] || r['edge_type'] || '').trim() || 'relatedTo';
        if (!sId || !tId) continue;
        if (!nodeIds.has(sId)) { nodes.push({ id: sId, label: sLabel || sId, type: sType || 'Entity', properties: {} }); nodeIds.add(sId); }
        if (!nodeIds.has(tId)) { nodes.push({ id: tId, label: tLabel || tId, type: tType || 'Entity', properties: {} }); nodeIds.add(tId); }
        let props: Record<string, JSONValue> = {};
        const rawEdgeProps = r['edge_properties'] || r['properties'] || '';
        if (rawEdgeProps) { props = parsePropsJson(rawEdgeProps) }
        edges.push({ id: `${sId}-${predicate}-${tId}-${edges.length}`, source: sId, target: tId, label: predicate, properties: props });
      }
    }
    return { context: 'csv-import', type: 'Graph', nodes, edges };
  }
  if (hasKind) {
    const nodes: GraphNode[] = [];
    const edges: GraphEdge[] = [];
    const nodeIds = new Set<string>();
    for (const r of rows) {
      const rt = (r['kind'] || '').trim().toLowerCase();
      if (rt === 'node') {
        const id = (r['id'] || '').trim();
        if (!id) continue;
        const label = (r['label'] || r['name'] || id).trim();
        const type = (r['node_type'] || r['type'] || 'Entity').trim() || 'Entity';
        let props: Record<string, JSONValue> = {};
        const rawProps = r['properties'] || '';
        if (rawProps) { props = parsePropsJson(rawProps) }
        Object.keys(r).forEach(k => {
          if (!['kind','id','label','name','type','node_type','properties'].includes(k)) {
            const v = r[k];
            if (v != null && String(v).length > 0) {
              props[k] = parseCellValue(v)
            }
          }
        });
        const node: GraphNode = { id, label, type, properties: props };
        const px = props['x'];
        const py = props['y'];
        const pfx = props['fx'];
        const pfy = props['fy'];
        if (typeof px === 'number') node.x = px
        if (typeof py === 'number') node.y = py
        if (typeof pfx === 'number') node.fx = pfx
        if (typeof pfy === 'number') node.fy = pfy
        nodes.push(node);
        nodeIds.add(id);
      } else if (rt === 'edge') {
        const sId = (r['source_id'] || r['source'] || '').trim();
        const tId = (r['target_id'] || r['target'] || '').trim();
        const predicate = (r['predicate'] || r['edge_type'] || '').trim() || 'relatedTo';
        if (!sId || !tId) continue;
        if (!nodeIds.has(sId)) { nodes.push({ id: sId, label: sId, type: 'Entity', properties: {} }); nodeIds.add(sId); }
        if (!nodeIds.has(tId)) { nodes.push({ id: tId, label: tId, type: 'Entity', properties: {} }); nodeIds.add(tId); }
        let props: Record<string, JSONValue> = {};
        const rawEdgeProps = r['edge_properties'] || r['properties'] || '';
        if (rawEdgeProps) { props = parsePropsJson(rawEdgeProps) }
        edges.push({ id: `${sId}-${predicate}-${tId}-${edges.length}`, source: sId, target: tId, label: predicate, properties: props });
      }
    }
    return { context: 'csv-import', type: 'Graph', nodes, edges };
  }
  const kind = detectKind(Object.keys(rows[0]));
  if (kind === 'nodes') return toGraphFromNodes(rows);
  if (kind === 'edges') return toGraphFromEdges(rows);
  return { context: 'csv-import', type: 'Graph', nodes: [], edges: [] };
}

export function graphToCombinedCsv(data: GraphData): string {
  const fields = ['row_type','id','label','node_type','properties','source_id','source_label','source_type','predicate','target_id','target_label','target_type','edge_properties'];
  const nodeRows = data.nodes.map(n => {
    const props: Record<string, JSONValue> = { ...(n.properties ?? {}) }
    if (typeof n.x === 'number') props.x = n.x
    if (typeof n.y === 'number') props.y = n.y
    if (typeof n.fx === 'number') props.fx = n.fx
    if (typeof n.fy === 'number') props.fy = n.fy
    return [
      'node',
      n.id,
      n.label,
      n.type,
      JSON.stringify(props),
      '', '', '', '', '', '', '', ''
    ]
  });
  const nodeMap = new Map(data.nodes.map(n => [n.id, n]));
  const edgeRows = data.edges.map(e => {
    const s = nodeMap.get(e.source);
    const t = nodeMap.get(e.target);
    const edgeProps = e.properties ?? {};
    return [
      'edge',
      '', '', '', '',
      s?.id, s?.label, s?.type,
      e.label,
      t?.id, t?.label, t?.type,
      JSON.stringify(edgeProps)
    ]
  });
  return `${generateDelimitedText([...nodeRows, ...edgeRows], { fields, escapeFormulaCells: false })}\n`;
}
