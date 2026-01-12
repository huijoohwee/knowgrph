import * as d3 from 'd3';
import dagre from 'dagre';
import { GraphNode, GraphEdge } from '@/lib/graph/types';
import { GraphSchema, getNodeRadiusFromSchema } from '@/lib/graph/schema';

type EdgeEndpointLike = GraphEdge['source'] | { id?: string } | null | undefined;

export type EdgeWithRuntime = GraphEdge & {
  source?: EdgeEndpointLike;
  target?: EdgeEndpointLike;
};

const coerceEndpointId = (value: EdgeEndpointLike): string | null => {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string') {
    return (value as { id: string }).id;
  }
  return null;
};

export const getEdgeEndpoints = (edge: EdgeWithRuntime): { src: string | null; tgt: string | null } => ({
  src: coerceEndpointId(edge.source ?? null),
  tgt: coerceEndpointId(edge.target ?? null),
});

export const normalizeEdgesForSim = (nodes: GraphNode[], edges: GraphEdge[]): GraphEdge[] => {
  const nodeIds = new Set<string>((nodes || []).map(n => n.id));
  const out: GraphEdge[] = [];
  for (const e of edges || []) {
    const source = coerceEndpointId(e.source);
    const target = coerceEndpointId(e.target);
    if (!source || !target) continue;
    if (!nodeIds.has(source) || !nodeIds.has(target)) continue;
    out.push({ ...e, source, target });
  }
  return out;
};

type GraphLike = { nodes: GraphNode[]; edges: GraphEdge[] };

type RadialClusterNode = {
  id: string;
  children?: RadialClusterNode[];
};

const applyRadialClusterLayout = (
  nodes: GraphNode[],
  edgesForSim: GraphEdge[],
  width: number,
  height: number,
  schema: GraphSchema,
) => {
  if (!nodes.length) return;
  const graphLike: GraphLike = { nodes, edges: edgesForSim };
  const adj = buildAdjacencyMap(graphLike);
  const idToNode = new Map<string, GraphNode>();
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i];
    idToNode.set(String(n.id), n);
  }
  const visited = new Set<string>();
  const components: RadialClusterNode[] = [];
  const buildComponent = (rootId: string) => {
    const root: RadialClusterNode = { id: rootId, children: [] };
    const queue: RadialClusterNode[] = [root];
    visited.add(rootId);
    while (queue.length > 0) {
      const current = queue.shift() as RadialClusterNode;
      const neighbors = adj.get(current.id) || new Set<string>();
      const children: RadialClusterNode[] = [];
      neighbors.forEach(neighborId => {
        const id = String(neighborId);
        if (!id || visited.has(id)) return;
        if (!idToNode.has(id)) return;
        visited.add(id);
        const child: RadialClusterNode = { id, children: [] };
        children.push(child);
        queue.push(child);
      });
      if (children.length > 0) {
        current.children = children;
      }
    }
    return root;
  };
  for (let i = 0; i < nodes.length; i += 1) {
    const id = String(nodes[i].id);
    if (!id || visited.has(id)) continue;
    components.push(buildComponent(id));
  }
  if (!components.length) return;
  const treeRoot: RadialClusterNode =
    components.length === 1 ? components[0] : { id: '__root__', children: components };
  const size = Math.max(1, Math.min(width, height));
  const padding = schema.layout?.fitPadding ?? 80;
  const maxRadius = Math.max(10, size / 2 - Math.max(0, padding));
  if (!Number.isFinite(maxRadius) || maxRadius <= 0) return;
  const centerX = Math.max(1, width) / 2;
  const centerY = Math.max(1, height) / 2;
  const root = d3.hierarchy<RadialClusterNode>(treeRoot);
  const cluster = d3.cluster<RadialClusterNode>().size([2 * Math.PI, maxRadius]);
  cluster(root);
  const positions = new Map<string, { x: number; y: number }>();
  root.descendants().forEach(node => {
    const id = node.data.id;
    if (!idToNode.has(id)) return;
    const angleRaw = node.x;
    const radiusRaw = node.y;
    if (typeof angleRaw !== 'number' || typeof radiusRaw !== 'number') return;
    const angle = angleRaw - Math.PI / 2;
    const radius = radiusRaw;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    positions.set(id, { x, y });
  });
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    const id = String(node.id);
    const p = positions.get(id);
    if (!p) continue;
    node.x = p.x;
    node.y = p.y;
  }
};

const normalizeEdgeLabels = (raw: unknown): string[] => {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed ? [trimmed] : [];
  }
  if (Array.isArray(raw)) {
    return raw
      .map(v => (typeof v === 'string' ? v.trim() : ''))
      .filter(Boolean);
  }
  return [];
};

