import dagre from 'dagre';
import { GraphNode, GraphEdge } from '@/lib/graph/types';
import { GraphSchema, getNodeRadiusFromSchema } from '@/lib/graph/schema';

// Module-level cache to avoid re-running dagre when only the viewport size changes
let lastLayoutCache: {
  nodeCount: number;
  edgeCount: number;
  configJson: string;
  // Cache relative positions and bounds before centering
  positions: Map<string, { x: number; y: number }>;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
} | null = null;

export const applyTreeLayout = (
  nodes: GraphNode[],
  edges: GraphEdge[],
  width: number,
  height: number,
  schema: GraphSchema,
) => {
  if (!nodes.length) return;

  const treeConfig = schema.layout?.tree || {};
  const configJson = JSON.stringify(treeConfig);
  
  // Check if we can reuse the cached layout structure (relative positions)
  // We use a heuristic based on counts and config. This assumes that if node/edge counts
  // are stable and config is stable, the topology hasn't changed enough to warrant a full re-layout.
  // This is primarily to optimize resize operations where width/height change but the graph doesn't.
  const canReuse =
    lastLayoutCache &&
    lastLayoutCache.nodeCount === nodes.length &&
    lastLayoutCache.edgeCount === edges.length &&
    lastLayoutCache.configJson === configJson;

  let positions: Map<string, { x: number; y: number }>;
  let minX: number, maxX: number, minY: number, maxY: number;

  if (canReuse && lastLayoutCache) {
    positions = lastLayoutCache.positions;
    minX = lastLayoutCache.minX;
    maxX = lastLayoutCache.maxX;
    minY = lastLayoutCache.minY;
    maxY = lastLayoutCache.maxY;
  } else {
    // Full Dagre Layout Calculation
    const orientation = treeConfig?.orientation || 'horizontal';
    const direction = treeConfig?.direction || 'source-target';
    
    let rankdir = 'LR';
    if (orientation === 'vertical') {
      if (direction === 'target-source') rankdir = 'BT';
      else rankdir = 'TB';
    } else {
      if (direction === 'target-source') rankdir = 'RL';
      else rankdir = 'LR';
    }

    const separation = typeof treeConfig?.separation === 'number' ? treeConfig.separation : 3.0;
    const nodeSep = 120 * separation;
    const rankSep = 200 * separation;

    const g = new dagre.graphlib.Graph({ multigraph: true, compound: true });
    
    g.setGraph({
      rankdir,
      nodesep: nodeSep,
      ranksep: rankSep,
      marginx: 100,
      marginy: 100,
    });

    g.setDefaultEdgeLabel(() => ({}));

    const nodeIds = new Set<string>();
    nodes.forEach(node => {
      const id = String(node.id);
      nodeIds.add(id);
      const r = getNodeRadiusFromSchema(node, schema) || 20;
      const props = (node.properties || {}) as Record<string, unknown>
      const w = typeof props['visual:width'] === 'number' ? props['visual:width'] : r * 2;
      const h = typeof props['visual:height'] === 'number' ? props['visual:height'] : r * 2;
      g.setNode(id, { width: w, height: h });
    });

    const coerceEndpointId = (endpoint: unknown): string => {
      if (typeof endpoint === 'string' || typeof endpoint === 'number') return String(endpoint)
      if (endpoint && typeof endpoint === 'object') {
        const maybeId = (endpoint as { id?: unknown }).id
        if (typeof maybeId === 'string' || typeof maybeId === 'number') return String(maybeId)
      }
      return ''
    }

    edges.forEach(edge => {
      const source = coerceEndpointId(edge.source);
      const target = coerceEndpointId(edge.target);
      
      if (source && target && nodeIds.has(source) && nodeIds.has(target)) {
         g.setEdge(source, target);
      }
    });

    dagre.layout(g);

    positions = new Map();
    minX = Infinity;
    maxX = -Infinity;
    minY = Infinity;
    maxY = -Infinity;

    g.nodes().forEach((v) => {
      const layoutNode = g.node(v) as { x: number; y: number };
      if (!layoutNode) return;
      
      // Store relative position
      positions.set(v, { x: layoutNode.x, y: layoutNode.y });

      if (layoutNode.x < minX) minX = layoutNode.x;
      if (layoutNode.x > maxX) maxX = layoutNode.x;
      if (layoutNode.y < minY) minY = layoutNode.y;
      if (layoutNode.y > maxY) maxY = layoutNode.y;
    });

    // Update Cache
    lastLayoutCache = {
      nodeCount: nodes.length,
      edgeCount: edges.length,
      configJson,
      positions,
      minX,
      maxX,
      minY,
      maxY,
    };
  }

  // Apply positions with centering (Viewport Dependent)
  if (minX === Infinity) return;

  const graphWidth = maxX - minX;
  const graphHeight = maxY - minY;
  const centerX = minX + graphWidth / 2;
  const centerY = minY + graphHeight / 2;

  const targetCenterX = width / 2;
  const targetCenterY = height / 2;

  const offsetX = targetCenterX - centerX;
  const offsetY = targetCenterY - centerY;

  nodes.forEach(node => {
    const id = String(node.id);
    const pos = positions.get(id);
    if (pos) {
      node.x = pos.x + offsetX;
      node.y = pos.y + offsetY;
    }
  });
};
