import * as d3 from 'd3'
import type { MutableRefObject, RefObject } from 'react'
import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation'
import { calcMouseGraphPosition, isNodePointerTarget } from '@/features/canvas/utils'
import { getRenderNodeRadius2d } from '@/components/GraphCanvas/helpers'
import type { EdgeWithRuntime } from '@/components/GraphCanvas/utils'
import { getEdgeEndpointFromPorts, getPortHandlePosition, getPortHandlesConfig, type PortHandleDatum } from '@/components/GraphCanvas/portHandles'
import { getFlowPortHandlePosition2d, type FlowPortHandleDatum2d } from '@/components/GraphCanvas/flowPortHandles2d'
import { getNodeRectDimensions2d, getNodeRenderShape2d } from '@/components/GraphCanvas/nodeSizing2d'
import { buildNodeShapePathD } from '@/components/GraphCanvas/shapePaths2d'
import { buildChevronPathD } from '@/components/GraphCanvas/layers/svgChevron'
import { estimateLabelCharWidthPx, pickEdgeLabelPlacement, type AabbRect } from '@/components/GraphCanvas/layout/utils'
import { createBboxCollideForce, getNodeAabbHalfExtentsWithLabel } from '@/components/GraphCanvas/layout/overlap'
import { createGroupBboxCollideForceByDepth } from '@/components/GraphCanvas/layout/groupOverlapByDepth'
import { readCollisionConfig } from '@/components/GraphCanvas/layout/collisionConfig'
import { integrateNodePositionWithVelocity, runRelaxSteps } from '@/lib/graph/collision/relaxRunner'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { readLabelPresentation2d } from '@/lib/canvas/labelPresentation2d'
import { aabbOverlaps, aabbOverlapsAny } from '@/lib/ui/labels/aabb'

type SvgSelection = d3.Selection<SVGSVGElement, unknown, null, undefined>

