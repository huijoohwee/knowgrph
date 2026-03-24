import * as d3 from 'd3'
import type { MutableRefObject } from 'react'
import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import type { EdgeWithRuntime } from '@/components/GraphCanvas/utils'
import { getRenderNodeRadius2d } from '@/components/GraphCanvas/helpers'
import { getPortHandlePosition, getPortHandlesConfig, type PortHandleDatum } from '@/components/GraphCanvas/portHandles'
import { getFlowPortHandlePosition2d, type FlowPortHandleDatum2d } from '@/components/GraphCanvas/flowPortHandles2d'
import { getNodeRectDimensions2d, getNodeRenderShape2d } from '@/components/GraphCanvas/nodeSizing2d'
import { buildNodeShapePathD } from '@/components/GraphCanvas/shapePaths2d'
import { buildChevronPathD } from '@/components/GraphCanvas/layers/svgChevron'
import { getEdgeEndpointFromPorts } from '@/components/GraphCanvas/portHandles'
import { computeOverlayHalfExtentsWorld, normalizeOverlaySizingConfig } from '@/lib/render/overlaySizing2d'
import { readLabelPresentation2d } from '@/lib/canvas/labelPresentation2d'
import { computeIdealSpacing2d, computeMaxSpeed2d, readPhysics2dTuning } from '@/lib/graph/physics2dTuning'
import { applyStrictOverlapRelax2d, type StrictOverlapState2d } from '@/components/GraphCanvas/sceneHandlers.simulationTick2d.strictOverlap'
import { renderLabels2d, type LabelRelaxState2d } from '@/components/GraphCanvas/sceneHandlers.simulationTick2d.labels'

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
  panelOnlyNodeIdSet?: Set<string> | null
  mediaOverlayNodeIdSet?: Set<string> | null
  mediaPanelDensity?: 'default' | 'compact'
  overlayBaseWidthRatioDefault?: number
  overlayBaseWidthRatioCompact?: number
  overlayBaseWidthMinPxDefault?: number
  overlayBaseWidthMinPxCompact?: number
  overlayBaseWidthMaxPxDefault?: number
  overlayBaseWidthMaxPxCompact?: number
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
    panelOnlyNodeIdSet,
    mediaOverlayNodeIdSet,
    mediaPanelDensity,
    overlayBaseWidthRatioDefault,
    overlayBaseWidthRatioCompact,
    overlayBaseWidthMinPxDefault,
    overlayBaseWidthMinPxCompact,
    overlayBaseWidthMaxPxDefault,
    overlayBaseWidthMaxPxCompact,
    beforeRenderFrameRef,
    afterRenderFrame,
  } = args

  const nodeById = args.nodeById || new Map<string, GraphNode>()
  if (!args.nodeById) {
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      nodeById.set(String(n.id), n)
    }
  }
  const groupsForBboxCollide = Array.isArray(args.groupsForBboxCollide) ? args.groupsForBboxCollide : []

  let lastOverlayHalfExtentsKey = ''
  let lastOverlayHalfExtents: { halfW: number; halfH: number } | null = null
  let lastSchema: GraphSchema | null = null
  const nodeMetricsCache = new Map<string, { width: number; height: number; r: number; key: string }>()
  const labelRelaxState: LabelRelaxState2d = {
    groupLabelNudgeById: new Map<string, { dx: number; dy: number }>(),
    lastLabelRelaxMode: 'wrap',
    lastLabelRelaxTick: -1,
  }
  const strictOverlapState: StrictOverlapState2d = { lastStrictOverlapTick: -1, cache: null }

  const idealSpacing = computeIdealSpacing2d({ width, height, nodeCount: nodes.length })
  let physicsTuning = readPhysics2dTuning(getSchema())
  let physicsTick = 0

  const applyMotionLimits = () => {
    physicsTick += 1
    if ((physicsTick & 1) !== 0) return
    const alpha = simulation.alpha()
    if (!(alpha > 0.0005)) return
    const maxSpeed = computeMaxSpeed2d({ idealSpacing, alpha, tuning: physicsTuning })

    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i] as unknown as { vx?: unknown; vy?: unknown; fx?: unknown; fy?: unknown }
      const hasFx = typeof n.fx === 'number' && Number.isFinite(n.fx as number)
      const hasFy = typeof n.fy === 'number' && Number.isFinite(n.fy as number)
      if (hasFx || hasFy) {
        ;(n as unknown as { vx: number }).vx = 0
        ;(n as unknown as { vy: number }).vy = 0
        continue
      }
      const vx = typeof n.vx === 'number' && Number.isFinite(n.vx) ? n.vx : 0
      const vy = typeof n.vy === 'number' && Number.isFinite(n.vy) ? n.vy : 0
      const s = Math.sqrt(vx * vx + vy * vy)
      if (!(s > maxSpeed)) continue
      const inv = maxSpeed / s
      ;(n as unknown as { vx: number }).vx = vx * inv
      ;(n as unknown as { vy: number }).vy = vy * inv
    }
  }

  const resolveNode = (endpoint: unknown): GraphNode | null => {
    if (endpoint && typeof endpoint === 'object') {
      const maybeNode = endpoint as Partial<GraphNode>
      if (typeof maybeNode.x === 'number' && typeof maybeNode.y === 'number') return maybeNode as GraphNode
      const maybeId = (endpoint as { id?: unknown }).id
      if (typeof maybeId === 'string' || typeof maybeId === 'number') return nodeById.get(String(maybeId)) ?? null
    }
    if (typeof endpoint === 'string' || typeof endpoint === 'number') return nodeById.get(String(endpoint)) ?? null
    return null
  }

  const getNodeMetrics = (d: GraphNode, schema: GraphSchema): { width: number; height: number; r: number } => {
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

  let tick = 0
  const renderFrame = () => {
    tick += 1
    const beforeRenderFrame = beforeRenderFrameRef ? beforeRenderFrameRef.current : null
    if (beforeRenderFrame) beforeRenderFrame()

    const schema = getSchema()
    if (schema !== lastSchema) {
      nodeMetricsCache.clear()
      strictOverlapState.cache = null
      lastSchema = schema
      physicsTuning = readPhysics2dTuning(schema)
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

    const updateLinkEndpoints = (sel: d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null) => {
      if (!sel) return
      const lineSel = sel.filter(function () {
        return String((this as unknown as { tagName?: unknown }).tagName || '').toLowerCase() === 'line'
      }) as unknown as d3.Selection<SVGLineElement, GraphEdge, SVGGElement, unknown>

      const zoomK = (() => {
        const t = d3.zoomTransform(svgEl)
        const k = typeof t.k === 'number' && Number.isFinite(t.k) && t.k > 0 ? t.k : 1
        return k
      })()

      const overlayHalfExtentsWorld = (() => {
        const hasSets =
          (panelOnlyNodeIdSet && panelOnlyNodeIdSet.size > 0) || (mediaOverlayNodeIdSet && mediaOverlayNodeIdSet.size > 0)
        if (!hasSets) return null
        const density: 'default' | 'compact' = mediaPanelDensity === 'compact' ? 'compact' : 'default'
        const ratio = density === 'compact' ? overlayBaseWidthRatioCompact : overlayBaseWidthRatioDefault
        const minPx = density === 'compact' ? overlayBaseWidthMinPxCompact : overlayBaseWidthMinPxDefault
        const maxPx = density === 'compact' ? overlayBaseWidthMaxPxCompact : overlayBaseWidthMaxPxDefault
        const cfg = normalizeOverlaySizingConfig({
          widthRatio: Number(ratio),
          widthMinPx: Number(minPx),
          widthMaxPx: Number(maxPx),
        })
        const key = `${density}|${width}|${zoomK}|${cfg.widthRatio}|${cfg.widthMinPx}|${cfg.widthMaxPx}`
        if (key === lastOverlayHalfExtentsKey) return lastOverlayHalfExtents
        const out = computeOverlayHalfExtentsWorld({ density, viewportW: width, zoomK, config: cfg })
        lastOverlayHalfExtentsKey = key
        lastOverlayHalfExtents = out
        return out
      })()

      const isPanelNode = (n: GraphNode): boolean => {
        const id = String(n.id)
        if (panelOnlyNodeIdSet && panelOnlyNodeIdSet.has(id)) return true
        if (mediaOverlayNodeIdSet && mediaOverlayNodeIdSet.has(id)) return true
        return false
      }

      const pickEndpointRectOrCircle = (from: GraphNode, to: GraphNode, padOut: number): { x: number; y: number } => {
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

        if (isPanelNode(from) && overlayHalfExtentsWorld) {
          const halfW = overlayHalfExtentsWorld.halfW
          const halfH = overlayHalfExtentsWorld.halfH
          const absUx = Math.abs(ux)
          const absUy = Math.abs(uy)
          const txRect = absUx > 1e-6 ? halfW / absUx : Number.POSITIVE_INFINITY
          const tyRect = absUy > 1e-6 ? halfH / absUy : Number.POSITIVE_INFINITY
          const dist = Math.max(0, Math.min(txRect, tyRect) + padOut)
          return { x: fx + ux * dist, y: fy + uy * dist }
        }

        const shape = getNodeRenderShape2d(from, schema)
        if (shape === 'circle') {
          const r = getNodeMetrics(from, schema).r
          const dist = Math.max(0, r + padOut)
          return { x: fx + ux * dist, y: fy + uy * dist }
        }
        const { width, height } = getNodeMetrics(from, schema)
        const halfW = Math.max(1, width / 2)
        const halfH = Math.max(1, height / 2)
        const absUx = Math.abs(ux)
        const absUy = Math.abs(uy)
        const txRect = absUx > 1e-6 ? halfW / absUx : Number.POSITIVE_INFINITY
        const tyRect = absUy > 1e-6 ? halfH / absUy : Number.POSITIVE_INFINITY
        const dist = Math.max(0, Math.min(txRect, tyRect) + padOut)
        return { x: fx + ux * dist, y: fy + uy * dist }
      }

      const endpoint = (from: GraphNode, to: GraphNode, padOut: number): { x: number; y: number } => {
        if (!portHandlesEnabled) return pickEndpointRectOrCircle(from, to, padOut)
        if (isPanelNode(from)) return pickEndpointRectOrCircle(from, to, padOut)
        return getEdgeEndpointFromPorts({ from, to, schema })
      }

      const x1 = (d: GraphEdge) => {
        const edge = d as unknown as EdgeWithRuntime
        const src = resolveNode(edge.source)
        const tgt = resolveNode(edge.target)
        if (!src || !tgt) return 0
        return endpoint(src, tgt, 3).x
      }
      const y1 = (d: GraphEdge) => {
        const edge = d as unknown as EdgeWithRuntime
        const src = resolveNode(edge.source)
        const tgt = resolveNode(edge.target)
        if (!src || !tgt) return 0
        return endpoint(src, tgt, 3).y
      }
      const x2 = (d: GraphEdge) => {
        const edge = d as unknown as EdgeWithRuntime
        const src = resolveNode(edge.source)
        const tgt = resolveNode(edge.target)
        if (!src || !tgt) return 0
        const hasArrow = Boolean(schema.edgeStyles?.[String(d.label || '')]?.arrow)
        return endpoint(tgt, src, hasArrow ? 8 : 3).x
      }
      const y2 = (d: GraphEdge) => {
        const edge = d as unknown as EdgeWithRuntime
        const src = resolveNode(edge.source)
        const tgt = resolveNode(edge.target)
        if (!src || !tgt) return 0
        const hasArrow = Boolean(schema.edgeStyles?.[String(d.label || '')]?.arrow)
        return endpoint(tgt, src, hasArrow ? 8 : 3).y
      }

      lineSel.attr('x1', x1).attr('y1', y1).attr('x2', x2).attr('y2', y2)
    }

    applyStrictOverlapRelax2d({
      state: strictOverlapState,
      nodes,
      tick,
      alpha: simulation.alpha(),
      schema,
      idealSpacing,
      tuning: physicsTuning,
      groupsForBboxCollide,
    })

    updateLinkEndpoints((linkHitSelRef.current as any) ?? null)
    updateLinkEndpoints((linkSelRef.current as any) ?? null)

    const nodeSel = nodeSelRef.current
    if (nodeSel) {
      nodeSel
        .attr('cx', (d: GraphNode) => d.x!)
        .attr('cy', (d: GraphNode) => d.y!)
        .attr('x', (d: GraphNode) => {
          const { width } = getNodeMetrics(d, schema)
          return (d.x ?? 0) - width / 2
        })
        .attr('y', (d: GraphNode) => {
          const { height } = getNodeMetrics(d, schema)
          return (d.y ?? 0) - height / 2
        })
        .attr('width', (d: GraphNode) => getNodeMetrics(d, schema).width)
        .attr('height', (d: GraphNode) => getNodeMetrics(d, schema).height)
        .attr('r', (d: GraphNode) => getNodeMetrics(d, schema).r)
        .attr('rx', (d: GraphNode) => getNodeMetrics(d, schema).r * 0.22)
        .attr('ry', (d: GraphNode) => getNodeMetrics(d, schema).r * 0.22)

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
            const { width, height } = getNodeMetrics(d, schema)
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
        const { width, height, r } = getNodeMetrics(d, schema)
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

    renderLabels2d({
      svgEl,
      nodes,
      schema,
      tuning: physicsTuning,
      tick,
      simulationAlpha: simulation.alpha(),
      width,
      height,
      labelsSel,
      edgeLabelSel,
      resolveNode,
      portHandlesEnabled,
      labelFontSize,
      baseDxFallback,
      baseDyFallback,
      maxNodesForRelax,
      maxNodeLabels,
      getNodeMetrics: n => getNodeMetrics(n, schema),
      state: labelRelaxState,
    })

    if (afterRenderFrame) {
      afterRenderFrame({ alpha: simulation.alpha(), tick })
    }
  }

  const raf =
    typeof (globalThis as unknown as { requestAnimationFrame?: unknown }).requestAnimationFrame === 'function'
      ? (globalThis as unknown as { requestAnimationFrame: (cb: (t: number) => void) => number }).requestAnimationFrame
      : (cb: (t: number) => void) => {
          return setTimeout(() => cb(Date.now()), 16) as unknown as number
        }

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

  simulation.on('tick', () => {
    applyMotionLimits()
    scheduleRender()
  })
  renderFrame()
}

