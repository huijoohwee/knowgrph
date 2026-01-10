import * as d3 from 'd3'
import type { MutableRefObject, RefObject } from 'react'
import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { NodeGroup } from '@/components/GraphCanvas/graphLayers'
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation'
import { calcMouseGraphPosition, isNodePointerTarget } from '@/features/canvas/utils'
import { getRenderNodeRadius2d } from '@/components/GraphCanvas/helpers'
import type { EdgeWithRuntime, TidyTreeDerivation } from '@/components/GraphCanvas/utils'

type SvgSelection = d3.Selection<SVGSVGElement, unknown, null, undefined>

export const attachSimulationTick = (args: {
  svgEl: SVGSVGElement
  simulation: d3.Simulation<GraphNode, GraphEdge>
  nodeSel: d3.Selection<SVGElement, GraphNode, SVGGElement, unknown>
  mediaSel?: d3.Selection<SVGGraphicsElement, GraphNode, SVGGElement, unknown> | null
  linkSel: d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown>
  labelsSel: d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown>
  graphLayersSel: d3.Selection<SVGPathElement, NodeGroup, SVGGElement, unknown> | null
  nodeGroups: NodeGroup[]
  nodes: GraphNode[]
  schema: GraphSchema
  tidyTreeDerivation: TidyTreeDerivation | null
  width: number
  height: number
}) => {
  const {
    svgEl,
    simulation,
    nodeSel,
    mediaSel,
    linkSel,
    labelsSel,
    graphLayersSel,
    nodeGroups,
    nodes,
    schema,
    tidyTreeDerivation,
    width,
    height,
  } = args
  const nodeById = new Map<string, GraphNode>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    nodeById.set(String(n.id), n)
  }
  const tidyCfg = schema.layout?.tidyTree || {}
  const tidyOrientation = tidyCfg.orientation === 'vertical' ? 'vertical' : 'horizontal'
  type TidyPoint = { x: number; y: number }
  type TidyLinkDatum = { source: TidyPoint; target: TidyPoint }
  const tidyCurve = (() => {
    const raw = tidyCfg.curve
    const kind = raw === 'linear' || raw === 'step' || raw === 'bump' ? raw : 'bump'
    if (kind === 'linear') return d3.curveLinear
    if (kind === 'step') return d3.curveStep
    return tidyOrientation === 'horizontal' ? d3.curveBumpX : d3.curveBumpY
  })()
  const tidyLinkGen = d3
    .link<TidyLinkDatum, TidyPoint>(tidyCurve)
    .x(d => d.x)
    .y(d => d.y)

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

  const isTidyTree = schema.layout?.mode === 'tidy-tree'
  const baseDxFallback = schema.labelStyles?.offset?.dx ?? 12
  const baseDyFallback = schema.labelStyles?.offset?.dy ?? 4
  const labelFontSize = (() => {
    if (!isTidyTree) return schema.labelStyles?.fontSize ?? 12
    const raw = tidyCfg.labelFontSize
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw
    const fromLabelStyles = schema.labelStyles?.fontSize
    if (typeof fromLabelStyles === 'number' && Number.isFinite(fromLabelStyles) && fromLabelStyles > 0) return fromLabelStyles
    return 10
  })()
  const renderFrame = () => {
    if (isTidyTree) {
      const direction = tidyTreeDerivation?.direction ?? 'source-target'
      ;(linkSel as d3.Selection<SVGPathElement, GraphEdge, SVGGElement, unknown>).attr('d', d => {
        const edge = d as unknown as EdgeWithRuntime
        const srcNode = resolveNode(edge.source)
        const tgtNode = resolveNode(edge.target)
        if (!srcNode || !tgtNode) return ''
        const source = direction === 'source-target' ? srcNode : tgtNode
        const target = direction === 'source-target' ? tgtNode : srcNode
        const sr = getRenderNodeRadius2d(source, schema)
        const tr = getRenderNodeRadius2d(target, schema)
        const sx = source.x ?? 0
        const sy = source.y ?? 0
        const tx = target.x ?? 0
        const ty = target.y ?? 0
        const axisDelta = tidyOrientation === 'horizontal' ? tx - sx : ty - sy
        const axisSign = axisDelta === 0 ? 1 : Math.sign(axisDelta)
        const sourcePoint: TidyPoint =
          tidyOrientation === 'horizontal'
            ? { x: sx + axisSign * sr, y: sy }
            : { x: sx, y: sy + axisSign * sr }
        const targetPoint: TidyPoint =
          tidyOrientation === 'horizontal'
            ? { x: tx - axisSign * tr, y: ty }
            : { x: tx, y: ty - axisSign * tr }
        const path = tidyLinkGen({
          source: sourcePoint,
          target: targetPoint,
        })
        return path ?? ''
      })
    } else {
      ;(linkSel as d3.Selection<SVGLineElement, GraphEdge, SVGGElement, unknown>)
        .attr('x1', (d: GraphEdge & { source: GraphNode; target: GraphNode }) => d.source.x ?? 0)
        .attr('y1', (d: GraphEdge & { source: GraphNode; target: GraphNode }) => d.source.y ?? 0)
        .attr('x2', (d: GraphEdge & { source: GraphNode; target: GraphNode }) => d.target.x ?? 0)
        .attr('y2', (d: GraphEdge & { source: GraphNode; target: GraphNode }) => d.target.y ?? 0)
    }

    nodeSel
      .attr('cx', (d: GraphNode) => d.x!)
      .attr('cy', (d: GraphNode) => d.y!)
      .attr('x', (d: GraphNode) => {
        const r = getRenderNodeRadius2d(d, schema)
        return (d.x ?? 0) - r
      })
      .attr('y', (d: GraphNode) => {
        const r = getRenderNodeRadius2d(d, schema)
        return (d.y ?? 0) - r
      })
      .attr('width', (d: GraphNode) => getRenderNodeRadius2d(d, schema) * 2)
      .attr('height', (d: GraphNode) => getRenderNodeRadius2d(d, schema) * 2)
      .attr('r', (d: GraphNode) => getRenderNodeRadius2d(d, schema))
      .attr('rx', (d: GraphNode) => getRenderNodeRadius2d(d, schema) * 0.22)
      .attr('ry', (d: GraphNode) => getRenderNodeRadius2d(d, schema) * 0.22)

    if (mediaSel) {
      mediaSel.attr('transform', (d: GraphNode) => {
        const x = typeof d.x === 'number' && Number.isFinite(d.x) ? d.x : 0
        const y = typeof d.y === 'number' && Number.isFinite(d.y) ? d.y : 0
        return `translate(${x},${y})`
      })
    }

    labelsSel.attr('x', (d: GraphNode) => d.x!).attr('y', (d: GraphNode) => d.y!)
    const t = d3.zoomTransform(svgEl)
    const k = t.k || 1
    const padPx = 8
    labelsSel.each(function (d: GraphNode) {
      const el = this as unknown as SVGTextElement
      const label = String(d.label ?? '')
      const charCount = label.length
      const estWidthPx = Math.max(0, charCount) * labelFontSize * k * 0.6
      const sx = t.applyX(d.x ?? 0)
      const sy = t.applyY(d.y ?? 0)
      const baseAnchor = (el.getAttribute('data-base-anchor') as 'start' | 'end' | null) ?? 'start'
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
      const candidates: Array<{ anchor: 'start' | 'end'; dx: number }> = []
      if (isTidyTree) {
        candidates.push({ anchor: baseAnchor, dx: baseDx })
      } else {
        const abs = Math.abs(baseDx)
        candidates.push({ anchor: 'start', dx: abs })
        candidates.push({ anchor: 'end', dx: -abs })
      }
      let best = candidates[0]
      let bestOverflow = Number.POSITIVE_INFINITY
      for (let i = 0; i < candidates.length; i += 1) {
        const c = candidates[i]
        const left = c.anchor === 'start' ? sx + c.dx * k : sx + c.dx * k - estWidthPx
        const right = c.anchor === 'start' ? left + estWidthPx : sx + c.dx * k
        const overflowLeft = Math.max(0, padPx - left)
        const overflowRight = Math.max(0, right - (width - padPx))
        const total = overflowLeft + overflowRight
        if (total < bestOverflow) {
          bestOverflow = total
          best = c
        }
      }
      const left0 = best.anchor === 'start' ? sx + best.dx * k : sx + best.dx * k - estWidthPx
      const right0 = best.anchor === 'start' ? left0 + estWidthPx : sx + best.dx * k
      const overflowLeft0 = Math.max(0, padPx - left0)
      const overflowRight0 = Math.max(0, right0 - (width - padPx))
      const shiftPx = overflowLeft0 - overflowRight0
      const dxAdjusted = best.dx + (k > 0 ? shiftPx / k : 0)
      el.setAttribute('text-anchor', best.anchor)
      el.setAttribute('dx', String(dxAdjusted))
      if (!isTidyTree) {
        const estAscentPx = labelFontSize * k * 0.8
        const estDescentPx = labelFontSize * k * 0.25
        const top = sy + baseDy * k - estAscentPx
        const bottom = sy + baseDy * k + estDescentPx
        const overflowTop = Math.max(0, padPx - top)
        const overflowBottom = Math.max(0, bottom - (height - padPx))
        const shiftYPx = overflowTop - overflowBottom
        const dyAdjusted = baseDy + (k > 0 ? shiftYPx / k : 0)
        el.setAttribute('dy', String(dyAdjusted))
      }
    })

    if (graphLayersSel && nodeGroups.length) {
      graphLayersSel.attr('d', group => {
        const ids = group.memberIds
        if (!ids || !ids.length) return ''
        const points: [number, number][] = []
        for (let i = 0; i < ids.length; i += 1) {
          const id = ids[i]
          const node = nodeById.get(String(id))
          if (!node) continue
          const x = typeof node.x === 'number' ? node.x : null
          const y = typeof node.y === 'number' ? node.y : null
          if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) continue
          points.push([x, y])
        }
        if (points.length < 2) return ''
        const hull = d3.polygonHull(points) ?? points
        if (!hull || hull.length === 0) return ''
        const path = d3.path()
        path.moveTo(hull[0][0], hull[0][1])
        for (let i = 1; i < hull.length; i += 1) {
          path.lineTo(hull[i][0], hull[i][1])
        }
        path.closePath()
        const d = path.toString()
        return d || ''
      })
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