const pickMostCommonEdgeLabel = (edges: GraphEdge[]): string | null => {
  if (!edges.length) return null;
  const counts = new Map<string, number>();
  for (let i = 0; i < edges.length; i += 1) {
    const l = String(edges[i].label ?? '').trim();
    if (!l) continue;
    counts.set(l, (counts.get(l) || 0) + 1);
  }
  let best: string | null = null;
  let bestCount = -1;
  counts.forEach((count, label) => {
    if (count > bestCount) {
      best = label;
      bestCount = count;
    } else if (count === bestCount && best && label.localeCompare(best) < 0) {
      best = label;
    }
  });
  return best;
};

const resolveTidyTreeDirection = (
  cfg: NonNullable<NonNullable<GraphSchema['layout']>['tidyTree']> | undefined,
  edges: GraphEdge[],
  nodeIds: Set<string>,
): 'source-target' | 'target-source' => {
  const raw = cfg?.direction;
  if (raw === 'source-target' || raw === 'target-source') return raw;
  const countRoots = (dir: 'source-target' | 'target-source') => {
    const parentByChild = new Map<string, string>();
    for (let i = 0; i < edges.length; i += 1) {
      const e = edges[i];
      const src = String(e.source);
      const tgt = String(e.target);
      const parent = dir === 'source-target' ? src : tgt;
      const child = dir === 'source-target' ? tgt : src;
      if (!parent || !child) continue;
      if (parent === child) continue;
      if (!nodeIds.has(parent) || !nodeIds.has(child)) continue;
      if (!parentByChild.has(child)) parentByChild.set(child, parent);
    }
    let roots = 0;
    nodeIds.forEach(id => {
      if (!parentByChild.has(id)) roots += 1;
    });
    return roots;
  };
  const rootsST = countRoots('source-target');
  const rootsTS = countRoots('target-source');
  if (rootsST === 1 && rootsTS !== 1) return 'source-target';
  if (rootsTS === 1 && rootsST !== 1) return 'target-source';
  if (rootsST > 0 && rootsTS > 0) return rootsST <= rootsTS ? 'source-target' : 'target-source';
  if (rootsST > 0) return 'source-target';
  if (rootsTS > 0) return 'target-source';
  return 'source-target';
};

export type TidyTreeDerivation = {
  candidateEdges: GraphEdge[];
  direction: 'source-target' | 'target-source';
  labelSet: Set<string>;
};

type TidyTreeCacheKey = string;

const tidyTreeDerivationCache = new WeakMap<GraphEdge[], Map<TidyTreeCacheKey, TidyTreeDerivation | null>>();

const getTidyTreeCacheKey = (
  cfg: NonNullable<NonNullable<GraphSchema['layout']>['tidyTree']> | undefined,
): TidyTreeCacheKey => {
  const labels = normalizeEdgeLabels(cfg?.edgeLabels);
  const dir = cfg?.direction === 'source-target' || cfg?.direction === 'target-source' ? cfg.direction : 'auto';
  const joined = labels.join('|');
  return `${joined}::${dir}`;
};

export const deriveTidyTreeDerivation = (
  edgesForSim: GraphEdge[],
  schema: GraphSchema,
  nodeIds: Set<string>,
): TidyTreeDerivation | null => {
  const tidyCfg = schema.layout?.tidyTree;
  const cacheKey = getTidyTreeCacheKey(tidyCfg);
  const cachedByCfg = tidyTreeDerivationCache.get(edgesForSim);
  if (cachedByCfg && cachedByCfg.has(cacheKey)) {
    const cached = cachedByCfg.get(cacheKey) || null;
    return cached;
  }

  const configuredLabels = normalizeEdgeLabels(tidyCfg?.edgeLabels);
  const labelToUse = configuredLabels.length > 0 ? null : pickMostCommonEdgeLabel(edgesForSim);
  const labelSet =
    configuredLabels.length > 0
      ? new Set<string>(configuredLabels)
      : labelToUse
        ? new Set<string>([labelToUse])
        : new Set<string>();

  const candidateEdges =
    labelSet.size > 0
      ? edgesForSim.filter(e => labelSet.has(String(e.label ?? '').trim()))
      : edgesForSim.slice();

  if (!candidateEdges.length) {
    if (cachedByCfg) {
      cachedByCfg.set(cacheKey, null);
    } else {
      const m = new Map<TidyTreeCacheKey, TidyTreeDerivation | null>();
      m.set(cacheKey, null);
      tidyTreeDerivationCache.set(edgesForSim, m);
    }
    return null;
  }

  const direction = resolveTidyTreeDirection(tidyCfg, candidateEdges, nodeIds);
  const result: TidyTreeDerivation = { candidateEdges, direction, labelSet };

  if (cachedByCfg) {
    cachedByCfg.set(cacheKey, result);
  } else {
    const m = new Map<TidyTreeCacheKey, TidyTreeDerivation | null>();
    m.set(cacheKey, result);
    tidyTreeDerivationCache.set(edgesForSim, m);
  }

  return result;
};

