import * as d3 from 'd3'
import type { GraphData, GraphNode, GraphEdge } from '@/lib/graph/types'
import { type GraphSchema } from '@/lib/graph/schema'
import type { HoverInfo } from '@/components/GraphHoverTooltip'
import { getRenderNodeRadius2d } from '@/components/GraphCanvas/helpers'
import { type NodeGroup } from './nodeGroups'
import { getGraphLayerStyleForGroup } from './graphLayerStyles'

// Re-export for backward compatibility
export * from './nodeGroups'
export * from './graphLayerStyles'

type GSelection = d3.Selection<SVGGElement, unknown, null, undefined>

export type GraphLayerHullGeometry = {
  path: string
  cx: number
  cy: number
  topY?: number
} | null

export const computeGraphLayerHullGeometry = (args: {
  group: NodeGroup
  nodeById: Map<string, GraphNode>
  schema: GraphSchema
}): GraphLayerHullGeometry => {
  const { group, nodeById, schema } = args
  const ids = group.memberIds
  if (!ids || !ids.length) return null
  const points: [number, number][] = []
  const isRectMode = schema.layout?.mode === 'mermaid' || schema.layout?.mode === 'tree'
  const isMermaidSubgraph = group.meta?.ownerType === 'MermaidSubgraph'

  if (isMermaidSubgraph) {
    // Check if the subgraph node itself has layout info (from Dagre)
    if (group.meta?.ownerId) {
       const ownerNode = nodeById.get(group.meta.ownerId)
       if (ownerNode) {
          const props = (ownerNode.properties || {}) as Record<string, unknown>
          
          // Use live coordinates (x, y) if available, falling back to static visual props
          // Dagre layout sets visual:x/y initially, but drag updates .x/.y
          let vx = typeof ownerNode.x === 'number' ? ownerNode.x : null
          let vy = typeof ownerNode.y === 'number' ? ownerNode.y : null
          
          if (vx == null || vy == null) {
              vx = typeof props['visual:x'] === 'number' ? props['visual:x'] : null
              vy = typeof props['visual:y'] === 'number' ? props['visual:y'] : null
          }

          const vw = typeof props['visual:width'] === 'number' ? props['visual:width'] : null
          const vh = typeof props['visual:height'] === 'number' ? props['visual:height'] : null
          
          if (vx != null && vy != null && vw != null && vh != null && vw > 0 && vh > 0) {
             const minX = vx - vw / 2
             const minY = vy - vh / 2
             const pathBuilder = d3.path()
             pathBuilder.rect(minX, minY, vw, vh)
             return {
                path: pathBuilder.toString(),
                cx: vx,
                cy: vy,
                topY: minY
             }
          }
       }
    }

    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    let valid = false

    for (let i = 0; i < ids.length; i += 1) {
      const id = ids[i]
      const node = nodeById.get(String(id))
      if (!node) continue
      const x = typeof node.x === 'number' ? node.x : null
      const y = typeof node.y === 'number' ? node.y : null
      if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) continue

      const props = (node.properties || {}) as Record<string, unknown>
      const visualW = typeof props['visual:width'] === 'number' ? props['visual:width'] : 0
      const visualH = typeof props['visual:height'] === 'number' ? props['visual:height'] : 0

      const padding = 12
      const halfW = visualW && Number.isFinite(visualW) ? visualW / 2 : getRenderNodeRadius2d(node, schema)
      const halfH = visualH && Number.isFinite(visualH) ? visualH / 2 : getRenderNodeRadius2d(node, schema)

      const w = halfW + padding
      const h = halfH + padding

      const nx1 = x - w
      const nx2 = x + w
      const ny1 = y - h
      const ny2 = y + h

      if (nx1 < minX) minX = nx1
      if (nx2 > maxX) maxX = nx2
      if (ny1 < minY) minY = ny1
      if (ny2 > maxY) maxY = ny2
      valid = true
    }

    if (!valid) return null

    const boxW = maxX - minX
    const boxH = maxY - minY
    if (!Number.isFinite(boxW) || !Number.isFinite(boxH) || boxW <= 0 || boxH <= 0) return null

    const pathBuilder = d3.path()
    pathBuilder.rect(minX, minY, boxW, boxH)
    return {
      path: pathBuilder.toString(),
      cx: minX + boxW / 2,
      cy: minY + boxH / 2,
      topY: minY,
    }
  }

  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i]
    const node = nodeById.get(String(id))
    if (!node) continue
    const x = typeof node.x === 'number' ? node.x : null
    const y = typeof node.y === 'number' ? node.y : null
    if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) continue
    
    let w = 0;
    let h = 0;
    
    if (isRectMode) {
       const props = (node.properties || {}) as Record<string, unknown>;
       const visualW = typeof props['visual:width'] === 'number' ? props['visual:width'] : 0;
       const visualH = typeof props['visual:height'] === 'number' ? props['visual:height'] : 0;
       // Add padding for rectangular nodes (Mermaid/Tree) so the hull doesn't touch the node border
       const padding = 12; 
       if (visualW && visualH) {
           w = (visualW / 2) + padding;
           h = (visualH / 2) + padding;
       } else {
           const r = getRenderNodeRadius2d(node, schema);
           w = r + padding;
           h = r + padding;
       }
    } else {
        const r = getRenderNodeRadius2d(node, schema);
        const radius = Number.isFinite(r) && r > 0 ? r : 10;
        w = radius;
        h = radius;
    }
    
    const px1 = x + w
    const py1 = y + h
    if (Number.isFinite(px1) && Number.isFinite(py1)) points.push([px1, py1])
    const px2 = x - w
    const py2 = y + h
    if (Number.isFinite(px2) && Number.isFinite(py2)) points.push([px2, py2])
    const px3 = x + w
    const py3 = y - h
    if (Number.isFinite(px3) && Number.isFinite(py3)) points.push([px3, py3])
    const px4 = x - w
    const py4 = y - h
    if (Number.isFinite(px4) && Number.isFinite(py4)) points.push([px4, py4])
  }
  if (points.length < 3) return null
  const hull = d3.polygonHull(points) ?? points
  if (!hull || hull.length === 0) return null
  const pathBuilder = d3.path()
  pathBuilder.moveTo(hull[0][0], hull[0][1])
  for (let i = 1; i < hull.length; i += 1) {
    pathBuilder.lineTo(hull[i][0], hull[i][1])
  }
  pathBuilder.closePath()
  const d = pathBuilder.toString()
  if (!d) return null
  const centroid = d3.polygonCentroid(hull)
  const cx = Number.isFinite(centroid[0]) ? centroid[0] : hull[0][0]
  const cy = Number.isFinite(centroid[1]) ? centroid[1] : hull[0][1]
  return { path: d, cx, cy }
}

