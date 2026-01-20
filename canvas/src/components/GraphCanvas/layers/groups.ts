import * as d3 from 'd3'
import type { GraphNode, GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { getNodeHalfExtents2d } from '@/components/GraphCanvas/nodeSizing2d'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { MVP_COLOR_PALETTE } from '@/lib/graph/schema'
import { buildClosedPathD, computeConvexRing, type Point2d } from '@/lib/geometry/convexRing'

type GroupDatum = GraphGroup

export type GroupsLayer = {
  update: () => void
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

export const createGroupsLayer = (args: {
  g: d3.Selection<SVGGElement, unknown, null, undefined>
  graphData: GraphData
  schema: GraphSchema
}): GroupsLayer => {
  const { g, graphData, schema } = args
  const cfg = schema.layout?.groups || {}
  const enabled = cfg.enabled !== false
  if (!enabled) return { update: () => {} }

  const groups = deriveGraphGroups(graphData)
  if (groups.length === 0) return { update: () => {} }

  const shape: 'rect' | 'geo' = cfg.shape === 'geo' ? 'geo' : 'rect'

  const nodeById = new Map<string, GraphNode>()
  for (let i = 0; i < graphData.nodes.length; i += 1) {
    const n = graphData.nodes[i]
    const props = (n.properties || {}) as Record<string, unknown>
    const isHeadingSection = String(n.type || '') === 'Section' && typeof props.level === 'number'
    if (String(n.type || '') === 'MermaidSubgraph' || isHeadingSection) continue
    nodeById.set(String(n.id), n)
  }

  const layer = g.append('g').attr('data-kg-layer', 'groups')

  const itemSel = layer
    .selectAll<SVGGElement, GroupDatum>('g')
    .data(groups, d => d.id)
    .join('g')
    .attr('data-kg-group-id', d => d.id)
    .style('pointer-events', 'none')

  const rectSel = itemSel
    .append('rect')
    .attr('data-kg-shape', 'group-rect')
    .attr('rx', typeof cfg.cornerRadius === 'number' && Number.isFinite(cfg.cornerRadius) ? cfg.cornerRadius : 12)
    .attr('ry', typeof cfg.cornerRadius === 'number' && Number.isFinite(cfg.cornerRadius) ? cfg.cornerRadius : 12)
    .style('display', shape === 'rect' ? null : 'none')

  const geoSel = itemSel
    .append('path')
    .attr('data-kg-shape', 'group-geo')
    .attr('stroke-linejoin', 'round')
    .attr('stroke-linecap', 'round')
    .style('display', shape === 'geo' ? null : 'none')

  const labelSel = itemSel
    .append('text')
    .attr('data-kg-shape', 'group-label')
    .style('user-select', 'none')
    .style('font-size', `${schema.labelStyles?.fontSize ?? 12}px`)

  const padding = typeof cfg.padding === 'number' && Number.isFinite(cfg.padding) ? Math.max(0, cfg.padding) : 24
  const labelPadding =
    typeof cfg.labelPadding === 'number' && Number.isFinite(cfg.labelPadding) ? Math.max(0, cfg.labelPadding) : 10
  const strokeWidth =
    typeof cfg.strokeWidth === 'number' && Number.isFinite(cfg.strokeWidth) ? Math.max(0, cfg.strokeWidth) : 1.5
  const fillOpacity =
    typeof cfg.fillOpacity === 'number' && Number.isFinite(cfg.fillOpacity) ? Math.max(0, Math.min(1, cfg.fillOpacity)) : 0.08
  const fontSize = schema.labelStyles?.fontSize ?? 12

  rectSel
    .attr('stroke-width', strokeWidth)
    .attr('stroke', d => d.style.stroke ?? MVP_COLOR_PALETTE.edges.neutral)
    .attr('fill', d => d.style.fill ?? MVP_COLOR_PALETTE.edges.neutral)
    .attr('fill-opacity', fillOpacity)

  geoSel
    .attr('stroke-width', strokeWidth)
    .attr('stroke', d => d.style.stroke ?? MVP_COLOR_PALETTE.edges.neutral)
    .attr('fill', d => d.style.fill ?? MVP_COLOR_PALETTE.edges.neutral)
    .attr('fill-opacity', fillOpacity)

  labelSel
    .attr('fill', schema.labelStyles?.color ?? '#111111')
    .text(d => d.label)

  const layoutCache = new Map<
    string,
    { x: number; y: number; w: number; h: number; labelX: number; labelY: number; d: string | null }
  >()
  const eps = 0.5

  const computeBoundsAndLabel = (d: GroupDatum) => {
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    let valid = 0
    const geoPoints: Point2d[] = []
    for (let i = 0; i < d.memberNodeIds.length; i += 1) {
      const id = d.memberNodeIds[i]
      const n = nodeById.get(id)
      if (!n) continue
      if (!isFiniteNumber(n.x) || !isFiniteNumber(n.y)) continue
      const { halfW, halfH } = getNodeHalfExtents2d(n, schema)
      const x0 = n.x - halfW
      const x1 = n.x + halfW
      const y0 = n.y - halfH
      const y1 = n.y + halfH
      if (x0 < minX) minX = x0
      if (x1 > maxX) maxX = x1
      if (y0 < minY) minY = y0
      if (y1 > maxY) maxY = y1
      const px = halfW + padding
      const py = halfH + padding
      geoPoints.push({ x: n.x - px, y: n.y - py })
      geoPoints.push({ x: n.x + px, y: n.y - py })
      geoPoints.push({ x: n.x + px, y: n.y + py })
      geoPoints.push({ x: n.x - px, y: n.y + py })
      valid += 1
    }
    if (valid === 0 || minX === Infinity) {
      return { x: 0, y: 0, w: 0, h: 0, labelX: 0, labelY: 0, d: null }
    }
    const topPad = padding + labelPadding + fontSize * 1.2
    const x = minX - padding
    const y = minY - topPad
    const w = Math.max(1, maxX - minX + padding * 2)
    const h = Math.max(1, maxY - minY + padding + topPad)
    const labelX = minX - padding + labelPadding
    const labelY = minY - padding - labelPadding

    if (shape === 'geo') {
      const gx0 = minX - padding
      const gx1 = maxX + padding
      const gy0 = minY - topPad
      const gy1 = maxY + padding
      geoPoints.push({ x: gx0, y: gy0 })
      geoPoints.push({ x: gx1, y: gy0 })
      geoPoints.push({ x: gx1, y: gy1 })
      geoPoints.push({ x: gx0, y: gy1 })
      const ring = computeConvexRing(geoPoints)
      const dPath = buildClosedPathD(ring)
      return { x, y, w, h, labelX, labelY, d: dPath }
    }
    return { x, y, w, h, labelX, labelY, d: null }
  }

  const update = () => {
    itemSel.each(function (d) {
      const computed = computeBoundsAndLabel(d)
      const prev = layoutCache.get(d.id) || null
      if (
        prev &&
        Math.abs(prev.x - computed.x) < eps &&
        Math.abs(prev.y - computed.y) < eps &&
        Math.abs(prev.w - computed.w) < eps &&
        Math.abs(prev.h - computed.h) < eps &&
        Math.abs(prev.labelX - computed.labelX) < eps &&
        Math.abs(prev.labelY - computed.labelY) < eps &&
        prev.d === computed.d
      ) {
        return
      }
      layoutCache.set(d.id, computed)

      const item = d3.select(this)
      if (shape === 'rect') {
        item
          .select<SVGRectElement>('rect[data-kg-shape="group-rect"]')
          .attr('x', computed.x)
          .attr('y', computed.y)
          .attr('width', computed.w)
          .attr('height', computed.h)
      } else {
        item.select<SVGPathElement>('path[data-kg-shape="group-geo"]').attr('d', computed.d || '')
      }
      item
        .select<SVGTextElement>('text[data-kg-shape="group-label"]')
        .attr('x', computed.labelX)
        .attr('y', computed.labelY)
    })
  }

  update()
  return { update }
}