export const attachSimulationTick = (args: {
  svgEl: SVGSVGElement
  simulation: d3.Simulation<GraphNode, GraphEdge>
  nodeSelRef: MutableRefObject<d3.Selection<SVGElement, GraphNode, SVGGElement, unknown> | null>
  groupChevronSelRef: MutableRefObject<d3.Selection<SVGPathElement, GraphNode, SVGGElement, unknown> | null>
  mediaSelRef: MutableRefObject<d3.Selection<SVGGraphicsElement, GraphNode, SVGGElement, unknown> | null>
  portHandlesSelRef: MutableRefObject<
    d3.Selection<SVGCircleElement, PortHandleDatum | FlowPortHandleDatum2d, SVGGElement, unknown> | null
  >
  linkHitSelRef: MutableRefObject<d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null>
  linkSelRef: MutableRefObject<d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null>
  edgeLabelSel?: d3.Selection<SVGTextElement, GraphEdge, SVGGElement, unknown> | null
  labelsSelRef: MutableRefObject<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>
  nodes: GraphNode[]
  nodeById?: Map<string, GraphNode> | null
  groupsForBboxCollide?: GraphGroup[]
  getSchema: () => GraphSchema
  documentSemanticMode?: 'document' | 'keyword'
  width: number
  height: number
  beforeRenderFrameRef?: MutableRefObject<(() => void) | null>
  afterRenderFrame?: (args: { alpha: number; tick: number }) => void
}) => {
  const {
    svgEl,
    simulation,
    nodeSelRef,
    groupChevronSelRef,
    mediaSelRef,
    portHandlesSelRef,
    linkHitSelRef,
    linkSelRef,
    edgeLabelSel,
    labelsSelRef,
    nodes,
    getSchema,
    width,
    height,
    beforeRenderFrameRef,
    afterRenderFrame,
  } = args
  const nodeById = args.nodeById || new Map<string, GraphNode>()
  const groupsForBboxCollide = Array.isArray(args.groupsForBboxCollide) ? args.groupsForBboxCollide : []
  if (!args.nodeById) {
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      nodeById.set(String(n.id), n)
    }
  }
  let lastSchema: GraphSchema | null = null
  const nodeMetricsCache = new Map<string, { width: number; height: number; r: number; key: string }>()
  const groupLabelNudgeById = new Map<string, { dx: number; dy: number }>()
  let lastLabelRelaxMode: 'compact' | 'wrap' = 'wrap'
  let lastLabelRelaxTick = -1
  let lastStrictOverlapTick = -1
  let strictOverlapForcesCache:
    | null
    | {
        schema: GraphSchema
        nodeForce: ((alpha: number) => void) | null
        groupForce: ((alpha: number) => void) | null
        forces: Array<(alpha: number) => void>
      } = null

  const seedRand = (seed: number): (() => number) => {
    let a = seed >>> 0
    return () => {
      a |= 0
      a = (a + 0x6d2b79f5) | 0
      let t = Math.imul(a ^ (a >>> 15), 1 | a)
      t ^= t + Math.imul(t ^ (t >>> 7), 61 | t)
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
  }

  const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v))

  const resolveNode = (endpoint: unknown): GraphNode | null => {
    if (endpoint && typeof endpoint === 'object') {
      const maybeNode = endpoint as Partial<GraphNode>
      if (typeof maybeNode.x === 'number' && typeof maybeNode.y === 'number') {
        return maybeNode as GraphNode
      }
      const maybeId = (endpoint as { id?: unknown }).id
      if (typeof maybeId === 'string' || typeof maybeId === 'number') {
        return nodeById.get(String(maybeId)) ?? null
      }
    }
    if (typeof endpoint === 'string' || typeof endpoint === 'number') {
      return nodeById.get(String(endpoint)) ?? null
    }
    return null
  }

  let tick = 0
  const renderFrame = () => {
    tick += 1
    const beforeRenderFrame = beforeRenderFrameRef ? beforeRenderFrameRef.current : null
    if (beforeRenderFrame) beforeRenderFrame()
    const schema = getSchema()
    if (schema !== lastSchema) {
      nodeMetricsCache.clear()
      strictOverlapForcesCache = null
      lastSchema = schema
    }
    const portHandlesCfg = getPortHandlesConfig(schema)
    const portHandlesEnabled = portHandlesCfg.enabled
    const baseDxFallback = schema.labelStyles?.offset?.dx ?? 12
    const baseDyFallback = schema.labelStyles?.offset?.dy ?? 4
    const labelFontSize = readLabelPresentation2d({ schema, documentSemanticMode: args.documentSemanticMode }).nodeFontSizePx
    const labelRelaxCfg = schema.performance?.labelRelax || {}
    const maxNodesForRelaxRaw = (labelRelaxCfg as { maxNodesForRelax?: number }).maxNodesForRelax
    const maxNodesForRelax = (() => {
      if (typeof maxNodesForRelaxRaw !== 'number' || !Number.isFinite(maxNodesForRelaxRaw)) return 3600
      const v = Math.floor(maxNodesForRelaxRaw)
      if (v <= 0) return 0
      return Math.min(8000, v)
    })()
    const maxNodeLabelsRaw = (labelRelaxCfg as { maxNodeLabels?: number }).maxNodeLabels
    const maxNodeLabels = (() => {
      if (typeof maxNodeLabelsRaw !== 'number' || !Number.isFinite(maxNodeLabelsRaw)) return 420
      const v = Math.floor(maxNodeLabelsRaw)
      if (v <= 0) return 0
      return Math.min(1200, v)
    })()
    const getNodeMetrics = (d: GraphNode): { width: number; height: number; r: number } => {
      const id = String(d.id)
      const props = (d.properties || {}) as Record<string, unknown>
      const key = [
        getNodeRenderShape2d(d, schema),
        String(props['visual:width'] ?? ''),
        String(props['visual:height'] ?? ''),
        String(props['visual:nodeSize'] ?? ''),
      ].join('|')
      const cached = nodeMetricsCache.get(id)
      if (cached && cached.key === key) return cached
      const { width, height } = getNodeRectDimensions2d(d, schema)
      const r0 = getRenderNodeRadius2d(d, schema)
      const r = typeof r0 === 'number' && Number.isFinite(r0) && r0 > 0 ? r0 : 10
      const next = { width, height, r, key }
      nodeMetricsCache.set(id, next)
      return next
    }
    const updateLinkEndpoints = (sel: d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null) => {
      if (!sel) return
      const lineSel = sel.filter(function () {
        return String((this as unknown as { tagName?: unknown }).tagName || '').toLowerCase() === 'line'
      }) as unknown as d3.Selection<SVGLineElement, GraphEdge, SVGGElement, unknown>
      if (portHandlesEnabled) {
        lineSel
          .attr('x1', (d: GraphEdge) => {
            const edge = d as unknown as EdgeWithRuntime
            const src = resolveNode(edge.source)
            const tgt = resolveNode(edge.target)
            if (!src || !tgt) return 0
            const p = getEdgeEndpointFromPorts({ from: src, to: tgt, schema })
            return p.x
          })
          .attr('y1', (d: GraphEdge) => {
            const edge = d as unknown as EdgeWithRuntime
            const src = resolveNode(edge.source)
            const tgt = resolveNode(edge.target)
            if (!src || !tgt) return 0
            const p = getEdgeEndpointFromPorts({ from: src, to: tgt, schema })
            return p.y
          })
          .attr('x2', (d: GraphEdge) => {
            const edge = d as unknown as EdgeWithRuntime
            const src = resolveNode(edge.source)
            const tgt = resolveNode(edge.target)
            if (!src || !tgt) return 0
            const p = getEdgeEndpointFromPorts({ from: tgt, to: src, schema })
            return p.x
          })
          .attr('y2', (d: GraphEdge) => {
            const edge = d as unknown as EdgeWithRuntime
            const src = resolveNode(edge.source)
            const tgt = resolveNode(edge.target)
            if (!src || !tgt) return 0
            const p = getEdgeEndpointFromPorts({ from: tgt, to: src, schema })
            return p.y
          })
      } else {
        const pickEndpoint = (from: GraphNode, to: GraphNode, padOut: number): { x: number; y: number } => {
          const fx = typeof from.x === 'number' && Number.isFinite(from.x) ? from.x : 0
          const fy = typeof from.y === 'number' && Number.isFinite(from.y) ? from.y : 0
          const tx = typeof to.x === 'number' && Number.isFinite(to.x) ? to.x : fx
          const ty = typeof to.y === 'number' && Number.isFinite(to.y) ? to.y : fy
          const dx = tx - fx
          const dy = ty - fy
          if (dx === 0 && dy === 0) return { x: fx, y: fy }
          const norm = Math.sqrt(dx * dx + dy * dy) || 1
          const ux = dx / norm
          const uy = dy / norm
          const shape = getNodeRenderShape2d(from, schema)
          if (shape === 'circle') {
            const r = getNodeMetrics(from).r
            const dist = Math.max(0, r + padOut)
            return { x: fx + ux * dist, y: fy + uy * dist }
          }
          const { width, height } = getNodeMetrics(from)
          const halfW = Math.max(1, width / 2)
          const halfH = Math.max(1, height / 2)
          const absUx = Math.abs(ux)
          const absUy = Math.abs(uy)
          const txRect = absUx > 1e-6 ? halfW / absUx : Number.POSITIVE_INFINITY
          const tyRect = absUy > 1e-6 ? halfH / absUy : Number.POSITIVE_INFINITY
          const dist = Math.max(0, Math.min(txRect, tyRect) + padOut)
          return { x: fx + ux * dist, y: fy + uy * dist }
        }

        lineSel
          .attr('x1', (d: GraphEdge) => {
            const edge = d as unknown as EdgeWithRuntime
            const src = resolveNode(edge.source)
            const tgt = resolveNode(edge.target)
            if (!src || !tgt) return 0
            const p = pickEndpoint(src, tgt, 3)
            return p.x
          })
          .attr('y1', (d: GraphEdge) => {
            const edge = d as unknown as EdgeWithRuntime
            const src = resolveNode(edge.source)
            const tgt = resolveNode(edge.target)
            if (!src || !tgt) return 0
            const p = pickEndpoint(src, tgt, 3)
            return p.y
          })
          .attr('x2', (d: GraphEdge) => {
            const edge = d as unknown as EdgeWithRuntime
            const src = resolveNode(edge.source)
            const tgt = resolveNode(edge.target)
            if (!src || !tgt) return 0
            const hasArrow = Boolean(schema.edgeStyles?.[String(d.label || '')]?.arrow)
            const p = pickEndpoint(tgt, src, hasArrow ? 8 : 3)
            return p.x
          })
          .attr('y2', (d: GraphEdge) => {
            const edge = d as unknown as EdgeWithRuntime
            const src = resolveNode(edge.source)
            const tgt = resolveNode(edge.target)
            if (!src || !tgt) return 0
            const hasArrow = Boolean(schema.edgeStyles?.[String(d.label || '')]?.arrow)
            const p = pickEndpoint(tgt, src, hasArrow ? 8 : 3)
            return p.y
          })
      }
    }

    const strictOverlapSteps = (() => {
      if (nodes.length < 2) return 0
      if (nodes.length > 3200) return 0
      if (tick < 8) return 0
      const alpha = simulation.alpha()
      if (alpha > 0.12) return 0
      const minInterval = alpha > 0.08 ? 48 : alpha > 0.04 ? 84 : 120
      if (tick - lastStrictOverlapTick < minInterval) return 0
      if (nodes.length <= 120) return 2
      if (nodes.length <= 520) return 1
      return 1
    })()

    if (strictOverlapSteps > 0) {
      const collision = readCollisionConfig(schema)
      const wantsNode = collision.nodeBbox.enabled
      const wantsGroup = collision.groupBbox.enabled && groupsForBboxCollide.length > 0 && nodes.length <= 3000
      if (wantsNode || wantsGroup) {
        if (!strictOverlapForcesCache || strictOverlapForcesCache.schema !== schema) {
          const forces: Array<(alpha: number) => void> = []
          let seed = 2166136261
          for (let i = 0; i < nodes.length; i += 1) {
            const id = String(nodes[i]?.id || '')
            for (let j = 0; j < id.length; j += 1) {
              seed ^= id.charCodeAt(j)
              seed = Math.imul(seed, 16777619)
            }
          }
          const rand = seedRand(seed >>> 0)
          const nodeForce = wantsNode
            ? (createBboxCollideForce({
                schema,
                paddingX: collision.nodeBbox.paddingX,
                paddingY: collision.nodeBbox.paddingY,
                paddingZ: collision.nodeBbox.paddingZ,
                touchEpsilonPx: collision.nodeBbox.touchEpsilonPx,
                touchEpsilonXPx: collision.nodeBbox.touchEpsilonXPx,
                touchEpsilonYPx: collision.nodeBbox.touchEpsilonYPx,
                touchEpsilonZPx: collision.nodeBbox.touchEpsilonZPx,
                strength: Math.max(0, collision.nodeBbox.strength),
                iterations: Math.max(1, Math.floor(collision.nodeBbox.iterations * 2)),
              }) as unknown as { initialize: (ns: GraphNode[], rand?: () => number) => void; (alpha: number): void })
            : null
          if (nodeForce) {
            nodeForce.initialize(nodes, rand)
            forces.push(nodeForce as unknown as (alpha: number) => void)
          }

          const groupForce = wantsGroup
            ? (createGroupBboxCollideForceByDepth({
                schema,
                groups: groupsForBboxCollide,
                paddingX: collision.groupBbox.paddingX,
                paddingY: collision.groupBbox.paddingY,
                paddingZ: collision.groupBbox.paddingZ,
                extraGapPx: collision.groupBbox.extraGapPx,
                extraGapZPx: collision.groupBbox.extraGapZPx,
                touchEpsilonPx: collision.groupBbox.touchEpsilonPx,
                touchEpsilonXPx: collision.groupBbox.touchEpsilonXPx,
                touchEpsilonYPx: collision.groupBbox.touchEpsilonYPx,
                touchEpsilonZPx: collision.groupBbox.touchEpsilonZPx,
                nestedTouchEpsilonPx: collision.groupBbox.nestedTouchEpsilonPx,
                nestedTouchEpsilonXPx: collision.groupBbox.nestedTouchEpsilonXPx,
                nestedTouchEpsilonYPx: collision.groupBbox.nestedTouchEpsilonYPx,
                nestedTouchEpsilonZPx: collision.groupBbox.nestedTouchEpsilonZPx,
                strength: Math.max(0, collision.groupBbox.strength),
                iterations: Math.max(1, Math.floor(collision.groupBbox.iterations * 2)),
              }) as unknown as { initialize: (ns: GraphNode[], rand?: () => number) => void; (alpha: number): void })
            : null
          if (groupForce) {
            groupForce.initialize(nodes, rand)
            forces.push(groupForce as unknown as (alpha: number) => void)
          }
          strictOverlapForcesCache = { schema, nodeForce: nodeForce as unknown as ((alpha: number) => void) | null, groupForce: groupForce as unknown as ((alpha: number) => void) | null, forces }
        }

        const forces = strictOverlapForcesCache?.forces || []
        if (forces.length > 0) {
          const baseByNode = new WeakMap<GraphNode, { x: number; y: number }>()
          for (let i = 0; i < nodes.length; i += 1) {
            const n = nodes[i]
            const x = typeof n.x === 'number' && Number.isFinite(n.x) ? n.x : null
            const y = typeof n.y === 'number' && Number.isFinite(n.y) ? n.y : null
            if (x == null || y == null) continue
            baseByNode.set(n, { x, y })
          }
          const isPinned = (n: GraphNode): boolean =>
            (typeof (n as { fx?: unknown }).fx === 'number' && Number.isFinite((n as { fx: number }).fx)) ||
            (typeof (n as { fy?: unknown }).fy === 'number' && Number.isFinite((n as { fy: number }).fy))
          const maxPad = Math.max(
            collision.nodeBbox.paddingX,
            collision.nodeBbox.paddingY,
            collision.groupBbox.paddingX,
            collision.groupBbox.paddingY,
          )
          const maxShift = Math.max(24, Math.min(200, 24 + maxPad * 1.15))
          const pullToBase = (alpha: number) => {
            const strength = 0.06 * alpha
            if (strength <= 0) return
            for (let i = 0; i < nodes.length; i += 1) {
              const n = nodes[i]
              if (!n || isPinned(n)) continue
              const base = baseByNode.get(n)
              if (!base) continue
              n.vx = (n.vx || 0) + (base.x - (n.x as number)) * strength
              n.vy = (n.vy || 0) + (base.y - (n.y as number)) * strength
            }
          }
          runRelaxSteps({
            nodes,
            steps: strictOverlapSteps,
            forces: [...forces, pullToBase],
            maxOps: 80_000,
            integrate: n => {
              const fx = (n as unknown as { fx?: unknown }).fx
              const fy = (n as unknown as { fy?: unknown }).fy
              if (typeof fx === 'number' && Number.isFinite(fx)) {
                n.x = fx
                n.vx = 0
              }
              if (typeof fy === 'number' && Number.isFinite(fy)) {
                n.y = fy
                n.vy = 0
              }
              integrateNodePositionWithVelocity(n, { damping: 0.55, z: { mode: 'never' } })
              const base = baseByNode.get(n)
              if (!base) return
              const x = typeof n.x === 'number' && Number.isFinite(n.x) ? (n.x as number) : base.x
              const y = typeof n.y === 'number' && Number.isFinite(n.y) ? (n.y as number) : base.y
              const dx = clamp(x - base.x, -maxShift, maxShift)
              const dy = clamp(y - base.y, -maxShift, maxShift)
              n.x = base.x + dx
              n.y = base.y + dy
            },
          })
          lastStrictOverlapTick = tick
        }
      }
    }

    updateLinkEndpoints(
      (linkHitSelRef.current as unknown as d3.Selection<SVGLineElement, GraphEdge, SVGGElement, unknown> | null) ??
        null,
    )
    updateLinkEndpoints(
      (linkSelRef.current as unknown as d3.Selection<SVGLineElement, GraphEdge, SVGGElement, unknown> | null) ?? null,
    )

    const nodeSel = nodeSelRef.current
    if (nodeSel) {
      nodeSel
        .attr('cx', (d: GraphNode) => d.x!)
        .attr('cy', (d: GraphNode) => d.y!)
        .attr('x', (d: GraphNode) => {
          const { width } = getNodeMetrics(d)
          return (d.x ?? 0) - width / 2
        })
        .attr('y', (d: GraphNode) => {
          const { height } = getNodeMetrics(d)
          return (d.y ?? 0) - height / 2
        })
        .attr('width', (d: GraphNode) => {
          return getNodeMetrics(d).width
        })
        .attr('height', (d: GraphNode) => {
          return getNodeMetrics(d).height
        })
        .attr('r', (d: GraphNode) => getNodeMetrics(d).r)
        .attr('rx', (d: GraphNode) => {
          return getNodeMetrics(d).r * 0.22;
        })
        .attr('ry', (d: GraphNode) => {
          return getNodeMetrics(d).r * 0.22;
        })
      const pathSel = nodeSel.filter(function () {
        const el = this as unknown as Element
        const tag = String(el.tagName || '').toLowerCase()
        return tag === 'path'
      }) as unknown as d3.Selection<SVGPathElement, GraphNode, SVGGElement, unknown>
      if (!pathSel.empty()) {
        pathSel
          .attr('transform', (d: GraphNode) => {
            const x = typeof d.x === 'number' && Number.isFinite(d.x) ? d.x : 0
            const y = typeof d.y === 'number' && Number.isFinite(d.y) ? d.y : 0
            return `translate(${x},${y})`
          })
          .attr('d', function (d: GraphNode) {
            const rawShape = String(this.getAttribute('data-kg-node-shape') || '').trim().toLowerCase()
            const shape = rawShape === 'diamond' || rawShape === 'hex' ? rawShape : null
            if (!shape) return ''
            const { width, height } = getNodeMetrics(d)
            return buildNodeShapePathD({ shape, width, height })
          })
      }
    }

    const groupChevronSel = groupChevronSelRef.current
    if (groupChevronSel) {
      groupChevronSel.attr('d', (d: GraphNode) => {
        const x = typeof d.x === 'number' && Number.isFinite(d.x) ? d.x : 0
        const y = typeof d.y === 'number' && Number.isFinite(d.y) ? d.y : 0
        const props = (d.properties || {}) as Record<string, unknown>
        const groupId = typeof props['kg:groupId'] === 'string' ? String(props['kg:groupId'] || '').trim() : ''
        if (!groupId) return ''
        const { width, height, r } = getNodeMetrics(d)
        const pad = Math.max(6, Math.min(12, r * 0.35))
        const cx = x + width / 2 - pad
        const cy = y - height / 2 + pad
        const size = Math.max(8, Math.min(14, r * 0.9))
        return buildChevronPathD({ cx, cy, size, direction: 'right' })
      })
    }

    const mediaSel = mediaSelRef.current
    if (mediaSel) {
      mediaSel.attr('transform', (d: GraphNode) => {
        const x = typeof d.x === 'number' && Number.isFinite(d.x) ? d.x : 0
        const y = typeof d.y === 'number' && Number.isFinite(d.y) ? d.y : 0
        return `translate(${x},${y})`
      })
    }

    const portHandlesSel = portHandlesSelRef.current
    if (portHandlesSel && portHandlesEnabled) {
      portHandlesSel
        .attr('cx', d => {
          const n = nodeById.get(d.nodeId)
          if (!n) return 0
          const anyD = d as any
          if (anyD && typeof anyD.dir === 'string') return getFlowPortHandlePosition2d({ datum: anyD, node: n, schema }).x
          return getPortHandlePosition({ datum: d as any, node: n, schema, cfg: portHandlesCfg }).x
        })
        .attr('cy', d => {
          const n = nodeById.get(d.nodeId)
          if (!n) return 0
          const anyD = d as any
          if (anyD && typeof anyD.dir === 'string') return getFlowPortHandlePosition2d({ datum: anyD, node: n, schema }).y
          return getPortHandlePosition({ datum: d as any, node: n, schema, cfg: portHandlesCfg }).y
        })
    }

    const labelsSel = labelsSelRef.current
    if (!labelsSel) return

    const t = d3.zoomTransform(svgEl)
    const labelMode = 'compact' as const
    const shouldRelaxLabels = (() => {
      if (maxNodesForRelax > 0 && nodes.length > maxNodesForRelax) return false
      if (maxNodesForRelax === 0) return false
      if (labelMode !== lastLabelRelaxMode) return true
      const alpha = simulation.alpha()
      if (alpha > 0.22) return tick - lastLabelRelaxTick >= 10
      if (alpha > 0.08) return tick - lastLabelRelaxTick >= 28
      return tick - lastLabelRelaxTick >= 64
    })()

    const groupLabelBlockers: AabbRect[] = []
    const groupLabelEls = svgEl.querySelectorAll('text[data-kg-group-label="1"]')
    type GroupLabelParticle = {
      id: string
      baseX: number
      baseY: number
      x: number
      y: number
      vx: number
      vy: number
      halfW: number
      halfH: number
      dxMin: number
      dxMax: number
      dyMin: number
      dyMax: number
      el: SVGTextElement
    }
    const groupParticles: GroupLabelParticle[] = []
    for (let i = 0; i < groupLabelEls.length; i += 1) {
      const el = groupLabelEls[i] as SVGTextElement
      const groupId = String(el.getAttribute('data-kg-group-id') || '').trim()
      if (!groupId) continue
      const x0 = Number(el.getAttribute('x'))
      const y0 = Number(el.getAttribute('y'))
      if (!Number.isFinite(x0) || !Number.isFinite(y0)) continue
      const fontSize = (() => {
        const raw = (el.style && el.style.fontSize) ? el.style.fontSize : ''
        const n = raw ? Number.parseFloat(raw) : Number.NaN
        return Number.isFinite(n) ? Math.max(10, Math.min(32, n)) : (schema.labelStyles?.fontSize ?? 12)
      })()
      const text = String(el.textContent || '')
      const w = Math.max(4, text.length * estimateLabelCharWidthPx(fontSize))
      const h = Math.max(6, fontSize * 1.2)
      const halfW = w / 2
      const halfH = h / 2
      const n0 = groupLabelNudgeById.get(groupId) || { dx: 0, dy: 0 }
      el.setAttribute('dx', String(n0.dx))
      el.setAttribute('dy', String(n0.dy))
      const groupRect = svgEl.querySelector(`g[data-kg-group-id="${CSS.escape(groupId)}"] rect[data-kg-shape="group-rect"]`) as SVGRectElement | null
      const pad = Math.max(6, Math.min(16, fontSize * 0.7))
      const bounds = (() => {
        if (!groupRect) return null
        const gx = Number(groupRect.getAttribute('x'))
        const gy = Number(groupRect.getAttribute('y'))
        const gw = Number(groupRect.getAttribute('width'))
        const gh = Number(groupRect.getAttribute('height'))
        if (!Number.isFinite(gx) || !Number.isFinite(gy) || !Number.isFinite(gw) || !Number.isFinite(gh)) return null
        return { gx, gy, gw, gh }
      })()
      const dxMin = bounds ? (bounds.gx + pad) - x0 : -48
      const dxMax = bounds ? (bounds.gx + bounds.gw - pad - w) - x0 : 48
      const dyMin = bounds ? (bounds.gy + pad) - y0 : -36
      const dyMax = bounds ? (bounds.gy + Math.min(bounds.gh - pad, pad + Math.max(48, fontSize * 4)) - h) - y0 : 36
      const dx = clamp(n0.dx, dxMin, dxMax)
      const dy = clamp(n0.dy, dyMin, dyMax)
      groupLabelNudgeById.set(groupId, { dx, dy })
      el.setAttribute('dx', String(dx))
      el.setAttribute('dy', String(dy))
      const baseCx = x0 + halfW
      const baseCy = y0 + halfH
      const cx = baseCx + dx
      const cy = baseCy + dy
      groupParticles.push({
        id: groupId,
        baseX: baseCx,
        baseY: baseCy,
        x: cx,
        y: cy,
        vx: 0,
        vy: 0,
        halfW,
        halfH,
        dxMin,
        dxMax,
        dyMin,
        dyMax,
        el,
      })
    }

    if (shouldRelaxLabels && groupParticles.length > 1) {
      const collideGroups = (alpha: number) => {
        for (let i = 0; i < groupParticles.length; i += 1) {
          const a = groupParticles[i]
          for (let j = i + 1; j < groupParticles.length; j += 1) {
            const b = groupParticles[j]
            const dx = a.x - b.x
            const dy = a.y - b.y
            const ox = a.halfW + b.halfW - Math.abs(dx)
            const oy = a.halfH + b.halfH - Math.abs(dy)
            if (!(ox > 0 && oy > 0)) continue
            if (ox < oy) {
              const s = dx >= 0 ? 1 : -1
              const push = ox * 0.55 * alpha
              a.vx += push * s
              b.vx -= push * s
            } else {
              const s = dy >= 0 ? 1 : -1
              const push = oy * 0.55 * alpha
              a.vy += push * s
              b.vy -= push * s
            }
          }
        }
      }
      const pullToBase = (alpha: number) => {
        const strength = 0.01 * alpha
        for (let i = 0; i < groupParticles.length; i += 1) {
          const p = groupParticles[i]
          p.vx += (p.baseX - p.x) * strength
          p.vy += (p.baseY - p.y) * strength
        }
      }
      runRelaxSteps({
        nodes: groupParticles,
        steps: 16,
        forces: [collideGroups, pullToBase],
        maxOps: 18_000,
        integrate: n => {
          integrateNodePositionWithVelocity(n, { damping: 0.62, z: { mode: 'never' } })
          const dx = clamp(n.x - n.baseX, n.dxMin, n.dxMax)
          const dy = clamp(n.y - n.baseY, n.dyMin, n.dyMax)
          n.x = n.baseX + dx
          n.y = n.baseY + dy
          groupLabelNudgeById.set(n.id, { dx, dy })
          n.el.setAttribute('dx', String(dx))
          n.el.setAttribute('dy', String(dy))
        },
      })
    }

    for (let i = 0; i < groupParticles.length; i += 1) {
      const p = groupParticles[i]
      groupLabelBlockers.push({ x: p.x, y: p.y, halfW: p.halfW, halfH: p.halfH })
    }

    // Standard text positioning
    labelsSel
      .attr('x', (d: GraphNode) => (typeof d.x === 'number' && Number.isFinite(d.x) ? d.x : 0))
      .attr('y', (d: GraphNode) => (typeof d.y === 'number' && Number.isFinite(d.y) ? d.y : 0))
    const padPx = 8
    const bodyBlockers: Array<AabbRect & { id: string }> = []
    const farPad = 240
    const bodyFilterEnabled = nodes.length > 1200
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      if (!n) continue
      if (!Number.isFinite(n.x as number) || !Number.isFinite(n.y as number)) continue
      if (bodyFilterEnabled) {
        const sx = t.applyX(n.x as number)
        const sy = t.applyY(n.y as number)
        if (!(sx > -farPad && sx < width + farPad && sy > -farPad && sy < height + farPad)) continue
      }
      const dims = getNodeMetrics(n)
      const hw = Math.max(4, dims.width / 2)
      const hh = Math.max(4, dims.height / 2)
      bodyBlockers.push({ id: String(n.id), x: n.x as number, y: n.y as number, halfW: hw + 2, halfH: hh + 2 })
    }

    const maxPlacedNodeLabels = (() => {
      const maxLabels = maxNodeLabels > 0 ? maxNodeLabels : 0
      if (maxLabels === 0) return 0
      return labelMode === 'compact' ? Math.max(0, Math.min(maxLabels, 180)) : maxLabels
    })()

    const nodeLabelRects: AabbRect[] = []
    labelsSel.each(function (d: GraphNode) {
      const el = this as unknown as SVGTextElement

      const x = typeof d.x === 'number' && Number.isFinite(d.x) ? d.x : null
      const y = typeof d.y === 'number' && Number.isFinite(d.y) ? d.y : null
      if (x == null || y == null) {
        el.style.display = 'none'
        return
      }
      const nodeId = String((d as unknown as { id?: unknown }).id ?? '')
      el.style.display = ''
      
      const currentMode = (el.getAttribute('data-label-mode') as 'compact' | 'wrap' | null) ?? 'compact'
      if (currentMode !== 'compact') {
        const nextText = String(el.getAttribute('data-label-compact') || '')
        while (el.firstChild) el.removeChild(el.firstChild)
        el.textContent = nextText
        el.setAttribute('data-label-mode', 'compact')
        el.setAttribute('data-label-linecount', '1')
        el.setAttribute('data-label-maxlen', String(nextText.length))
      }

      const charCount = (() => {
        const raw = el.getAttribute('data-label-maxlen')
        const n = raw != null ? Number(raw) : Number.NaN
        return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0
      })()
      const lineCount = (() => {
        const raw = el.getAttribute('data-label-linecount')
        const n = raw != null ? Number(raw) : Number.NaN
        return Number.isFinite(n) ? Math.max(1, Math.floor(n)) : 1
      })()
      const sx = t.applyX(x)
      const sy = t.applyY(y)
      const k = typeof (t as unknown as { k?: unknown }).k === 'number' && Number.isFinite((t as unknown as { k: number }).k) && (t as unknown as { k: number }).k > 0
        ? (t as unknown as { k: number }).k
        : 1
      const estWidthPx = Math.max(0, charCount) * labelFontSize * k * 0.6
      const baseDxAttr = el.getAttribute('data-base-dx')
      const baseDx = (() => {
        const parsed = baseDxAttr != null ? Number(baseDxAttr) : Number.NaN
        if (Number.isFinite(parsed)) return parsed
        return baseDxFallback
      })()
      const baseDyAttr = el.getAttribute('data-base-dy')
      const baseDy = (() => {
        const parsed = baseDyAttr != null ? Number(baseDyAttr) : Number.NaN
        if (Number.isFinite(parsed)) return parsed
        return baseDyFallback
      })()
      const farPad = 240
      const isNearViewport =
        sx > -farPad &&
        sx < width + farPad &&
        sy > -farPad &&
        sy < height + farPad
      if (!isNearViewport) {
        el.setAttribute('data-collide-hidden', '0')
        el.setAttribute('text-anchor', String(el.getAttribute('data-base-anchor') || 'middle'))
        el.setAttribute('dx', String(baseDx))
        el.setAttribute('dy', String(baseDy))
        return
      }
      const candidates: Array<{ anchor: 'start' | 'end' | 'middle'; dx: number }> = []
      
      const abs = Math.abs(baseDx)
      candidates.push({ anchor: 'start', dx: abs })
      candidates.push({ anchor: 'end', dx: -abs })
      candidates.push({ anchor: 'middle', dx: baseDx })
      
      let best = candidates[0]
      let bestOverflow = Number.POSITIVE_INFINITY
      for (let i = 0; i < candidates.length; i += 1) {
        const c = candidates[i]
        const left =
          c.anchor === 'start'
            ? sx + c.dx * k
            : c.anchor === 'end'
              ? sx + c.dx * k - estWidthPx
              : sx + c.dx * k - estWidthPx / 2
        const right =
          c.anchor === 'start'
            ? left + estWidthPx
            : c.anchor === 'end'
              ? sx + c.dx * k
              : sx + c.dx * k + estWidthPx / 2
        const overflowLeft = Math.max(0, padPx - left)
        const overflowRight = Math.max(0, right - (width - padPx))
        const total = overflowLeft + overflowRight
        if (total < bestOverflow) {
          bestOverflow = total
          best = c
        }
      }
      const left0 =
        best.anchor === 'start'
          ? sx + best.dx * k
          : best.anchor === 'end'
            ? sx + best.dx * k - estWidthPx
            : sx + best.dx * k - estWidthPx / 2
      const right0 =
        best.anchor === 'start'
          ? left0 + estWidthPx
          : best.anchor === 'end'
            ? sx + best.dx * k
            : sx + best.dx * k + estWidthPx / 2
      const overflowLeft0 = Math.max(0, padPx - left0)
      const overflowRight0 = Math.max(0, right0 - (width - padPx))
      const shiftPxRaw = overflowLeft0 - overflowRight0
      const maxShiftPx = 96
      const shiftPx = Math.max(-maxShiftPx, Math.min(maxShiftPx, shiftPxRaw))
      const dxAdjusted = best.dx + (k > 0 ? shiftPx / k : 0)
      
      const estHalfHeightPx = Math.max(1, lineCount) * labelFontSize * k * 0.6
      const top = sy + baseDy * k - estHalfHeightPx
      const bottom = sy + baseDy * k + estHalfHeightPx
      const overflowTop = Math.max(0, padPx - top)
      const overflowBottom = Math.max(0, bottom - (height - padPx))
      const shiftYPxRaw = overflowTop - overflowBottom
      const shiftYPx = Math.max(-maxShiftPx, Math.min(maxShiftPx, shiftYPxRaw))
      const dyAdjusted = baseDy + (k > 0 ? shiftYPx / k : 0)

      const halfW = Math.max(2, (Math.max(0, charCount) * labelFontSize * 0.6) / 2)
      const halfH = Math.max(2, (Math.max(1, lineCount) * labelFontSize * 0.6) / 2)

      const yStep = Math.max(10, Math.min(28, labelFontSize * 1.45))
      const xStep = Math.max(12, Math.min(36, labelFontSize * 1.8))
      const placeCandidates: Array<{ anchor: 'start' | 'end' | 'middle'; dx: number; dy: number }> = [
        { anchor: best.anchor, dx: dxAdjusted, dy: dyAdjusted },
        { anchor: best.anchor, dx: dxAdjusted, dy: dyAdjusted - yStep },
        { anchor: best.anchor, dx: dxAdjusted, dy: dyAdjusted + yStep },
        { anchor: best.anchor, dx: dxAdjusted + xStep, dy: dyAdjusted },
        { anchor: best.anchor, dx: dxAdjusted - xStep, dy: dyAdjusted },
        { anchor: 'middle', dx: 0, dy: dyAdjusted },
      ]

      if (maxPlacedNodeLabels > 0 && nodeLabelRects.length >= maxPlacedNodeLabels) {
        el.style.display = 'none'
        el.setAttribute('data-collide-hidden', '1')
        return
      }

      const overlapsBlockers = (rect: AabbRect) => {
        if (aabbOverlapsAny(rect, groupLabelBlockers)) return true
        for (let bi = 0; bi < bodyBlockers.length; bi += 1) {
          const b = bodyBlockers[bi]!
          if (b.id === nodeId) continue
          if (aabbOverlaps(rect, b)) return true
        }
        return false
      }

      let placedRect: AabbRect | null = null
      let placedAnchor: 'start' | 'end' | 'middle' = best.anchor
      let placedDx = dxAdjusted
      let placedDy = dyAdjusted
      for (let ci = 0; ci < placeCandidates.length; ci += 1) {
        const c = placeCandidates[ci]!
        const centerX =
          c.anchor === 'start'
            ? x + c.dx + halfW
            : c.anchor === 'end'
              ? x + c.dx - halfW
              : x + c.dx
        const centerY = y + c.dy
        const rect: AabbRect = { x: centerX, y: centerY, halfW, halfH }
        if (overlapsBlockers(rect)) continue
        if (aabbOverlapsAny(rect, nodeLabelRects)) continue
        placedRect = rect
        placedAnchor = c.anchor
        placedDx = c.dx
        placedDy = c.dy
        break
      }

      if (!placedRect) {
        el.style.display = 'none'
        el.setAttribute('data-collide-hidden', '1')
        return
      }
      el.style.display = ''
      el.setAttribute('data-collide-hidden', '0')
      el.setAttribute('text-anchor', placedAnchor)
      el.setAttribute('dx', String(placedDx))
      el.setAttribute('dy', String(placedDy))
      nodeLabelRects.push(placedRect)
    })
    if (shouldRelaxLabels) {
      lastLabelRelaxMode = labelMode
      lastLabelRelaxTick = tick
    }

    if (edgeLabelSel) {
      const hideBelow = schema.performance?.lod?.hideLabelsBelowScale ?? 0
      const hideEdgeLabels = hideBelow > 0 && d3.zoomTransform(svgEl).k < hideBelow
      if (hideEdgeLabels) {
        edgeLabelSel.attr('data-zoom-lod-hidden', '1').style('display', 'none')
      } else {
        edgeLabelSel.attr('data-zoom-lod-hidden', '0').style('display', null)
        const placedEdgeLabelRects: AabbRect[] = []
        const blockerRects = [...groupLabelBlockers, ...nodeLabelRects, ...bodyBlockers]
        edgeLabelSel.each(function (d: GraphEdge) {
          const el = this as unknown as SVGTextElement
          const edge = d as unknown as EdgeWithRuntime
          const edgeProps =
            edge.properties && typeof edge.properties === 'object' && !Array.isArray(edge.properties)
              ? (edge.properties as Record<string, unknown>)
              : null
          const lx = edgeProps && typeof edgeProps['visual:labelX'] === 'number' ? (edgeProps['visual:labelX'] as number) : Number.NaN
          const ly = edgeProps && typeof edgeProps['visual:labelY'] === 'number' ? (edgeProps['visual:labelY'] as number) : Number.NaN
          if (Number.isFinite(lx) && Number.isFinite(ly)) {
            const sx2 = t.applyX(lx)
            const sy2 = t.applyY(ly)
            const farPad = 240
            const isNearViewport = sx2 > -farPad && sx2 < width + farPad && sy2 > -farPad && sy2 < height + farPad
            if (!isNearViewport) {
              el.style.display = 'none'
              return
            }
            el.style.display = ''
            el.setAttribute('x', String(lx))
            el.setAttribute('y', String(ly))
            return
          }
          const srcNode = resolveNode(edge.source)
          const tgtNode = resolveNode(edge.target)
          if (!srcNode || !tgtNode) {
            el.style.display = 'none'
            return
          }
          const sx = typeof srcNode.x === 'number' && Number.isFinite(srcNode.x) ? srcNode.x : 0
          const sy = typeof srcNode.y === 'number' && Number.isFinite(srcNode.y) ? srcNode.y : 0
          const tx = typeof tgtNode.x === 'number' && Number.isFinite(tgtNode.x) ? tgtNode.x : 0
          const ty = typeof tgtNode.y === 'number' && Number.isFinite(tgtNode.y) ? tgtNode.y : 0
          const p1 = portHandlesEnabled ? getEdgeEndpointFromPorts({ from: srcNode, to: tgtNode, schema }) : { x: sx, y: sy }
          const p2 = portHandlesEnabled ? getEdgeEndpointFromPorts({ from: tgtNode, to: srcNode, schema }) : { x: tx, y: ty }
          const text = el.textContent ?? ''
          const srcExt = getNodeAabbHalfExtentsWithLabel(srcNode, schema)
          const tgtExt = getNodeAabbHalfExtentsWithLabel(tgtNode, schema)

          const placement = pickEdgeLabelPlacement({
            p1,
            p2,
            text: String(text || ''),
            fontSize: labelFontSize,
            srcRect: { x: sx, y: sy, halfW: srcExt.halfW, halfH: srcExt.halfH },
            tgtRect: { x: tx, y: ty, halfW: tgtExt.halfW, halfH: tgtExt.halfH },
            blockerRects,
            placedLabelRects: placedEdgeLabelRects,
          })

          if (!placement) {
            el.style.display = 'none'
            return
          }
          placedEdgeLabelRects.push(placement)

          const sx2 = t.applyX(placement.x)
          const sy2 = t.applyY(placement.y)
          const farPad = 240
          const isNearViewport =
            sx2 > -farPad &&
            sx2 < width + farPad &&
            sy2 > -farPad &&
            sy2 < height + farPad
          if (!isNearViewport) {
            el.style.display = 'none'
            return
          }
          el.style.display = ''
          el.setAttribute('x', String(placement.x))
          el.setAttribute('y', String(placement.y))
        })
      }
    }

    if (afterRenderFrame) {
      afterRenderFrame({ alpha: simulation.alpha(), tick })
    }
  }

  const raf =
    typeof (globalThis as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame === 'function'
      ? ((globalThis as unknown as { requestAnimationFrame: (cb: (t: number) => void) => number }).requestAnimationFrame)
      : ((cb: (t: number) => void) => {
          return setTimeout(() => cb(Date.now()), 16) as unknown as number
        })

  let rafPending = false
  const scheduleRender = () => {
    if (rafPending) return
    rafPending = true
    raf(() => {
      rafPending = false
      if (!svgEl.isConnected) return
      renderFrame()
    })
  }

  simulation.on('tick', scheduleRender)
  renderFrame()
}

