import * as d3 from 'd3';
import { GraphNode, GraphEdge } from '@/lib/graph/types';
import { GraphSchema, getNodeRadiusFromSchema } from '@/lib/graph/schema';
import { applyRadialClusterLayout } from './layout/radial';
import { getNodeHalfExtents2d, getNodeRectDimensions2d, getNodeRenderShape2d } from '@/components/GraphCanvas/nodeSizing2d';
import { computeDisjointComponentTargets } from './layout/disjoint';
import { createBboxCollideForce, getNodeCollisionRadius } from './layout/overlap';

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
    if (fromVisual > 0) return Math.max(10, fromVisual)
    if (getNodeRenderShape2d(n, schema) === 'rect') {
      const { width, height } = getNodeRectDimensions2d(n, schema)
      return Math.max(10, Math.max(width, height) / 2)
    }
    return Math.max(10, fromSchema)
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
    const props = (n.properties || {}) as Record<string, unknown>
    const community = normalizeCommunityKey(props['visual:community'])
    const key = community ? `community:${community}` : ''
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
  const frameW = 1920
  const frameH = 1080

  const recenterNodesToFrame = () => {
    if (!nodes.length) return
    let sumX = 0
    let sumY = 0
    let count = 0
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
      const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
      if (x == null || y == null) continue
      sumX += x
      sumY += y
      count += 1
    }
    if (count <= 0) return
    const cx = sumX / count
    const cy = sumY / count
    if (!Number.isFinite(cx) || !Number.isFinite(cy)) return
    const dx = frameW / 2 - cx
    const dy = frameH / 2 - cy
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return
    if (Math.abs(dx) + Math.abs(dy) < 1) return
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
      const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
      if (x == null || y == null) continue
      const nx = x + dx
      const ny = y + dy
      if (!Number.isFinite(nx) || !Number.isFinite(ny)) continue
      n.x = nx
      n.y = ny
      if (typeof n.fx === 'number' && Number.isFinite(n.fx)) n.fx = n.fx + dx
      if (typeof n.fy === 'number' && Number.isFinite(n.fy)) n.fy = n.fy + dy
    }
  }

  const linkDist = (e: GraphEdge) => schema.layout?.forces?.linkDistanceByLabel?.[e.label] ?? 120;
  const schemaCharge = schema.layout?.forces?.charge;
  const baseChargeVal = typeof schemaCharge === 'number' ? schemaCharge * 1.5 : -600;
  const collisionRadiusByType = schema.layout?.forces?.collisionByType || {};
  const mode = schema.layout?.mode === 'radial' ? 'radial' : 'force';
  const disjointEnabled = schema.layout?.forces?.disjointComponents !== false;
  const disjointStrength =
    typeof schema.layout?.forces?.disjointStrength === 'number' ? schema.layout.forces.disjointStrength : 0.1;
  const disjointPadding = Math.max(40, schema.layout?.fitPadding ?? 80);
  const disjointLayout =
    mode === 'force' && disjointEnabled
      ? computeDisjointComponentTargets({
          nodes,
          edges: edgesForSim,
          width: frameW,
          height: frameH,
          schema,
          padding: disjointPadding,
        })
      : null;
  if (!options?.skipInitialLayout) {
    if (mode === 'radial') {
      applyRadialClusterLayout(nodes, edgesForSim, frameW, frameH, schema);
    }
    if (mode === 'force') {
      applyClusterAwareHeuristicSeedLayout({ nodes, width: frameW, height: frameH, schema })
    }
  }
  recenterNodesToFrame()

  const linkForce = d3
    .forceLink<GraphNode, GraphEdge>(edgesForSim)
    .id(d => d.id)
    .distance(linkDist);
  const simulation = d3.forceSimulation<GraphNode>(nodes).force('link', linkForce);
  if (mode === 'radial') {
    linkForce.strength(0);
  } else {
    const collideRadiusFn = (d: GraphNode) => {
      const configured = collisionRadiusByType[d.type];
      if (typeof configured === 'number' && Number.isFinite(configured) && configured > 0) return configured;
      return getNodeCollisionRadius(d, schema)
    }

    const forces = (schema.layout?.forces || {}) as GraphSchema['layout']['forces'] & {
      bboxCollide?: boolean
      bboxCollideStrength?: number
      bboxCollidePadding?: number
      bboxCollideIterations?: number
    }
    const bboxCollideEnabled = forces.bboxCollide !== false
    const bboxPadding =
      typeof forces.bboxCollidePadding === 'number' && Number.isFinite(forces.bboxCollidePadding)
        ? forces.bboxCollidePadding
        : 10
    const bboxStrength =
      typeof forces.bboxCollideStrength === 'number' && Number.isFinite(forces.bboxCollideStrength)
        ? forces.bboxCollideStrength
        : 0.7
    const bboxIterations =
      typeof forces.bboxCollideIterations === 'number' && Number.isFinite(forces.bboxCollideIterations)
        ? forces.bboxCollideIterations
        : 1

    const xTarget = (n: GraphNode) => {
      if (!disjointLayout) return frameW / 2
      const comp = disjointLayout.componentByNodeId.get(String(n.id))
      if (comp == null) return frameW / 2
      const t = disjointLayout.targetsByComponent.get(comp)
      return t ? t.x : frameW / 2
    }
    const yTarget = (n: GraphNode) => {
      if (!disjointLayout) return frameH / 2
      const comp = disjointLayout.componentByNodeId.get(String(n.id))
      if (comp == null) return frameH / 2
      const t = disjointLayout.targetsByComponent.get(comp)
      return t ? t.y : frameH / 2
    }

    const centerStrength =
      typeof schema.layout?.forces?.centerStrength === 'number' && Number.isFinite(schema.layout.forces.centerStrength)
        ? schema.layout.forces.centerStrength
        : 1
    const anchorStrength = Math.max(0, Math.min(2, disjointStrength)) * 0.08 + Math.max(0, Math.min(2, centerStrength)) * 0.06
    simulation
      .force('charge', d3.forceManyBody().strength(baseChargeVal))
      .force('collide', d3.forceCollide<GraphNode>(collideRadiusFn).strength(0.9).iterations(2))
      .force('bboxCollide', bboxCollideEnabled ? createBboxCollideForce({ schema, padding: bboxPadding, strength: bboxStrength, iterations: bboxIterations }) : null)
      .force('x', d3.forceX<GraphNode>(xTarget).strength(anchorStrength))
      .force('y', d3.forceY<GraphNode>(yTarget).strength(anchorStrength))
       .force('box', () => {
         const enabled = schema.layout?.forces?.boxForce !== false;
         if (!enabled) return;
         const strength = schema.layout?.forces?.boxForceStrength ?? 0.05;
         const alpha = simulation.alpha();
         const k = alpha * strength;
         const portHandlesEnabled = Boolean(schema.behavior?.portHandles?.enabled);
         const pad = portHandlesEnabled ? 20 : 28;
         const minX = pad;
         const minY = pad;
         const maxX = Math.max(minX + 1, frameW - pad);
         const maxY = Math.max(minY + 1, frameH - pad);
         for (const d of nodes) {
           if (d.x == null || d.y == null) continue;
           const { halfW, halfH } = getNodeHalfExtents2d(d, schema);
           const loX = minX + halfW;
           const hiX = maxX - halfW;
           const loY = minY + halfH;
           const hiY = maxY - halfH;
           if (d.x < loX) d.vx = (d.vx ?? 0) + (loX - d.x) * k * 2.2;
           if (d.x > hiX) d.vx = (d.vx ?? 0) - (d.x - hiX) * k * 2.2;
           if (d.y < loY) d.vy = (d.vy ?? 0) + (loY - d.y) * k * 2.2;
           if (d.y > hiY) d.vy = (d.vy ?? 0) - (d.y - hiY) * k * 2.2;
         }
       })
       .force('antiLine', () => {
         const enabled = (schema.layout as unknown as { forces?: { antiLineForce?: boolean; antiLineStrength?: number } })?.forces?.antiLineForce !== false
         if (!enabled) return
         const strengthRaw = (schema.layout as unknown as { forces?: { antiLineStrength?: number } })?.forces?.antiLineStrength
         const strength = typeof strengthRaw === 'number' && Number.isFinite(strengthRaw) ? strengthRaw : 0.04
         const alpha = simulation.alpha()
         const k = alpha * strength
         if (k <= 0) return

         let minX = Infinity
         let maxX = -Infinity
         let minY = Infinity
         let maxY = -Infinity
         let sumX = 0
         let sumY = 0
         let count = 0
         for (let i = 0; i < nodes.length; i += 1) {
           const n = nodes[i]
           const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
           const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
           if (x == null || y == null) continue
           if (x < minX) minX = x
           if (x > maxX) maxX = x
           if (y < minY) minY = y
           if (y > maxY) maxY = y
           sumX += x
           sumY += y
           count += 1
         }
         if (count < 6 || minX === Infinity) return
         const spanX = maxX - minX
         const spanY = maxY - minY
         const cx = sumX / count
         const cy = sumY / count
         const ratio = spanX / Math.max(1e-6, spanY)

         let cov = 0
         let varX = 0
         let varY = 0
         for (let i = 0; i < nodes.length; i += 1) {
           const n = nodes[i]
           const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
           const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
           if (x == null || y == null) continue
           const dx = x - cx
           const dy = y - cy
           cov += dx * dy
           varX += dx * dx
           varY += dy * dy
         }
         const denom = Math.sqrt(Math.max(1e-6, varX) * Math.max(1e-6, varY))
         const corr = denom > 0 ? cov / denom : 0

         const hash01 = (id: string): number => {
           let h = 2166136261
           for (let i = 0; i < id.length; i += 1) {
             h ^= id.charCodeAt(i)
             h = Math.imul(h, 16777619)
           }
           const u = (h >>> 0) / 4294967296
           return u
         }

         const scale = Math.max(40, Math.min(420, Math.max(spanX, spanY) * 0.06))

         if (ratio > 6) {
           for (let i = 0; i < nodes.length; i += 1) {
             const n = nodes[i]
             if (n.x == null || n.y == null) continue
             const u = hash01(String(n.id))
             const s = (u - 0.5) * 2
             n.vy = (n.vy ?? 0) + s * k * scale
           }
           return
         }
         if (ratio < 1 / 6) {
           for (let i = 0; i < nodes.length; i += 1) {
             const n = nodes[i]
             if (n.x == null || n.y == null) continue
             const u = hash01(String(n.id))
             const s = (u - 0.5) * 2
             n.vx = (n.vx ?? 0) + s * k * scale
           }
           return
         }

         if (Math.abs(corr) > 0.96) {
           const span = Math.max(1e-6, Math.max(spanX, spanY))
           for (let i = 0; i < nodes.length; i += 1) {
             const n = nodes[i]
             const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
             const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
             if (x == null || y == null) continue
             const u = hash01(String(n.id))
             const s = (u - 0.5) * 2
             const dx = x - cx
             const dy = y - cy
             const px = -dy
             const py = dx
             const norm = Math.sqrt(px * px + py * py) || 1
             n.vx = (n.vx ?? 0) + (px / norm) * s * k * (span * 0.25)
             n.vy = (n.vy ?? 0) + (py / norm) * s * k * (span * 0.25)
           }
         }
       })
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
