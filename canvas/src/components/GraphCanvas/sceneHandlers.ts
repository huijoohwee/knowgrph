import * as d3 from 'd3'
import type { MutableRefObject, RefObject } from 'react'
import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation'
import { calcMouseGraphPosition, isNodePointerTarget } from '@/features/canvas/utils'
import { getRenderNodeRadius2d } from '@/components/GraphCanvas/helpers'
import type { EdgeWithRuntime } from '@/components/GraphCanvas/utils'
import { getEdgeEndpointFromPorts, getPortHandlePosition, getPortHandlesConfig, type PortHandleDatum } from '@/components/GraphCanvas/portHandles'
import { getNodeRectDimensions2d, getNodeRenderShape2d } from '@/components/GraphCanvas/nodeSizing2d'
import { buildNodeShapePathD } from '@/components/GraphCanvas/shapePaths2d'
import { buildChevronPathD } from '@/components/GraphCanvas/layers/svgChevron'
import { estimateLabelCharWidthPx, type AabbRect } from '@/components/GraphCanvas/layout/utils'
import { getNodeAabbHalfExtentsWithLabel } from '@/components/GraphCanvas/layout/overlap'

type SvgSelection = d3.Selection<SVGSVGElement, unknown, null, undefined>

export const attachSimulationTick = (args: {
  svgEl: SVGSVGElement
  simulation: d3.Simulation<GraphNode, GraphEdge>
  nodeSelRef: MutableRefObject<d3.Selection<SVGElement, GraphNode, SVGGElement, unknown> | null>
  groupChevronSelRef: MutableRefObject<d3.Selection<SVGPathElement, GraphNode, SVGGElement, unknown> | null>
  mediaSelRef: MutableRefObject<d3.Selection<SVGGraphicsElement, GraphNode, SVGGElement, unknown> | null>
  portHandlesSelRef: MutableRefObject<d3.Selection<SVGCircleElement, PortHandleDatum, SVGGElement, unknown> | null>
  linkHitSelRef: MutableRefObject<d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null>
  linkSelRef: MutableRefObject<d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null>
  edgeLabelSel?: d3.Selection<SVGTextElement, GraphEdge, SVGGElement, unknown> | null
  labelsSelRef: MutableRefObject<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>
  nodes: GraphNode[]
  nodeById?: Map<string, GraphNode> | null
  getSchema: () => GraphSchema
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
  if (!args.nodeById) {
    for (let i = 0; i < nodes.length; i += 1) {
      const n = nodes[i]
      nodeById.set(String(n.id), n)
    }
  }
  let lastSchema: GraphSchema | null = null
  const nodeMetricsCache = new Map<string, { width: number; height: number; r: number }>()

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
      lastSchema = schema
    }
    const portHandlesCfg = getPortHandlesConfig(schema)
    const portHandlesEnabled = portHandlesCfg.enabled
    const baseDxFallback = schema.labelStyles?.offset?.dx ?? 12
    const baseDyFallback = schema.labelStyles?.offset?.dy ?? 4
    const labelFontSize = schema.labelStyles?.fontSize ?? 12
    const getNodeMetrics = (d: GraphNode): { width: number; height: number; r: number } => {
      const id = String(d.id)
      const cached = nodeMetricsCache.get(id)
      if (cached) return cached
      const { width, height } = getNodeRectDimensions2d(d, schema)
      const r0 = getRenderNodeRadius2d(d, schema)
      const r = typeof r0 === 'number' && Number.isFinite(r0) && r0 > 0 ? r0 : 10
      const next = { width, height, r }
      nodeMetricsCache.set(id, next)
      return next
    }
    const updateLinkEndpoints = (
      sel: d3.Selection<SVGLineElement, GraphEdge, SVGGElement, unknown> | null,
    ) => {
      if (!sel) return
      if (portHandlesEnabled) {
        sel
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

        sel
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
          return getPortHandlePosition({ datum: d, node: n, schema, cfg: portHandlesCfg }).x
        })
        .attr('cy', d => {
          const n = nodeById.get(d.nodeId)
          if (!n) return 0
          return getPortHandlePosition({ datum: d, node: n, schema, cfg: portHandlesCfg }).y
        })
    }

    const labelsSel = labelsSelRef.current
    if (!labelsSel) return
    // Standard text positioning
    labelsSel
      .attr('x', (d: GraphNode) => (typeof d.x === 'number' && Number.isFinite(d.x) ? d.x : 0))
      .attr('y', (d: GraphNode) => (typeof d.y === 'number' && Number.isFinite(d.y) ? d.y : 0))
    const t = d3.zoomTransform(svgEl)
    const k = t.k || 1
    const padPx = 8
    labelsSel.each(function (d: GraphNode) {
      const el = this as unknown as SVGTextElement

      const x = typeof d.x === 'number' && Number.isFinite(d.x) ? d.x : null
      const y = typeof d.y === 'number' && Number.isFinite(d.y) ? d.y : null
      if (x == null || y == null) {
        el.style.display = 'none'
        return
      }
      el.style.display = ''
      
      const desiredMode = k < 0.55 ? 'compact' : 'wrap'
      const currentMode = (el.getAttribute('data-label-mode') as 'compact' | 'wrap' | null) ?? 'wrap'
      if (desiredMode !== currentMode) {
        const nextText =
          desiredMode === 'compact'
            ? String(el.getAttribute('data-label-compact') || '')
            : String(el.getAttribute('data-label-wrap') || el.getAttribute('data-label-full') || '')
        const lines = String(nextText).replace(/\r\n?/g, '\n').split('\n')
        const lineCount = Math.max(1, lines.length)
        let maxLen = 0
        for (let i = 0; i < lines.length; i += 1) {
          const len = lines[i].length
          if (len > maxLen) maxLen = len
        }
        const dy0 = -((Math.max(1, lineCount) - 1) / 2) * (labelFontSize * 1.2)
        while (el.firstChild) el.removeChild(el.firstChild)
        for (let i = 0; i < lines.length; i += 1) {
          const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan')
          tspan.setAttribute('dy', i === 0 ? `${dy0}px` : `${labelFontSize * 1.2}px`)
          tspan.textContent = lines[i]
          el.appendChild(tspan)
        }
        el.setAttribute('data-label-mode', desiredMode)
        el.setAttribute('data-label-linecount', String(lineCount))
        el.setAttribute('data-label-maxlen', String(maxLen))
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
      const estWidthPx = Math.max(0, charCount) * labelFontSize * k * 0.6
      const sx = t.applyX(x)
      const sy = t.applyY(y)
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
      el.setAttribute('text-anchor', best.anchor)
      el.setAttribute('dx', String(dxAdjusted))
      
      const estHalfHeightPx = Math.max(1, lineCount) * labelFontSize * k * 0.6
      const top = sy + baseDy * k - estHalfHeightPx
      const bottom = sy + baseDy * k + estHalfHeightPx
      const overflowTop = Math.max(0, padPx - top)
      const overflowBottom = Math.max(0, bottom - (height - padPx))
      const shiftYPxRaw = overflowTop - overflowBottom
      const shiftYPx = Math.max(-maxShiftPx, Math.min(maxShiftPx, shiftYPxRaw))
      const dyAdjusted = baseDy + (k > 0 ? shiftYPx / k : 0)
      el.setAttribute('dy', String(dyAdjusted))
    })

    if (edgeLabelSel) {
      const hideBelow = schema.performance?.lod?.hideLabelsBelowScale ?? 0
      const hideEdgeLabels = hideBelow > 0 && d3.zoomTransform(svgEl).k < hideBelow
      if (hideEdgeLabels) {
        edgeLabelSel.attr('data-zoom-lod-hidden', '1').style('display', 'none')
      } else {
        edgeLabelSel.attr('data-zoom-lod-hidden', '0').style('display', null)
        const placedEdgeLabelRects: AabbRect[] = []
        edgeLabelSel.each(function (d: GraphEdge) {
          const el = this as unknown as SVGTextElement
          const edge = d as unknown as EdgeWithRuntime
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

          const labelHalfW = Math.max(2, (String(text).length * estimateLabelCharWidthPx(labelFontSize)) / 2)
          const labelHalfH = Math.max(2, labelFontSize * 0.6)
          const x = (() => {
            const mx = (p1.x + p2.x) / 2
            const my = (p1.y + p2.y) / 2
            const dx = p2.x - p1.x
            const dy = p2.y - p1.y
            const len = Math.hypot(dx, dy)
            if (!Number.isFinite(len) || len < 1e-6) return null
            const nx = -dy / len
            const ny = dx / len

            const overlapsEndpoint = (x: number, y: number) => {
              const os = Math.abs(x - sx) < srcExt.halfW + labelHalfW && Math.abs(y - sy) < srcExt.halfH + labelHalfH
              const ot = Math.abs(x - tx) < tgtExt.halfW + labelHalfW && Math.abs(y - ty) < tgtExt.halfH + labelHalfH
              return os || ot
            }

            let x = mx + nx * (labelFontSize * 0.9)
            let y = my + ny * (labelFontSize * 0.9)
            let found = !overlapsEndpoint(x, y)
            if (!found) {
              for (let attempt = 1; attempt <= 4; attempt += 1) {
                const off = labelFontSize * (0.9 + attempt * 0.9)
                const x1 = mx + nx * off
                const y1 = my + ny * off
                if (!overlapsEndpoint(x1, y1)) {
                  x = x1
                  y = y1
                  found = true
                  break
                }
              }
            }
            if (!found) return null
            const rect = { x, y, halfW: labelHalfW, halfH: labelHalfH }
            placedEdgeLabelRects.push(rect)
            return { x, y }
          })()

          if (!x) {
            el.style.display = 'none'
            return
          }

          const sx2 = t.applyX(x.x)
          const sy2 = t.applyY(x.y)
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
          el.setAttribute('x', String(x.x))
          el.setAttribute('y', String(x.y))
        })
      }
    }

    if (afterRenderFrame) {
      afterRenderFrame({ alpha: simulation.alpha(), tick })
    }
  }
  simulation.on('tick', renderFrame)
  renderFrame()
}

export const attachGlobalHandlers = (args: {
  svgRef: RefObject<SVGSVGElement>
  svg: SvgSelection
  tempLinkSelRef: MutableRefObject<TempLinkSelection>
  linkDragRef: MutableRefObject<PendingLink | null>
  selectNode: (id: string | null) => void
  hideTemp: () => void
  cancelPending: () => void
}): (() => void) => {
  const { svgRef, svg, tempLinkSelRef, linkDragRef, selectNode, hideTemp, cancelPending } = args
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
    window.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('pointerdown', onDocPointerDown, pointerDownOptions)
  }
}
