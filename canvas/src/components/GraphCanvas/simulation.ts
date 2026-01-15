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
