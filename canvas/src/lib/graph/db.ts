import type { GraphData, GraphNode, GraphEdge, JSONValue } from './types';

export type DbConnectorKind = 'postgres' | 'sqlite' | 'neo4j';

export type DbRow = Record<string, JSONValue>;

export interface RelationalNodeConfig {
  idColumn: string;
  labelColumn?: string;
  typeColumn?: string;
}

export interface RelationalEdgeConfig {
  sourceColumn: string;
  targetColumn: string;
  labelColumn?: string;
  idColumn?: string;
}

export interface RelationalResult {
  nodes: DbRow[];
  edges?: DbRow[];
}

export interface RelationalConnectorConfig {
  kind: 'postgres' | 'sqlite';
  node: RelationalNodeConfig;
  edge?: RelationalEdgeConfig;
}

export interface Neo4jNodeRow {
  id: string;
  labels?: string[];
  properties?: Record<string, JSONValue>;
}

export interface Neo4jRelationshipRow {
  id: string;
  type: string;
  start: string;
  end: string;
  properties?: Record<string, JSONValue>;
}

export interface Neo4jResult {
  nodes: Neo4jNodeRow[];
  relationships: Neo4jRelationshipRow[];
}

export function buildRelationalGraph(
  config: RelationalConnectorConfig,
  result: RelationalResult,
): { graphData: GraphData; warnings: string[] } {
  const rows = Array.isArray(result.nodes) ? result.nodes : [];
  const edgeRows = Array.isArray(result.edges) ? result.edges : [];
  const configWarnings = validateRelationalConfig(config, rows, edgeRows);
  const nodes = buildRelationalNodes(config.node, rows);
  const edgeResult = config.edge ? buildRelationalEdges(config.edge, edgeRows) : { edges: [], warnings: [] };
  const graphData: GraphData = {
    context: config.kind,
    type: 'Graph',
    nodes,
    edges: edgeResult.edges,
  };
  return { graphData, warnings: [...configWarnings, ...edgeResult.warnings] };
}

function validateRelationalConfig(config: RelationalConnectorConfig, nodeRows: DbRow[], edgeRows: DbRow[]): string[] {
  const warnings: string[] = [];
  const nodeId = String(config.node.idColumn || '').trim();
  if (!nodeId) {
    warnings.push('Relational connector missing node idColumn');
    return warnings;
  }
  if (nodeRows.length === 0) {
    return warnings;
  }
  const sampleNode = nodeRows[0] || {};
  const nodeKeys = new Set(Object.keys(sampleNode));
  if (!nodeKeys.has(nodeId)) {
    warnings.push(`Relational nodes missing idColumn "${nodeId}"`);
  }
  const nodeLabel = config.node.labelColumn && String(config.node.labelColumn || '').trim();
  if (nodeLabel && !nodeKeys.has(nodeLabel)) {
    warnings.push(`Relational nodes missing labelColumn "${nodeLabel}"`);
  }
  const nodeType = config.node.typeColumn && String(config.node.typeColumn || '').trim();
  if (nodeType && !nodeKeys.has(nodeType)) {
    warnings.push(`Relational nodes missing typeColumn "${nodeType}"`);
  }
  if (!config.edge || edgeRows.length === 0) {
    return warnings;
  }
  const sampleEdge = edgeRows[0] || {};
  const edgeKeys = new Set(Object.keys(sampleEdge));
  const sourceKey = String(config.edge.sourceColumn || '').trim();
  const targetKey = String(config.edge.targetColumn || '').trim();
  if (!sourceKey || !targetKey) {
    warnings.push('Relational edge configuration missing sourceColumn or targetColumn');
    return warnings;
  }
  if (!edgeKeys.has(sourceKey)) {
    warnings.push(`Relational edges missing sourceColumn "${sourceKey}"`);
  }
  if (!edgeKeys.has(targetKey)) {
    warnings.push(`Relational edges missing targetColumn "${targetKey}"`);
  }
  const edgeLabel = config.edge.labelColumn && String(config.edge.labelColumn || '').trim();
  if (edgeLabel && !edgeKeys.has(edgeLabel)) {
    warnings.push(`Relational edges missing labelColumn "${edgeLabel}"`);
  }
  const edgeId = config.edge.idColumn && String(config.edge.idColumn || '').trim();
  if (edgeId && !edgeKeys.has(edgeId)) {
    warnings.push(`Relational edges missing idColumn "${edgeId}"`);
  }
  return warnings;
}