const applyTidyTreeLayout = (
  nodes: GraphNode[],
  edgesForSim: GraphEdge[],
  width: number,
  height: number,
  schema: GraphSchema,
) => {
  if (!nodes.length) return;
  const nodeById = new Map<string, GraphNode>();
  const nodeIds = new Set<string>();
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i];
    nodeById.set(String(n.id), n);
    nodeIds.add(String(n.id));
  }

  const tidyCfg = schema.layout?.tidyTree;
  const derivation = deriveTidyTreeDerivation(edgesForSim, schema, nodeIds);
  const candidateEdges = derivation?.candidateEdges ?? [];
  const direction = derivation?.direction ?? resolveTidyTreeDirection(tidyCfg, candidateEdges, nodeIds);

  const g = new dagre.graphlib.Graph({ directed: true });
  const padding = schema.layout?.fitPadding ?? 80;
  const orientation = tidyCfg?.orientation === 'vertical' ? 'vertical' : 'horizontal';

  const innerW = Math.max(1, width - 2 * Math.max(0, padding));
  const innerH = Math.max(1, height - 2 * Math.max(0, padding));

  const nodeSizeXRaw = tidyCfg?.nodeSize?.x;
  const nodeSizeYRaw = tidyCfg?.nodeSize?.y;
  const depthBudget = orientation === 'vertical' ? innerH : innerW;
  const paddingColumns = 1;

  const dx =
    typeof nodeSizeXRaw === 'number' && Number.isFinite(nodeSizeXRaw) && nodeSizeXRaw > 0
      ? nodeSizeXRaw
      : 40;
  const dy =
    typeof nodeSizeYRaw === 'number' && Number.isFinite(nodeSizeYRaw) && nodeSizeYRaw > 0
      ? nodeSizeYRaw
      : Math.max(40, depthBudget / Math.max(1, (nodes.length || 1) + paddingColumns));

  const separationRaw = tidyCfg?.separation;
  const separation =
    typeof separationRaw === 'number' && Number.isFinite(separationRaw) && separationRaw > 0
      ? separationRaw
      : 1;

  const nodeSep = dx * separation;
  const rankSep = dy * separation;

  const rankdir = orientation === 'vertical' ? 'TB' : 'LR';

  g.setGraph({
    rankdir,
    nodesep: nodeSep,
    ranksep: rankSep,
  });
  g.setDefaultEdgeLabel(() => ({}));

  nodeIds.forEach(id => {
    const n = nodeById.get(id);
    if (!n) return;
    const radius = getNodeRadiusFromSchema(n, schema);
    const size = Math.max(18, radius * 2);
    const props = (n as { properties?: unknown }).properties as Record<string, unknown> | undefined;
    let rank: number | null = null;
    if (props) {
      const raw = props['visual:layer'];
      if (typeof raw === 'number' && Number.isFinite(raw)) {
        rank = raw;
      } else if (typeof raw === 'string') {
        const parsed = parseFloat(raw);
        if (Number.isFinite(parsed)) rank = parsed;
      }
    }
    const dagreNode = rank != null ? { width: size, height: size, rank } : { width: size, height: size };
    g.setNode(id, dagreNode);
  });

  for (let i = 0; i < candidateEdges.length; i += 1) {
    const e = candidateEdges[i];
    const rawSrc = String(e.source);
    const rawTgt = String(e.target);
    const src = direction === 'source-target' ? rawSrc : rawTgt;
    const tgt = direction === 'source-target' ? rawTgt : rawSrc;
    if (!src || !tgt) continue;
    if (!nodeIds.has(src) || !nodeIds.has(tgt)) continue;
    if (src === tgt) continue;
    g.setEdge(src, tgt);
  }

  if (g.nodeCount() === 0) return;

  dagre.layout(g);

  const coordsById = new Map<string, { x: number; y: number }>();
  g.nodes().forEach(id => {
    const n = g.node(id as string) as { x?: number; y?: number } | undefined;
    if (!n) return;
    const x = typeof n.x === 'number' ? n.x : null;
    const y = typeof n.y === 'number' ? n.y : null;
    if (x == null || y == null) return;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    coordsById.set(String(id), { x, y });
  });

  if (coordsById.size === 0) return;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  coordsById.forEach(p => {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  });
  if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) return;

  const spanX = Math.max(1, maxX - minX);
  const spanY = Math.max(1, maxY - minY);
  const margin = nodeSep * 1.25;
  const spanWithMarginX = Math.max(1, spanX + 2 * margin);
  const spanWithMarginY = Math.max(1, spanY + 2 * margin);
  const scale = Math.min(1, innerW / spanWithMarginX, innerH / spanWithMarginY);

  const offsetX = Math.max(0, padding) + (innerW - spanWithMarginX * scale) / 2 - (minX - margin) * scale;
  const offsetY = Math.max(0, padding) + (innerH - spanWithMarginY * scale) / 2 - (minY - margin) * scale;

  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i];
    const id = String(node.id);
    const p = coordsById.get(id);
    if (!p) continue;
    node.x = offsetX + p.x * scale;
    node.y = offsetY + p.y * scale;
    node.vx = 0;
    node.vy = 0;
    node.fx = null;
    node.fy = null;
  }
};