export const applyGraphLayerCentroidDelta = (args: {
  group: NodeGroup
  dx: number
  dy: number
  nodeById: Map<string, GraphNode>
  hullSel: d3.Selection<SVGPathElement, NodeGroup, SVGGElement, unknown>
  centroidSel: d3.Selection<SVGCircleElement, NodeGroup, SVGGElement, unknown>
  schema: GraphSchema
}): void => {
  const { group, dx, dy, nodeById, hullSel, centroidSel, schema } = args
  if (!(dx || dy)) return
  const ids = Array.isArray(group.memberIds) ? group.memberIds : []
  for (let i = 0; i < ids.length; i += 1) {
    const id = String(ids[i])
    if (!id) continue
    const node = nodeById.get(id)
    if (!node) continue
    const x = typeof node.x === 'number' && Number.isFinite(node.x) ? node.x : 0
    const y = typeof node.y === 'number' && Number.isFinite(node.y) ? node.y : 0
    const nx = x + dx
    const ny = y + dy
    if (!Number.isFinite(nx) || !Number.isFinite(ny)) continue
    node.x = nx
    node.y = ny
    node.fx = nx
    node.fy = ny
  }
  const geometry = computeGraphLayerHullGeometry({ group, nodeById, schema })
  if (!geometry) return
  hullSel
    .filter(d => d.id === group.id)
    .attr('d', geometry.path)
  centroidSel
    .filter(d => d.id === group.id)
    .attr('cx', geometry.cx)
    .attr('cy', geometry.cy)
}

