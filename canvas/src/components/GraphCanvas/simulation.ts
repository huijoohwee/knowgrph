import * as d3 from 'd3';
import { GraphNode, GraphEdge } from '@/lib/graph/types';
import { GraphSchema, getNodeRadiusFromSchema } from '@/lib/graph/schema';
import { applyTreeLayout } from './layout/tree';
import { applyRadialClusterLayout } from './layout/radial';
import { applyMermaidLayout } from './layout/mermaid';

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

// Removed applyRadialClusterLayout - moved to ./layout/radial.ts

const applyClusterAwareHeuristicSeedLayout = (args: {
  nodes: GraphNode[]
  width: number
  height: number
  schema: GraphSchema
}): void => {
  const { nodes, width, height, schema } = args
  if (!nodes.length) return

  let valid = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const x = nodes[i].x
    const y = nodes[i].y
    if (typeof x === 'number' && Number.isFinite(x) && typeof y === 'number' && Number.isFinite(y)) valid += 1
  }
  if (valid / Math.max(1, nodes.length) >= 0.2) return

  const estimateRadius = (n: GraphNode): number => {
    const props = (n.properties || {}) as Record<string, unknown>
    const vw = typeof props['visual:width'] === 'number' && Number.isFinite(props['visual:width']) ? (props['visual:width'] as number) : 0
    const vh = typeof props['visual:height'] === 'number' && Number.isFinite(props['visual:height']) ? (props['visual:height'] as number) : 0
    const fromVisual = Math.max(vw, vh) > 0 ? Math.max(vw, vh) / 2 : 0
    const fromSchema = getNodeRadiusFromSchema(n, schema) || 20
    return Math.max(10, fromVisual || fromSchema)
  }

  const normalizeStringKey = (raw: unknown): string => {
    const s = typeof raw === 'string' ? raw.trim() : ''
    return s
  }

  const normalizeCommunityKey = (raw: unknown): string => {
    if (typeof raw === 'number') return Number.isFinite(raw) ? String(raw) : ''
    if (typeof raw === 'string') return raw.trim()
    return ''
  }

  const clusters = new Map<string, GraphNode[]>()
  const unclustered: GraphNode[] = []

  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const t = String(n.type || '')
    if (t === 'MermaidSubgraph') continue
    const props = (n.properties || {}) as Record<string, unknown>
    const subgraph = normalizeStringKey(props.mermaidSubgraphName)
    const community = normalizeCommunityKey(props['visual:community'])
    const key = subgraph ? `subgraph:${subgraph}` : (community ? `community:${community}` : '')
    if (!key) {
      unclustered.push(n)
      continue
    }
    const arr = clusters.get(key) || []
    arr.push(n)
    clusters.set(key, arr)
  }

  const unclusteredByType = new Map<string, GraphNode[]>()
  for (let i = 0; i < unclustered.length; i += 1) {
    const n = unclustered[i]
    const key = String(n.type || 'unknown') || 'unknown'
    const arr = unclusteredByType.get(key) || []
    arr.push(n)
    unclusteredByType.set(key, arr)
  }

  const entries: Array<{ key: string; nodes: GraphNode[] }> = []
  clusters.forEach((value, key) => {
    entries.push({ key, nodes: value })
  })
  unclusteredByType.forEach((value, key) => {
    entries.push({ key: `type:${key}`, nodes: value })
  })
  entries.sort((a, b) => a.key.localeCompare(b.key))

  if (!entries.length) return

  let sumR = 0
  let countR = 0
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const t = String(n.type || '')
    if (t === 'MermaidSubgraph') continue
    sumR += estimateRadius(n)
    countR += 1
  }
  const meanR = countR > 0 ? sumR / countR : 20
  const nodePadding = 12
  const nodeSpacing = Math.max(40, (meanR + nodePadding) * 2)

  const clusterRadius = (n: number): number => nodeSpacing * (0.5 + Math.sqrt(Math.max(1, n)))
  let maxClusterR = 0
  for (let i = 0; i < entries.length; i += 1) {
    const r = clusterRadius(entries[i].nodes.length)
    if (r > maxClusterR) maxClusterR = r
  }

  const w = Math.max(1, width)
  const h = Math.max(1, height)
  const aspect = w / h
  const cols = Math.max(1, Math.ceil(Math.sqrt(entries.length * Math.max(0.2, aspect))))
  const rows = Math.max(1, Math.ceil(entries.length / cols))
  const cellW = maxClusterR * 2 + nodeSpacing
  const cellH = maxClusterR * 2 + nodeSpacing
  const startX = w / 2 - ((cols - 1) * cellW) / 2
  const startY = h / 2 - ((rows - 1) * cellH) / 2

  const placeCluster = (clusterNodes: GraphNode[], cx: number, cy: number) => {
    const sorted = [...clusterNodes].sort((a, b) => String(a.id).localeCompare(String(b.id)))
    if (!sorted.length) return

    const setNode = (n: GraphNode, x: number, y: number) => {
      n.x = x
      n.y = y
      n.vx = 0
      n.vy = 0
      n.fx = null
      n.fy = null
    }

    setNode(sorted[0], cx, cy)
    if (sorted.length === 1) return

    let placed = 1
    let ring = 0
    while (placed < sorted.length) {
      ring += 1
      const ringRadius = ring * nodeSpacing * 0.75
      const slots = Math.max(6, Math.floor((2 * Math.PI * ringRadius) / nodeSpacing))
      for (let s = 0; s < slots && placed < sorted.length; s += 1) {
        const angle = (s / slots) * Math.PI * 2
        const x = cx + ringRadius * Math.cos(angle)
        const y = cy + ringRadius * Math.sin(angle)
        setNode(sorted[placed], x, y)
        placed += 1
      }
    }
  }

  for (let idx = 0; idx < entries.length; idx += 1) {
    const col = idx % cols
    const row = Math.floor(idx / cols)
    const cx = startX + col * cellW
    const cy = startY + row * cellH
    placeCluster(entries[idx].nodes, cx, cy)
  }
}