function buildRelationalNodes(config: RelationalNodeConfig, rows: DbRow[]): GraphNode[] {
  const idKey = config.idColumn;
  const labelKey = config.labelColumn || config.idColumn;
  const typeKey = config.typeColumn;
  return rows
    .map(row => {
      const rawId = row[idKey];
      const id = rawId == null ? '' : String(rawId);
      if (!id) return null;
      const rawLabel = row[labelKey];
      const label = rawLabel == null ? id : String(rawLabel);
      const rawType = typeKey ? row[typeKey] : null;
      const type = rawType == null ? 'Entity' : String(rawType);
      const properties: Record<string, JSONValue> = {};
      Object.keys(row).forEach(key => {
        if (key === idKey || key === labelKey || (typeKey && key === typeKey)) return;
        properties[key] = row[key];
      });
      const node: GraphNode = {
        id,
        label,
        type,
        properties,
      };
      return node;
    })
    .filter((node): node is GraphNode => node !== null);
}

function buildRelationalEdges(config: RelationalEdgeConfig, rows: DbRow[]): { edges: GraphEdge[]; warnings: string[] } {
  const sourceKey = config.sourceColumn;
  const targetKey = config.targetColumn;
  const labelKey = config.labelColumn;
  const idKey = config.idColumn;
  const edges: GraphEdge[] = [];
  const warnings: string[] = [];
  rows.forEach((row, index) => {
    const rawSource = row[sourceKey];
    const rawTarget = row[targetKey];
    const source = rawSource == null ? '' : String(rawSource);
    const target = rawTarget == null ? '' : String(rawTarget);
    if (!source || !target) {
      warnings.push(`Edge row ${index} missing source or target`);
      return;
    }
    const rawLabel = labelKey ? row[labelKey] : null;
    const label = rawLabel == null ? 'RELATED' : String(rawLabel);
    const rawId = idKey ? row[idKey] : null;
    const id = rawId == null || String(rawId).length === 0 ? `${source}-${label}-${target}-${index}` : String(rawId);
    const properties: Record<string, JSONValue> = {};
    Object.keys(row).forEach(key => {
      if (key === sourceKey || key === targetKey || (labelKey && key === labelKey) || (idKey && key === idKey)) return;
      properties[key] = row[key];
    });
    const edge: GraphEdge = {
      id,
      source,
      target,
      label,
      properties,
    };
    edges.push(edge);
  });
  return { edges, warnings };
}

export function buildNeo4jGraph(result: Neo4jResult): { graphData: GraphData; warnings: string[] } {
  const warnings: string[] = [];
  const nodesById = new Map<string, GraphNode>();
  result.nodes.forEach(row => {
    const id = String(row.id || '');
    if (!id) return;
    const labels = Array.isArray(row.labels) && row.labels.length > 0 ? row.labels : ['Entity'];
    const label = String(labels[0] || id);
    const type = labels.join('|');
    const properties = row.properties || {};
    const node: GraphNode = {
      id,
      label,
      type,
      properties,
    };
    nodesById.set(id, node);
  });
  const edges: GraphEdge[] = [];
  result.relationships.forEach((rel, index) => {
    const startId = String(rel.start || '');
    const endId = String(rel.end || '');
    if (!nodesById.has(startId) || !nodesById.has(endId)) {
      warnings.push(`Relationship ${rel.id || index} references missing node`);
      return;
    }
    const id = String(rel.id || `${startId}-${rel.type}-${endId}-${index}`);
    const label = String(rel.type || 'RELATED');
    const properties = rel.properties || {};
    const edge: GraphEdge = {
      id,
      source: startId,
      target: endId,
      label,
      properties,
    };
    edges.push(edge);
  });
  const graphData: GraphData = {
    context: 'neo4j',
    type: 'Graph',
    nodes: Array.from(nodesById.values()),
    edges,
  };
  return { graphData, warnings };
}
