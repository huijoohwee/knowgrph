import * as d3 from 'd3';
import { GraphNode, GraphEdge } from '@/lib/graph/types';
import { GraphSchema } from '@/lib/graph/schema';
import { applyRadialClusterLayout } from './layout/radial';
import { getNodeHalfExtents2d } from '@/components/GraphCanvas/nodeSizing2d';
import { computeDisjointComponentTargets } from './layout/disjoint';
import { applyForceModeSeeds } from './layout/seeding';
import { readMermaidAxisFromNodes } from './layout/mermaidDirection';
import { createBboxCollideForce, getNodeCollisionRadius } from './layout/overlap';
import { createGroupBboxCollideForce } from './layout/groupOverlap';
import { createGroupBboxCollideForceByDepth } from './layout/groupOverlapByDepth'
import { createGroupKeyOfNode, computeGroupTargets, type GroupKeyOfNode } from './layout/grouping';
import { readCollisionConfig } from './layout/collisionConfig';
import { readLayoutMode } from './layout/fitConfig';
import { DEFAULT_CENTER_STRENGTH, readFitPadding, readForceCharge, readForceLinkDistance } from '@/lib/graph/layoutDefaults';
import { computeFitFrame, ZOOM_VIEWPORT_PRESET_16_9 } from 'grph-shared/zoom/presets'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'

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