export const buildSimulation = (
  nodes: GraphNode[],
  edgesForSim: GraphEdge[],
  width: number,
  height: number,
  schema: GraphSchema,
  options?: { skipInitialLayout?: boolean }
) => {
  const linkDist = (e: GraphEdge) => schema.layout?.forces?.linkDistanceByLabel?.[e.label] ?? 150;
  const baseChargeVal = schema.layout?.forces?.charge ?? -500;
  const collisionRadiusByType = schema.layout?.forces?.collisionByType || {};
  const mode = schema.layout?.mode || 'force';
  if (!options?.skipInitialLayout) {
    if (mode === 'radial') {
      applyRadialClusterLayout(nodes, edgesForSim, width, height, schema);
    }
    if (mode === 'tree') {
      applyTreeLayout(nodes, edgesForSim, width, height, schema);
    }
    if (mode === 'mermaid') {
      applyMermaidLayout(nodes, edgesForSim, width, height, schema);
    }
    if (mode === 'force') {
      applyClusterAwareHeuristicSeedLayout({ nodes, width, height, schema })
    }
  }
  const linkForce = d3
    .forceLink<GraphNode, GraphEdge>(edgesForSim)
    .id(d => d.id)
    .distance(linkDist);
  const simulation = d3.forceSimulation<GraphNode>(nodes).force('link', linkForce);
  if (mode === 'radial' || mode === 'tree' || mode === 'mermaid') {
    linkForce.strength(0);
  } else {
    const collideRadiusFn = (d: GraphNode) => {
      const configured = collisionRadiusByType[d.type];
      if (typeof configured === 'number' && Number.isFinite(configured) && configured > 0) {
        return configured;
      }
      return (getNodeRadiusFromSchema(d, schema) || 20) * 1.5;
    };
    simulation
      .force('charge', d3.forceManyBody().strength(baseChargeVal))
      .force('collide', d3.forceCollide<GraphNode>(collideRadiusFn).strength(0.7))
      .force('center', d3.forceCenter(Math.max(1, width) / 2, Math.max(1, height) / 2))
       .force('box', () => {
         const enabled = schema.layout?.forces?.boxForce !== false;
         if (!enabled) return;
         const strength = schema.layout?.forces?.boxForceStrength ?? 0.05;
         const cx = Math.max(1, width) / 2;
         const cy = Math.max(1, height) / 2;
         // Tighter constraints: keep nodes mostly within the viewport (0.48 allows slight bleed but keeps center visible)
         const limitX = Math.max(1, width) * 0.48;
         const limitY = Math.max(1, height) * 0.48;
         const alpha = simulation.alpha();
         const k = alpha * strength;
         for (const d of nodes) {
           if (d.x == null || d.y == null) continue;
           const dx = d.x - cx;
           const dy = d.y - cy;
           // Apply force if outside limits
           if (Math.abs(dx) > limitX) {
              d.vx! -= (dx - Math.sign(dx) * limitX) * k;
           }
           if (Math.abs(dy) > limitY) {
              d.vy! -= (dy - Math.sign(dy) * limitY) * k;
           }
         }
       });
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
