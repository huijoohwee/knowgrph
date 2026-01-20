import * as d3 from 'd3'
import type { MutableRefObject, RefObject } from 'react'
import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation'
import { calcMouseGraphPosition, isNodePointerTarget } from '@/features/canvas/utils'
import { getRenderNodeRadius2d } from '@/components/GraphCanvas/helpers'
import type { EdgeWithRuntime } from '@/components/GraphCanvas/utils'
import { getEdgeEndpointFromPorts, getPortHandlePosition, getPortHandlesConfig, type PortHandleDatum } from '@/components/GraphCanvas/portHandles'
import { getNodeRectDimensions2d } from '@/components/GraphCanvas/nodeSizing2d'

type SvgSelection = d3.Selection<SVGSVGElement, unknown, null, undefined>

export const attachSimulationTick = (args: {
  svgEl: SVGSVGElement
  simulation: d3.Simulation<GraphNode, GraphEdge>
  nodeSelRef: MutableRefObject<d3.Selection<SVGElement, GraphNode, SVGGElement, unknown> | null>
  mediaSelRef: MutableRefObject<d3.Selection<SVGGraphicsElement, GraphNode, SVGGElement, unknown> | null>
  portHandlesSelRef: MutableRefObject<d3.Selection<SVGCircleElement, PortHandleDatum, SVGGElement, unknown> | null>
  linkSelRef: MutableRefObject<d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown> | null>
  edgeLabelSel?: d3.Selection<SVGTextElement, GraphEdge, SVGGElement, unknown> | null
  labelsSelRef: MutableRefObject<d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown> | null>
  nodes: GraphNode[]
  getSchema: () => GraphSchema
  width: number
  height: number
  beforeRenderFrameRef?: MutableRefObject<(() => void) | null>
}) => {
  const {
    svgEl,
    simulation,
    nodeSelRef,
    mediaSelRef,
    portHandlesSelRef,
    linkSelRef,
    edgeLabelSel,
    labelsSelRef,
    nodes,
    getSchema,
    width,
    height,
    beforeRenderFrameRef,
  } = args
  const nodeById = new Map<string, GraphNode>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    nodeById.set(String(n.id), n)
  }

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

  const renderFrame = () => {
    const beforeRenderFrame = beforeRenderFrameRef ? beforeRenderFrameRef.current : null
    if (beforeRenderFrame) beforeRenderFrame()
    const schema = getSchema()
    const portHandlesCfg = getPortHandlesConfig(schema)
    const portHandlesEnabled = portHandlesCfg.enabled
    const baseDxFallback = schema.labelStyles?.offset?.dx ?? 12
    const baseDyFallback = schema.labelStyles?.offset?.dy ?? 4
    const labelFontSize = schema.labelStyles?.fontSize ?? 12
    const linkSel = linkSelRef.current
    if (!linkSel) return
    if (portHandlesEnabled) {
      ;(linkSel as d3.Selection<SVGLineElement, GraphEdge, SVGGElement, unknown>)
        .attr('x1', (d: GraphEdge & { source: GraphNode; target: GraphNode }) => {
          const p = getEdgeEndpointFromPorts({ from: d.source, to: d.target, schema })
          return p.x
        })
        .attr('y1', (d: GraphEdge & { source: GraphNode; target: GraphNode }) => {
          const p = getEdgeEndpointFromPorts({ from: d.source, to: d.target, schema })
          return p.y
        })
        .attr('x2', (d: GraphEdge & { source: GraphNode; target: GraphNode }) => {
          const p = getEdgeEndpointFromPorts({ from: d.target, to: d.source, schema })
          return p.x
        })
        .attr('y2', (d: GraphEdge & { source: GraphNode; target: GraphNode }) => {
          const p = getEdgeEndpointFromPorts({ from: d.target, to: d.source, schema })
          return p.y
        })
    } else {
      ;(linkSel as d3.Selection<SVGLineElement, GraphEdge, SVGGElement, unknown>)
        .attr('x1', (d: GraphEdge & { source: GraphNode; target: GraphNode }) => d.source.x ?? 0)
        .attr('y1', (d: GraphEdge & { source: GraphNode; target: GraphNode }) => d.source.y ?? 0)
        .attr('x2', (d: GraphEdge & { source: GraphNode; target: GraphNode }) => d.target.x ?? 0)
        .attr('y2', (d: GraphEdge & { source: GraphNode; target: GraphNode }) => d.target.y ?? 0)
    }

    const nodeSel = nodeSelRef.current
    if (nodeSel) {
      nodeSel
        .attr('cx', (d: GraphNode) => d.x!)
        .attr('cy', (d: GraphNode) => d.y!)
        .attr('x', (d: GraphNode) => {
          const { width } = getNodeRectDimensions2d(d, schema)
          return (d.x ?? 0) - width / 2
        })
        .attr('y', (d: GraphNode) => {
          const { height } = getNodeRectDimensions2d(d, schema)
          return (d.y ?? 0) - height / 2
        })
        .attr('width', (d: GraphNode) => {
          return getNodeRectDimensions2d(d, schema).width
        })
        .attr('height', (d: GraphNode) => {
          return getNodeRectDimensions2d(d, schema).height
        })
        .attr('r', (d: GraphNode) => getRenderNodeRadius2d(d, schema))
        .attr('rx', (d: GraphNode) => {
          return getRenderNodeRadius2d(d, schema) * 0.22;
        })
        .attr('ry', (d: GraphNode) => {
          return getRenderNodeRadius2d(d, schema) * 0.22;
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
    labelsSel.attr('x', (d: GraphNode) => d.x!).attr('y', (d: GraphNode) => d.y!)
    const t = d3.zoomTransform(svgEl)
    const k = t.k || 1
    const padPx = 8
    labelsSel.each(function (d: GraphNode) {
      const el = this as unknown as SVGTextElement
      
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
      const sx = t.applyX(d.x ?? 0)
      const sy = t.applyY(d.y ?? 0)
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
      const shiftPx = overflowLeft0 - overflowRight0
      const dxAdjusted = best.dx + (k > 0 ? shiftPx / k : 0)
      el.setAttribute('text-anchor', best.anchor)
      el.setAttribute('dx', String(dxAdjusted))
      
      const estHalfHeightPx = Math.max(1, lineCount) * labelFontSize * k * 0.6
      const top = sy + baseDy * k - estHalfHeightPx
      const bottom = sy + baseDy * k + estHalfHeightPx
      const overflowTop = Math.max(0, padPx - top)
      const overflowBottom = Math.max(0, bottom - (height - padPx))
      const shiftYPx = overflowTop - overflowBottom
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
        edgeLabelSel
          .attr('x', (d: GraphEdge) => {
            const edge = d as unknown as EdgeWithRuntime
            const srcNode = resolveNode(edge.source)
            const tgtNode = resolveNode(edge.target)
            if (!srcNode || !tgtNode) return 0
            const sx = srcNode.x ?? 0
            const tx = tgtNode.x ?? 0
            return (sx + tx) / 2
          })
          .attr('y', (d: GraphEdge) => {
            const edge = d as unknown as EdgeWithRuntime
            const srcNode = resolveNode(edge.source)
            const tgtNode = resolveNode(edge.target)
            if (!srcNode || !tgtNode) return 0
            const sy = srcNode.y ?? 0
            const ty = tgtNode.y ?? 0
            return (sy + ty) / 2 - labelFontSize * 0.9
          })
      }
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
  const {
    svgRef,
    svg,
    tempLinkSelRef,
    linkDragRef,
    selectNode,
    hideTemp,
    cancelPending,
  } = args

  svg.on('mousemove', (ev: MouseEvent) => {
    if (!tempLinkSelRef.current || !linkDragRef.current) return
    const p = calcMouseGraphPosition(svgRef, ev)
    tempLinkSelRef.current.attr('x2', p[0]).attr('y2', p[1])
  })

  svg.on('mouseup', () => {
    hideTemp()
  })

  svg.on('click', (ev: MouseEvent) => {
    if (typeof ev.button === 'number' && ev.button !== 0) return
    selectNode(null)
    cancelPending()
  })

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      hideTemp()
      cancelPending()
    }
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