export const buildSimulation = (
  nodes: GraphNode[],
  edgesForSim: GraphEdge[],
  width: number,
  height: number,
  schema: GraphSchema,
  options?: { skipInitialLayout?: boolean; groupKeyOf?: GroupKeyOfNode; groupsForBboxCollide?: GraphGroup[] }
) => {
  const viewW = width > 0 ? width : ZOOM_VIEWPORT_PRESET_16_9.maxWidth
  const viewH = height > 0 ? height : ZOOM_VIEWPORT_PRESET_16_9.maxHeight
  const { frameW, frameH } = computeFitFrame(viewW, viewH, ZOOM_VIEWPORT_PRESET_16_9)

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

  const linkDist = (e: GraphEdge) => readForceLinkDistance(schema, e);
  const chargeStrength = readForceCharge(schema);
  const collisionRadiusByType = schema.layout?.forces?.collisionByType || {};
  const mode = readLayoutMode(schema);
  const disjointEnabled = schema.layout?.forces?.disjointComponents !== false;
  const disjointStrength =
    typeof schema.layout?.forces?.disjointStrength === 'number' ? schema.layout.forces.disjointStrength : 0.1;
  const disjointPadding = Math.max(40, readFitPadding(schema));
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
    const seedGroupKeyOf = options?.groupKeyOf || createGroupKeyOfNode({ nodes, edges: edgesForSim })
    if (mode === 'radial') {
      applyRadialClusterLayout(nodes, edgesForSim, frameW, frameH, schema, seedGroupKeyOf);
      for (let i = 0; i < nodes.length; i += 1) {
        const n = nodes[i]
        n.vx = 0
        n.vy = 0
      }
    }
    if (mode === 'force') {
      applyForceModeSeeds({ nodes, edges: edgesForSim, width: frameW, height: frameH, schema })
    }
  }

  const linkForce = d3
    .forceLink<GraphNode, GraphEdge>(edgesForSim)
    .id(d => d.id)
    .distance(linkDist);
  
  if (mode === 'radial') {
    const simulation = d3.forceSimulation<GraphNode>(nodes)
    simulation.stop()
    return simulation
  }

  const simulation = d3.forceSimulation<GraphNode>(nodes).force('link', linkForce);

    const collideRadiusFn = (d: GraphNode) => {
      const configured = collisionRadiusByType[d.type];
      if (typeof configured === 'number' && Number.isFinite(configured) && configured > 0) return configured;
      return getNodeCollisionRadius(d, schema)
    }

    const collisionCfg = readCollisionConfig(schema)
    const bboxCfg = collisionCfg.nodeBbox

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
    if (portHandlesEnabled && portAxis) {
      for (let i = 0; i < topologyNodes.length; i += 1) {
        const n = topologyNodes[i]
        try {
          ;(n.properties as Record<string, unknown>)['visual:portAxis'] = portAxis.axis
          ;(n.properties as Record<string, unknown>)['visual:portForward'] = portAxis.forward
        } catch {
          void 0
        }
      }
    }
    if (portHandlesEnabled) {
      for (let i = 0; i < topologyNodes.length; i += 1) {
        const n = topologyNodes[i]
        const nid = String(n.id)
        const ind = inDegree.get(nid) || 0
        const outd = outDegree.get(nid) || 0
        const role = ind === 0 && outd > 0 ? 'input' : outd === 0 && ind > 0 ? 'output' : ind > 0 || outd > 0 ? 'process' : ''
        if (!role) continue
        try {
          ;(n.properties as Record<string, unknown>)['visual:portRole'] = role
        } catch {
          void 0
        }
      }
    }

    const groupKeyOf = options?.groupKeyOf || createGroupKeyOfNode({ nodes, edges: edgesForSim })
    const { readGroupTarget } = computeGroupTargets({ nodes, groupKeyOf })

    const xTarget = (n: GraphNode) => {
      if (portHandlesEnabled) {
        const nid = String(n.id)
        const ind = inDegree.get(nid) || 0
        const outd = outDegree.get(nid) || 0
        const role = ind === 0 && outd > 0 ? 'input' : outd === 0 && ind > 0 ? 'output' : ind > 0 || outd > 0 ? 'process' : ''
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
        : DEFAULT_CENTER_STRENGTH
    const anchorStrength = Math.max(0, Math.min(2, disjointStrength)) * 0.08 + Math.max(0, Math.min(2, centerStrength)) * 0.06
    let antiLineTick = 0
    simulation
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('collide', d3.forceCollide<GraphNode>(collideRadiusFn).strength(0.9).iterations(2))
      .force(
        'bboxCollide',
        bboxCfg.enabled
          ? createBboxCollideForce({
              schema,
              paddingX: bboxCfg.paddingX,
              paddingY: bboxCfg.paddingY,
              paddingZ: bboxCfg.paddingZ,
              touchEpsilonPx: bboxCfg.touchEpsilonPx,
              touchEpsilonZPx: bboxCfg.touchEpsilonZPx,
              strength: bboxCfg.strength,
              iterations: bboxCfg.iterations,
            })
          : null,
      )
      .force(
        'groupBboxCollide',
        collisionCfg.groupBbox.enabled
          ? (options?.groupsForBboxCollide && options.groupsForBboxCollide.length > 0
              ? createGroupBboxCollideForceByDepth({
                  schema,
                  groups: options.groupsForBboxCollide,
                  paddingX: collisionCfg.groupBbox.paddingX,
                  paddingY: collisionCfg.groupBbox.paddingY,
                  extraGapPx: collisionCfg.groupBbox.extraGapPx,
                  strength: collisionCfg.groupBbox.strength,
                  iterations: collisionCfg.groupBbox.iterations,
                })
              : createGroupBboxCollideForce({
                  schema,
                  paddingX: collisionCfg.groupBbox.paddingX,
                  paddingY: collisionCfg.groupBbox.paddingY,
                  strength: collisionCfg.groupBbox.strength,
                  iterations: collisionCfg.groupBbox.iterations,
                  groupKeyOf,
                }))
          : null,
      )
      .force('x', d3.forceX<GraphNode>(xTarget).strength(anchorStrength))
      .force('y', d3.forceY<GraphNode>(yTarget).strength(anchorStrength))
       .force('box', () => {
         const enabled = schema.layout?.forces?.boxForce !== false;
         if (!enabled) return;
         const strength = schema.layout?.forces?.boxForceStrength ?? 0.05;
         const alpha = simulation.alpha();
         const alphaMinRaw = (schema.layout?.forces as unknown as { boxForceAlphaMin?: number } | undefined)?.boxForceAlphaMin
         const alphaMin =
           typeof alphaMinRaw === 'number' && Number.isFinite(alphaMinRaw)
             ? Math.max(0.0, Math.min(1.0, alphaMinRaw))
             : 0.12
         if (alpha < alphaMin) return
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
         antiLineTick += 1
         const alphaMinRaw = (schema.layout as unknown as { forces?: { antiLineAlphaMin?: number } })?.forces?.antiLineAlphaMin
         const alphaMin = typeof alphaMinRaw === 'number' && Number.isFinite(alphaMinRaw) ? Math.max(0.0, Math.min(1.0, alphaMinRaw)) : 0.14
         if (alpha < alphaMin) return
         const intervalRaw = (schema.layout as unknown as { forces?: { antiLineTickInterval?: number } })?.forces?.antiLineTickInterval
         const interval = typeof intervalRaw === 'number' && Number.isFinite(intervalRaw) ? Math.max(1, Math.floor(intervalRaw)) : 2
         if (antiLineTick % interval !== 0) return
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

  if (schema.layout?.forces?.alphaDecay != null) {
    simulation.alphaDecay(schema.layout.forces.alphaDecay!);
  }
  return simulation;
};

export const updateForceSimulationPresentation = (args: {
  simulation: d3.Simulation<GraphNode, GraphEdge>
  nodes: GraphNode[]
  width: number
  height: number
  schema: GraphSchema
  groupKeyOf?: GroupKeyOfNode
  groupsForBboxCollide?: GraphGroup[]
}) => {
  const { simulation, nodes, width, height, schema } = args
  const mode = readLayoutMode(schema)
  if (mode === 'radial') return

  const collisionRadiusByType = schema.layout?.forces?.collisionByType || {}
  const collideRadiusFn = (d: GraphNode) => {
    const configured = collisionRadiusByType[d.type]
    if (typeof configured === 'number' && Number.isFinite(configured) && configured > 0) return configured
    return getNodeCollisionRadius(d, schema)
  }

  const collisionCfg = readCollisionConfig(schema)
  const bboxCfg = collisionCfg.nodeBbox

  simulation.force('collide', d3.forceCollide<GraphNode>(collideRadiusFn).strength(0.9).iterations(2))
  simulation.force(
    'bboxCollide',
    bboxCfg.enabled
      ? createBboxCollideForce({
          schema,
          paddingX: bboxCfg.paddingX,
          paddingY: bboxCfg.paddingY,
          paddingZ: bboxCfg.paddingZ,
          touchEpsilonPx: bboxCfg.touchEpsilonPx,
          touchEpsilonZPx: bboxCfg.touchEpsilonZPx,
          strength: bboxCfg.strength,
          iterations: bboxCfg.iterations,
        })
      : null,
  )
  simulation.force(
    'groupBboxCollide',
    collisionCfg.groupBbox.enabled
      ? (args.groupsForBboxCollide && args.groupsForBboxCollide.length > 0
          ? createGroupBboxCollideForceByDepth({
              schema,
              groups: args.groupsForBboxCollide,
              paddingX: collisionCfg.groupBbox.paddingX,
              paddingY: collisionCfg.groupBbox.paddingY,
              extraGapPx: collisionCfg.groupBbox.extraGapPx,
              strength: collisionCfg.groupBbox.strength,
              iterations: collisionCfg.groupBbox.iterations,
            })
          : createGroupBboxCollideForce({
              schema,
              paddingX: collisionCfg.groupBbox.paddingX,
              paddingY: collisionCfg.groupBbox.paddingY,
              strength: collisionCfg.groupBbox.strength,
              iterations: collisionCfg.groupBbox.iterations,
              groupKeyOf: args.groupKeyOf,
            }))
      : null,
  )
  simulation.force('box', () => {
    const enabled = schema.layout?.forces?.boxForce !== false
    if (!enabled) return
    const strength = schema.layout?.forces?.boxForceStrength ?? 0.05
    const alpha = simulation.alpha()
    const k = alpha * strength
    const portHandlesEnabled = Boolean(schema.behavior?.portHandles?.enabled)
    const pad = portHandlesEnabled ? 20 : 28
    const minX = pad
    const minY = pad
    const maxX = Math.max(minX + 1, width - pad)
    const maxY = Math.max(minY + 1, height - pad)
    for (const d of nodes) {
      if (d.x == null || d.y == null) continue
      const { halfW, halfH } = getNodeHalfExtents2d(d, schema)
      const loX = minX + halfW
      const hiX = maxX - halfW
      const loY = minY + halfH
      const hiY = maxY - halfH
      if (d.x < loX) d.vx = (d.vx ?? 0) + (loX - d.x) * k * 2.2
      if (d.x > hiX) d.vx = (d.vx ?? 0) - (d.x - hiX) * k * 2.2
      if (d.y < loY) d.vy = (d.vy ?? 0) + (loY - d.y) * k * 2.2
      if (d.y > hiY) d.vy = (d.vy ?? 0) - (d.y - hiY) * k * 2.2
    }
  })

  simulation.alphaTarget(0.18).restart()
}

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
