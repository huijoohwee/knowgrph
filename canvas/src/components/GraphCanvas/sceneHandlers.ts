import * as d3 from 'd3'
import type { MutableRefObject, RefObject } from 'react'
import type { GraphNode, GraphEdge } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import type { NodeGroup, GraphLayerHullGeometry } from '@/components/GraphCanvas/graphLayers'
import { computeGraphLayerHullGeometry } from '@/components/GraphCanvas/graphLayers'
import type { PendingLink, TempLinkSelection } from '@/features/edge-creation'
import { calcMouseGraphPosition, isNodePointerTarget } from '@/features/canvas/utils'
import { getRenderNodeRadius2d } from '@/components/GraphCanvas/helpers'
import type { EdgeWithRuntime } from '@/components/GraphCanvas/utils'
import type { TreeDerivation } from '@/components/GraphCanvas/layout/treeHelpers'

type SvgSelection = d3.Selection<SVGSVGElement, unknown, null, undefined>

export const attachSimulationTick = (args: {
  svgEl: SVGSVGElement
  simulation: d3.Simulation<GraphNode, GraphEdge>
  nodeSel: d3.Selection<SVGElement, GraphNode, SVGGElement, unknown>
  mediaSel?: d3.Selection<SVGGraphicsElement, GraphNode, SVGGElement, unknown> | null
  linkSel: d3.Selection<SVGElement, GraphEdge, SVGGElement, unknown>
  labelsSel: d3.Selection<SVGTextElement, GraphNode, SVGGElement, unknown>
  graphLayersHullSel: d3.Selection<SVGPathElement, NodeGroup, SVGGElement, unknown> | null
  graphLayerCentroidSel: d3.Selection<SVGCircleElement, NodeGroup, SVGGElement, unknown> | null
  graphLayerLabelSel: d3.Selection<SVGTextElement, NodeGroup, SVGGElement, unknown> | null
  nodeGroups: NodeGroup[]
  nodes: GraphNode[]
  schema: GraphSchema
  treeDerivation?: TreeDerivation | null
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
    graphLayersHullSel,
    graphLayerCentroidSel,
    graphLayerLabelSel,
    nodeGroups,
    nodes,
    schema,
    treeDerivation,
    width,
    height,
  } = args
  const nodeById = new Map<string, GraphNode>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    nodeById.set(String(n.id), n)
  }
  const treeCfg = schema.layout?.tree || {}
  const treeOrientation = treeCfg.orientation === 'vertical' ? 'vertical' : 'horizontal'
  type TreePoint = { x: number; y: number }
  type TreeLinkDatum = { source: TreePoint; target: TreePoint }
  const treeCurve = (() => {
    const raw = treeCfg.curve
    const kind = raw === 'linear' || raw === 'step' || raw === 'bump' ? raw : 'bump'
    if (kind === 'linear') return d3.curveLinear
    if (kind === 'step') return d3.curveStep
    return treeOrientation === 'horizontal' ? d3.curveBumpX : d3.curveBumpY
  })()
  const treeLinkGen = d3
    .link<TreeLinkDatum, TreePoint>(treeCurve)
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

  const isTree = schema.layout?.mode === 'tree'
  const isMermaid = schema.layout?.mode === 'mermaid'
  const baseDxFallback = schema.labelStyles?.offset?.dx ?? 12
  const baseDyFallback = schema.labelStyles?.offset?.dy ?? 4
  const labelFontSize = (() => {
    if (!isTree) return schema.labelStyles?.fontSize ?? 12
    const raw = treeCfg.labelFontSize
    if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) return raw
    const fromLabelStyles = schema.labelStyles?.fontSize
    if (typeof fromLabelStyles === 'number' && Number.isFinite(fromLabelStyles) && fromLabelStyles > 0) return fromLabelStyles
    return 10
  })()
  const renderFrame = () => {
    if (isTree) {
      const direction = treeDerivation?.direction ?? treeCfg.direction ?? 'source-target'
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
        const axisDelta = treeOrientation === 'horizontal' ? tx - sx : ty - sy
        const axisSign = axisDelta === 0 ? 1 : Math.sign(axisDelta)
        const sourcePoint: TreePoint =
          treeOrientation === 'horizontal'
            ? { x: sx + axisSign * sr, y: sy }
            : { x: sx, y: sy + axisSign * sr }
        const targetPoint: TreePoint =
          treeOrientation === 'horizontal'
            ? { x: tx - axisSign * tr, y: ty }
            : { x: tx, y: ty - axisSign * tr }
        const path = treeLinkGen({
          source: sourcePoint,
          target: targetPoint,
        })
        return path ?? ''
      })
    } else if (isMermaid) {
       ;(linkSel as d3.Selection<SVGPathElement, GraphEdge, SVGGElement, unknown>).attr('d', d => {
          const props = (d.properties || {}) as Record<string, unknown>;
          const points = props['visual:points'] as Array<{x: number, y: number}> | undefined;
          
          const edge = d as unknown as EdgeWithRuntime;
          const src = resolveNode(edge.source);
          const tgt = resolveNode(edge.target);
          if (!src || !tgt || src.x == null || src.y == null || tgt.x == null || tgt.y == null) return '';

          // If either node is being dragged (or simply has moved), the static 'points' from Dagre
          // will be dislocated. We check if the points match the current node positions.
          // If not, we fallback to a simple direct line or a dynamic curve.
          
          if (Array.isArray(points) && points.length > 1) {
              // Heuristic: Check if the first and last points of the B-spline are reasonably close 
              // to the current node centers. If they've drifted (due to drag), we should recalculate.
              const first = points[0];
              const last = points[points.length - 1];
              const driftThreshold = 3; // pixels - increased for smoother interaction
              
              const srcDrift = Math.sqrt(Math.pow(first.x - src.x, 2) + Math.pow(first.y - src.y, 2));
              const tgtDrift = Math.sqrt(Math.pow(last.x - tgt.x, 2) + Math.pow(last.y - tgt.y, 2));

              if (srcDrift < driftThreshold && tgtDrift < driftThreshold) {
                  const lineGen = d3.line<{x: number, y: number}>()
                      .x(p => p.x)
                      .y(p => p.y)
                      .curve(d3.curveBasis);
                  return lineGen(points) || '';
              }
          }
          
          // Fallback for dragging: dynamic straight line
          return `M${src.x},${src.y}L${tgt.x},${tgt.y}`;
       });
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
        const props = (d.properties || {}) as Record<string, unknown>;
        const w = typeof props['visual:width'] === 'number' ? props['visual:width'] : getRenderNodeRadius2d(d, schema) * 2;
        return (d.x ?? 0) - w / 2;
      })
      .attr('y', (d: GraphNode) => {
        const props = (d.properties || {}) as Record<string, unknown>;
        const h = typeof props['visual:height'] === 'number' ? props['visual:height'] : getRenderNodeRadius2d(d, schema) * 2;
        return (d.y ?? 0) - h / 2;
      })
      .attr('width', (d: GraphNode) => {
        const props = (d.properties || {}) as Record<string, unknown>;
        const w = typeof props['visual:width'] === 'number' ? props['visual:width'] : getRenderNodeRadius2d(d, schema) * 2;
        return w;
      })
      .attr('height', (d: GraphNode) => {
        const props = (d.properties || {}) as Record<string, unknown>;
        const h = typeof props['visual:height'] === 'number' ? props['visual:height'] : getRenderNodeRadius2d(d, schema) * 2;
        return h;
      })
      .attr('r', (d: GraphNode) => getRenderNodeRadius2d(d, schema))
      .attr('rx', (d: GraphNode) => {
        if (d.type === 'MermaidSubgraph') return 0;
        return getRenderNodeRadius2d(d, schema) * 0.22;
      })
      .attr('ry', (d: GraphNode) => {
        if (d.type === 'MermaidSubgraph') return 0;
        return getRenderNodeRadius2d(d, schema) * 0.22;
      })

    if (mediaSel) {
      mediaSel.attr('transform', (d: GraphNode) => {
        const x = typeof d.x === 'number' && Number.isFinite(d.x) ? d.x : 0
        const y = typeof d.y === 'number' && Number.isFinite(d.y) ? d.y : 0
        return `translate(${x},${y})`
      })
    }

    if (isMermaid) {
      labelsSel
        .attr('x', 0)
        .attr('y', 0)
        .attr('transform', (d: GraphNode) => {
          const x = typeof d.x === 'number' && Number.isFinite(d.x) ? d.x : 0
          const y = typeof d.y === 'number' && Number.isFinite(d.y) ? d.y : 0
          return `translate(${x},${y})`
        })
    } else {
        // Standard text positioning
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
          if (isTree) {
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
          if (!isTree) {
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
    }

    if ((graphLayersHullSel || graphLayerCentroidSel || graphLayerLabelSel) && nodeGroups.length) {
      const hideBelow = schema.performance?.lod?.hideLabelsBelowScale ?? 0
      const hideLayers = hideBelow > 0 && d3.zoomTransform(svgEl).k < hideBelow
      if (hideLayers) {
        if (graphLayersHullSel) {
          graphLayersHullSel.attr('data-zoom-lod-hidden', '1').style('display', 'none')
        }
        if (graphLayerCentroidSel) {
          graphLayerCentroidSel.attr('data-zoom-lod-hidden', '1').style('display', 'none')
        }
        if (graphLayerLabelSel) {
          graphLayerLabelSel.attr('data-zoom-lod-hidden', '1').style('display', 'none')
        }
        return
      }
      if (graphLayersHullSel) {
        graphLayersHullSel.attr('data-zoom-lod-hidden', '0').style('display', null)
      }
      if (graphLayerCentroidSel) {
        graphLayerCentroidSel.attr('data-zoom-lod-hidden', '0').style('display', null)
      }
      if (graphLayerLabelSel) {
        graphLayerLabelSel.attr('data-zoom-lod-hidden', '0').style('display', null)
      }
      const geometryById = new Map<string, GraphLayerHullGeometry>()
      for (let i = 0; i < nodeGroups.length; i += 1) {
        const group = nodeGroups[i]
        const geometry = computeGraphLayerHullGeometry({ group, nodeById, schema })
        geometryById.set(group.id, geometry)
      }
      if (graphLayersHullSel) {
        graphLayersHullSel.attr('d', group => {
          const geometry = geometryById.get(group.id)
          if (!geometry || !geometry.path) return ''
          return geometry.path
        })
      }
      if (graphLayerCentroidSel) {
        graphLayerCentroidSel
          .attr('cx', group => {
            const geometry = geometryById.get(group.id)
            if (!geometry) return Number.NaN
            return geometry.cx
          })
          .attr('cy', group => {
            const geometry = geometryById.get(group.id)
            if (!geometry) return Number.NaN
            return geometry.cy
          })
          .style('display', group => {
            const geometry = geometryById.get(group.id)
            return geometry ? null : 'none'
          })
      }
      if (graphLayerLabelSel) {
        graphLayerLabelSel
          .attr('x', group => {
            const geometry = geometryById.get(group.id)
            if (!geometry) return Number.NaN
            return geometry.cx
          })
          .attr('y', group => {
            const geometry = geometryById.get(group.id)
            if (!geometry) return Number.NaN
            if (typeof geometry.topY === 'number' && Number.isFinite(geometry.topY)) {
               // For Mermaid Subgraphs (or any box), place label slightly above top edge or inside top
               // Mermaid-land style: Inside top, centered.
               return geometry.topY + 14 // 14px down from top
            }
            return geometry.cy
          })
          .style('display', group => {
            const geometry = geometryById.get(group.id)
            if (!geometry) return 'none'
            const ownerType = group.meta?.ownerType ? String(group.meta.ownerType) : ''
            if (ownerType !== 'MermaidSubgraph') return 'none'
            const label = group.meta?.groupValue ? String(group.meta.groupValue) : ''
            return label ? null : 'none'
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