export const attachGlobalHandlers = (args: {
  svgRef: RefObject<SVGSVGElement>
  svg: SvgSelection
  tempLinkSelRef: MutableRefObject<TempLinkSelection>
  linkDragRef: MutableRefObject<PendingLink | null>
  selectNode: (id: string | null) => void
  enableEditorGestures?: boolean
  onCanvasShiftDoubleClick?: (args: { x: number; y: number; clientX: number; clientY: number }) => void
  hideTemp: () => void
  cancelPending: () => void
}): (() => void) => {
  const { svgRef, svg, tempLinkSelRef, linkDragRef, selectNode, enableEditorGestures, onCanvasShiftDoubleClick, hideTemp, cancelPending } = args
  svg.on('mousemove', (ev: MouseEvent) => {
    if (!tempLinkSelRef.current || !linkDragRef.current) return
    const p = calcMouseGraphPosition(svgRef, ev)
    tempLinkSelRef.current.attr('x2', p[0]).attr('y2', p[1])
  })
  svg.on('mouseup', () => { hideTemp() })
  svg.on('click', (ev: MouseEvent) => {
    if (typeof ev.button === 'number' && ev.button !== 0) return
    selectNode(null)
    cancelPending()
  })
  svg.on('dblclick', (ev: MouseEvent) => {
    const btn = (ev as unknown as { button?: unknown }).button
    if (typeof btn === 'number' && btn !== 0) return
    if (!enableEditorGestures) return
    if (!ev.shiftKey) return
    if (isNodePointerTarget(ev.target as HTMLElement | null)) return
    const p = calcMouseGraphPosition(svgRef, ev)
    if (!p) return
    try {
      onCanvasShiftDoubleClick?.({ x: p[0], y: p[1], clientX: ev.clientX, clientY: ev.clientY })
    } catch {
      void 0
    }
  })
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { hideTemp(); cancelPending() }
  }
  const onDocPointerDown = (e: PointerEvent) => {
    if (!linkDragRef.current) return
    if (isNodePointerTarget(e.target as HTMLElement | null)) return
    hideTemp()
    cancelPending()
  }
  const pointerDownOptions: AddEventListenerOptions = { capture: true }
  window.addEventListener('keydown', onKeyDown)
  document.addEventListener('pointerdown', onDocPointerDown, pointerDownOptions)
  return () => {
    svg.on('mousemove', null)
    svg.on('mouseup', null)
    svg.on('click', null)
    svg.on('dblclick', null)
    window.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('pointerdown', onDocPointerDown, pointerDownOptions)
  }
}