export const buildSimulation = (
  nodes: GraphNode[],
  edgesForSim: GraphEdge[],
  width: number,
  height: number,
  schema: GraphSchema,
  options?: { skipInitialLayout?: boolean }
) => {
  const linkDist = (e: GraphEdge) => schema.layout?.forces?.linkDistanceByLabel?.[e.label] ?? 100;
  const baseChargeVal = schema.layout?.forces?.charge ?? -300;
  const collisionRadiusByType = schema.layout?.forces?.collisionByType || {};
  const mode = schema.layout?.mode || 'force';
  if (!options?.skipInitialLayout) {
    if (mode === 'radial') {
      applyRadialClusterLayout(nodes, edgesForSim, width, height, schema);
    }
    if (mode === 'tidy-tree') {
      applyTidyTreeLayout(nodes, edgesForSim, width, height, schema);
    }
  }
  const linkForce = d3
    .forceLink<GraphNode, GraphEdge>(edgesForSim)
    .id(d => d.id)
    .distance(linkDist);
  const simulation = d3.forceSimulation<GraphNode>(nodes).force('link', linkForce);
  if (mode === 'radial' || mode === 'tidy-tree') {
    linkForce.strength(0);
  } else {
    const collideRadiusFn = (d: GraphNode) => {
      const configured = collisionRadiusByType[d.type];
      if (typeof configured === 'number' && Number.isFinite(configured) && configured > 0) {
        return configured;
      }
      return getNodeRadiusFromSchema(d, schema);
    };
    simulation
      .force('charge', d3.forceManyBody().strength(baseChargeVal))
      .force('collide', d3.forceCollide<GraphNode>(collideRadiusFn))
      .force('center', d3.forceCenter(Math.max(1, width) / 2, Math.max(1, height) / 2));
  }
  if (schema.layout?.forces?.alphaDecay != null) {
    simulation.alphaDecay(schema.layout.forces.alphaDecay!);
  }
  return simulation;
};

export const buildNeighborIds = (data: { nodes: GraphNode[]; edges: GraphEdge[] }, selectedNodeId?: string | null) => {
  const neighborIds = new Set<string>();
  if (selectedNodeId) {
    data.edges.forEach((e) => {
      const { src, tgt } = getEdgeEndpoints(e as EdgeWithRuntime);
      if (src === selectedNodeId && tgt) neighborIds.add(tgt);
      if (tgt === selectedNodeId && src) neighborIds.add(src);
    });
  }
  return neighborIds;
};

export const buildAdjacencyMap = (data: GraphLike) => {
  const map = new Map<string, Set<string>>();
  data.nodes.forEach((n) => map.set(n.id, new Set<string>()));
  data.edges.forEach((e) => {
    const { src, tgt } = getEdgeEndpoints(e as EdgeWithRuntime);
    const s = src ?? '';
    const t = tgt ?? '';
    if (!s || !t) return;
    if (!map.has(s)) map.set(s, new Set<string>());
    if (!map.has(t)) map.set(t, new Set<string>());
    map.get(s)!.add(t);
    map.get(t)!.add(s);
  });
  return map;
};

const adjCache = new WeakMap<GraphLike, Map<string, Set<string>>>()
export const getAdjacencyMap = (data: GraphLike) => {
  const cached = adjCache.get(data)
  if (cached) return cached
  const built = buildAdjacencyMap(data)
  adjCache.set(data, built)
  return built
}

export const clearAdjacencyCacheFor = (data: GraphLike) => {
  try { adjCache.delete(data) } catch (err) { void err }
}