export const createGraphLayersLayer = (args: {
  g: GSelection
  nodeGroups: NodeGroup[]
  graphData: GraphData
  schema: GraphSchema
  graphLayersVisible: boolean
  hoverEnabled: boolean
  setHoverInfo: (updater: (prev: HoverInfo | null) => HoverInfo | null) => void
  simulation?: d3.Simulation<GraphNode, GraphEdge>
}): {
  hullSel: d3.Selection<SVGPathElement, NodeGroup, SVGGElement, unknown> | null
  centroidSel: d3.Selection<SVGCircleElement, NodeGroup, SVGGElement, unknown> | null
  labelSel: d3.Selection<SVGTextElement, NodeGroup, SVGGElement, unknown> | null
} => {
  const { g, nodeGroups, graphData, schema, graphLayersVisible, hoverEnabled, setHoverInfo, simulation } = args
  if (!nodeGroups.length || !graphLayersVisible) {
    return { hullSel: null, centroidSel: null, labelSel: null }
  }

  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  const nodeById = new Map<string, GraphNode>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    nodeById.set(String(n.id), n)
  }

  const layerRoot = g.append('g').attr('data-kg-layer', 'node-groups')
  const getHoverNodeIdForGroup = (group: NodeGroup): string | null => {
    const ownerId = group.meta?.ownerId
    if (ownerId) return String(ownerId)
    const first = Array.isArray(group.memberIds) && group.memberIds.length > 0 ? group.memberIds[0] : null
    if (first) return String(first)
    return null
  }
  const hullSel = layerRoot
    .selectAll<SVGPathElement, NodeGroup>('path')
    .data(nodeGroups, d => d.id)
    .enter()
    .append('path')
    .each(function applyGroupStyle(group) {
      const style = getGraphLayerStyleForGroup({ group, graphData, schema })
      const sel = d3.select<SVGPathElement, NodeGroup>(this as SVGPathElement)
      sel
        .attr('fill', style.fill)
        .attr('fill-opacity', style.fillOpacity)
        .attr('stroke', style.stroke)
        .attr('stroke-width', style.strokeWidth)
        .attr('stroke-dasharray', style.dash)
    })
    .attr('data-kg-layer-hull', '1')
    .style('pointer-events', 'none')
    .style('cursor', 'default')

  const centroidSel = layerRoot
    .selectAll<SVGCircleElement, NodeGroup>('circle')
    .data(nodeGroups, d => d.id)
    .enter()
    .append('circle')
    .attr('data-kg-layer-centroid', '1')
    .attr('r', 6)
    .style('pointer-events', 'all')
    .style('cursor', 'move')
    .each(function applyCentroidStyle(group) {
      const style = getGraphLayerStyleForGroup({ group, graphData, schema })
      const sel = d3.select<SVGCircleElement, NodeGroup>(this as SVGCircleElement)
      sel
        .attr('fill', style.fill)
        .attr('fill-opacity', Math.min(1, style.fillOpacity + 0.1))
        .attr('stroke', style.stroke)
        .attr('stroke-width', style.strokeWidth)
    })
    .on('mouseover', (event: MouseEvent, group: NodeGroup) => {
      if (!hoverEnabled) return
      const hoverId = getHoverNodeIdForGroup(group)
      if (!hoverId) return
      setHoverInfo(() => ({
        kind: 'node',
        id: hoverId,
        clientX: event.clientX,
        clientY: event.clientY,
      }))
    })
    .on('mousemove', (event: MouseEvent, group: NodeGroup) => {
      if (!hoverEnabled) return
      const hoverId = getHoverNodeIdForGroup(group)
      if (!hoverId) return
      setHoverInfo(() => ({
        kind: 'node',
        id: hoverId,
        clientX: event.clientX,
        clientY: event.clientY,
      }))
    })
    .on('mouseout', (_event: MouseEvent, group: NodeGroup) => {
      if (!hoverEnabled) return
      const hoverId = getHoverNodeIdForGroup(group)
      if (!hoverId) return
      setHoverInfo(prev => (prev && prev.kind === 'node' && prev.id === hoverId ? null : prev))
    })
    .call(
      d3
        .drag<SVGCircleElement, NodeGroup>()
        .on('start', (event) => {
          if (event.sourceEvent && typeof event.sourceEvent.stopPropagation === 'function') {
            event.sourceEvent.stopPropagation()
          }
          if (simulation && schema.layout?.mode !== 'mermaid' && !event.active) {
            simulation.alphaTarget(0.3).restart()
          }
        })
        .on('drag', (event, group) => {
          const dx = typeof event.dx === 'number' && Number.isFinite(event.dx) ? event.dx : 0
          const dy = typeof event.dy === 'number' && Number.isFinite(event.dy) ? event.dy : 0
          if (dx === 0 && dy === 0) return
          applyGraphLayerCentroidDelta({ group, dx, dy, nodeById, hullSel, centroidSel, schema })
          if (simulation && schema.layout?.mode === 'mermaid') {
            const tickHandler = simulation.on('tick')
            if (tickHandler) {
              ;(tickHandler as unknown as () => void)()
            }
          }
        })
        .on('end', (event) => {
          if (!simulation) return
          if (schema.layout?.mode !== 'mermaid' && !event.active) {
            simulation.alphaTarget(0)
          }
          if (schema.layout?.mode === 'radial' || schema.layout?.mode === 'tree') {
            simulation.stop()
          }
          if (schema.layout?.mode === 'mermaid') {
            simulation.stop()
          }
        }),
    )

  const labelSel = layerRoot
    .selectAll<SVGTextElement, NodeGroup>('text')
    .data(nodeGroups, d => d.id)
    .enter()
    .append('text')
    .attr('data-kg-layer-label', '1')
    .attr('text-anchor', 'middle')
    .attr('dominant-baseline', 'middle')
    .attr('font-size', schema.labelStyles?.fontSize ?? 12)
    .attr('fill', schema.labelStyles?.color ?? '#111')
    .style('pointer-events', 'none')
    .text(group => {
      const ownerType = group.meta?.ownerType ? String(group.meta.ownerType) : ''
      if (ownerType !== 'MermaidSubgraph') return ''
      const raw = group.meta?.groupValue ? String(group.meta.groupValue) : ''
      return raw
    })
    .each(function positionLabel(group) {
       const geometry = computeGraphLayerHullGeometry({ group, nodeById, schema })
       if (!geometry) return
       d3.select(this)
         .attr('x', geometry.cx)
         .attr('y', typeof geometry.topY === 'number' && Number.isFinite(geometry.topY) ? geometry.topY + 14 : geometry.cy)
    })

  const geometryById = new Map<string, GraphLayerHullGeometry>()
  for (let i = 0; i < nodeGroups.length; i += 1) {
    const group = nodeGroups[i]
    geometryById.set(group.id, computeGraphLayerHullGeometry({ group, nodeById, schema }))
  }
  hullSel.attr('d', group => {
    const geometry = geometryById.get(group.id)
    return geometry?.path || ''
  })
  centroidSel
    .attr('cx', group => {
      const geometry = geometryById.get(group.id)
      return geometry ? geometry.cx : Number.NaN
    })
    .attr('cy', group => {
      const geometry = geometryById.get(group.id)
      return geometry ? geometry.cy : Number.NaN
    })
    .style('display', group => {
      const geometry = geometryById.get(group.id)
      return geometry ? null : 'none'
    })
  labelSel
    .attr('x', group => {
      const geometry = geometryById.get(group.id)
      return geometry ? geometry.cx : Number.NaN
    })
    .attr('y', group => {
      const geometry = geometryById.get(group.id)
      if (!geometry) return Number.NaN
      if (typeof geometry.topY === 'number' && Number.isFinite(geometry.topY)) return geometry.topY + 14
      return geometry.cy
    })

  return { hullSel, centroidSel, labelSel }
}
