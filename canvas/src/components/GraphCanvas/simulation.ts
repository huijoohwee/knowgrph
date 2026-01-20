import * as d3 from 'd3';
import { GraphNode, GraphEdge } from '@/lib/graph/types';
import { GraphSchema } from '@/lib/graph/schema';
import { applyRadialClusterLayout } from './layout/radial';
import { getNodeHalfExtents2d } from '@/components/GraphCanvas/nodeSizing2d';
import { computeDisjointComponentTargets } from './layout/disjoint';
import { applyClusterAwareHeuristicSeedLayout } from './layout/heuristic-cluster';
import { applyMermaidSeedLayout } from './layout/mermaidSeed';
import { applyMarkdownHeadingSeedLayout } from './layout/markdownHeadingSeed';
import { readMermaidAxisFromNodes } from './layout/mermaidDirection';
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

export const buildSimulation = (
  nodes: GraphNode[],
  edgesForSim: GraphEdge[],
  width: number,
  height: number,
  schema: GraphSchema,
  options?: { skipInitialLayout?: boolean }
) => {
  const frameW = width > 0 ? width : 1920
  const frameH = height > 0 ? height : 1080

  const computeTopology = (ns: GraphNode[], es: GraphEdge[]) => {
    const inDegree = new Map<string, number>()
    const outDegree = new Map<string, number>()
    ns.forEach(n => {
      inDegree.set(String(n.id), 0)
      outDegree.set(String(n.id), 0)
    })
    es.forEach(e => {
      const s = typeof e.source === 'object' ? (e.source as { id: string }).id : e.source
      const t = typeof e.target === 'object' ? (e.target as { id: string }).id : e.target
      if (s && outDegree.has(String(s))) outDegree.set(String(s), (outDegree.get(String(s)) || 0) + 1)
      if (t && inDegree.has(String(t))) inDegree.set(String(t), (inDegree.get(String(t)) || 0) + 1)
    })
    return { inDegree, outDegree }
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
      applyMermaidSeedLayout({ nodes, edges: edgesForSim, width: frameW, height: frameH, schema })
      applyMarkdownHeadingSeedLayout({ nodes, edges: edgesForSim, width: frameW, height: frameH, schema })
      applyClusterAwareHeuristicSeedLayout({ nodes, width: frameW, height: frameH, schema })
    }
  }

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

    const portHandlesEnabled = Boolean(schema.behavior?.portHandles?.enabled)
    const hasMermaidNodes = portHandlesEnabled && nodes.some(n => String(n.type || '') === 'MermaidNode')
    const topologyNodes = hasMermaidNodes ? nodes.filter(n => String(n.type || '') === 'MermaidNode') : nodes
    const topologyNodeIds = hasMermaidNodes ? new Set(topologyNodes.map(n => String(n.id))) : null
    const topologyEdges = hasMermaidNodes
      ? edgesForSim.filter(e => {
          if (String(e.label || '') !== 'pointsTo') return false
          const s = typeof e.source === 'object' ? (e.source as { id: string }).id : e.source
          const t = typeof e.target === 'object' ? (e.target as { id: string }).id : e.target
          return !!s && !!t && topologyNodeIds?.has(String(s)) && topologyNodeIds?.has(String(t))
        })
      : edgesForSim
    const { inDegree, outDegree } = portHandlesEnabled ? computeTopology(topologyNodes, topologyEdges) : { inDegree: new Map(), outDegree: new Map() }
    const portAxis = portHandlesEnabled ? readMermaidAxisFromNodes(nodes) : null

    const computeGroupTargets = () => {
      const sectionIds = new Set<string>()
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i]
        if (String(n.type || '') !== 'Section') continue
        const props = (n.properties || {}) as Record<string, unknown>
        if (typeof props.level !== 'number' || !Number.isFinite(props.level)) continue
        sectionIds.add(String(n.id))
      }

      const parentOf = new Map<string, string>()
      for (let i = 0; i < edgesForSim.length; i += 1) {
        const e = edgesForSim[i]
        const lbl = String(e.label || '')
        if (lbl !== 'hasSection' && lbl !== 'hasBlock' && lbl !== 'hasItem' && lbl !== 'embedsImage') continue
        const s = typeof e.source === 'object' ? (e.source as { id: string }).id : e.source
        const t = typeof e.target === 'object' ? (e.target as { id: string }).id : e.target
        const src = String(s || '')
        const tgt = String(t || '')
        if (!src || !tgt) continue
        if (!parentOf.has(tgt)) parentOf.set(tgt, src)
      }

      const topSectionOf = (nodeId: string): string | null => {
        const seen = new Set<string>()
        let cur: string | null = nodeId
        let section: string | null = null
        while (cur && !seen.has(cur)) {
          seen.add(cur)
          if (sectionIds.has(cur)) section = cur
          cur = parentOf.get(cur) || null
        }
        if (!section) return null
        cur = section
        while (cur) {
          const p = parentOf.get(cur)
          if (!p || !sectionIds.has(p)) break
          cur = p
        }
        return cur || section
      }

      const groupAcc = new Map<string, { sx: number; sy: number; n: number }>()
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i]
        const id = String(n.id)
        if (!id || sectionIds.has(id)) continue
        const gid = topSectionOf(id)
        if (!gid) continue
        const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
        const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
        if (x == null || y == null) continue
        const prev = groupAcc.get(gid) || { sx: 0, sy: 0, n: 0 }
        groupAcc.set(gid, { sx: prev.sx + x, sy: prev.sy + y, n: prev.n + 1 })
      }

      const groupTarget = new Map<string, { x: number; y: number }>()
      groupAcc.forEach((v, gid) => {
        if (v.n <= 0) return
        groupTarget.set(gid, { x: v.sx / v.n, y: v.sy / v.n })
      })

      const groupKeyOf = (n: GraphNode): string | null => {
        const p = (n.properties || {}) as Record<string, unknown>
        const top = typeof p['visual:topParentId'] === 'string' ? (p['visual:topParentId'] as string).trim() : ''
        if (top) return top
        const parent = typeof p['visual:parentId'] === 'string' ? (p['visual:parentId'] as string).trim() : ''
        if (parent) return parent
        const nid = String(n.id)
        return topSectionOf(nid)
      }

      const readGroupTarget = (n: GraphNode): { x: number; y: number } | null => {
        const gid = groupKeyOf(n)
        if (!gid) return null
        return groupTarget.get(gid) || null
      }

      return { readGroupTarget }
    }

    const { readGroupTarget } = computeGroupTargets()

    const xTarget = (n: GraphNode) => {
      if (portHandlesEnabled) {
        const nid = String(n.id)
        const ind = inDegree.get(nid) || 0
        const outd = outDegree.get(nid) || 0
        const role = ind === 0 && outd > 0 ? 'input' : outd === 0 && ind > 0 ? 'output' : ind > 0 || outd > 0 ? 'process' : ''
        if (role) {
          try { (n.properties as Record<string, unknown>)['visual:portRole'] = role } catch { void 0 }
        }
        if (portAxis?.axis === 'x') {
          if (role === 'input') return portAxis.forward > 0 ? 40 : frameW - 40
          if (role === 'output') return portAxis.forward > 0 ? frameW - 40 : 40
        }
        const gt = readGroupTarget(n)
        if (gt) return gt.x
      }

      const gt = readGroupTarget(n)
      if (gt) return gt.x
      
      if (!disjointLayout) return frameW / 2
      const comp = disjointLayout.componentByNodeId.get(String(n.id))
      if (comp == null) return frameW / 2
      const t = disjointLayout.targetsByComponent.get(comp)
      return t ? t.x : frameW / 2
    }
    const yTarget = (n: GraphNode) => {
      if (portHandlesEnabled) {
        const nid = String(n.id)
        const ind = inDegree.get(nid) || 0
        const outd = outDegree.get(nid) || 0
        const role = ind === 0 && outd > 0 ? 'input' : outd === 0 && ind > 0 ? 'output' : null
        if (portAxis?.axis === 'y') {
          if (role === 'input') return portAxis.forward > 0 ? 40 : frameH - 40
          if (role === 'output') return portAxis.forward > 0 ? frameH - 40 : 40
        }
        const gt = readGroupTarget(n)
        if (gt) return gt.y
      }
      const gt = readGroupTarget(n)
      if (gt) return gt.y
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
