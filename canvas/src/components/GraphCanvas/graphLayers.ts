import * as d3 from 'd3'
import type { GraphData, GraphEdge, GraphNode, JSONValue } from '@/lib/graph/types'
import { getAgenticRagTagColor, getRendererPalette, MVP_COLOR_PALETTE, type GraphSchema } from '@/lib/graph/schema'
import type { HoverInfo } from '@/components/GraphHoverTooltip'
import { getRenderNodeRadius2d } from '@/components/GraphCanvas/helpers'

type GSelection = d3.Selection<SVGGElement, unknown, null, undefined>

export type NodeGroup = {
  id: string
  memberIds: string[]
  meta?: {
    groupBy: 'property' | 'type' | 'community'
    ownerId?: string
    ownerType?: string
    propertyKey?: string
    groupValue?: string
  }
}

export type GraphLayerGroupStyle = {
  fill: string
  fillOpacity: number
  stroke: string
  strokeWidth: number
  dash: string
}

export type GraphLayerHullGeometry = {
  path: string
  cx: number
  cy: number
} | null

type GraphLayerStyleConfig = {
  fill?: unknown
  fillColor?: unknown
  stroke?: unknown
  strokeColor?: unknown
  dash?: unknown
  dashArray?: unknown
  strokeDasharray?: unknown
  opacity?: unknown
  fillOpacity?: unknown
  strokeWidth?: unknown
}

const isRecord = (val: unknown): val is Record<string, unknown> =>
  !!val && typeof val === 'object' && !Array.isArray(val)

const applyStyleOverrides = (style: GraphLayerGroupStyle, config: GraphLayerStyleConfig): void => {
  const fill =
    typeof config.fill === 'string'
      ? config.fill
      : typeof config.fillColor === 'string'
        ? config.fillColor
        : null
  const stroke =
    typeof config.stroke === 'string'
      ? config.stroke
      : typeof config.strokeColor === 'string'
        ? config.strokeColor
        : null
  const dash =
    typeof config.dash === 'string'
      ? config.dash
      : typeof config.dashArray === 'string'
        ? config.dashArray
        : typeof config.strokeDasharray === 'string'
          ? config.strokeDasharray
          : null
  const opacity =
    typeof config.opacity === 'number'
      ? config.opacity
      : typeof config.fillOpacity === 'number'
        ? config.fillOpacity
        : null
  const strokeWidth = typeof config.strokeWidth === 'number' ? config.strokeWidth : null

  if (fill) style.fill = fill
  if (stroke) style.stroke = stroke
  if (dash) style.dash = dash
  if (opacity != null && Number.isFinite(opacity)) style.fillOpacity = opacity
  if (strokeWidth != null && Number.isFinite(strokeWidth)) style.strokeWidth = strokeWidth
}

export const buildNodeGroups = (graphData: GraphData): NodeGroup[] => {
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  if (!nodes.length) return []
  const nodeIdSet = new Set<string>()
  const normalizeId = (raw: unknown): string => {
    const s = String(raw ?? '')
    return s.startsWith('kg:') ? s.slice(3) : s
  }
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    nodeIdSet.add(String(n.id))
  }
  const groups: NodeGroup[] = []
  for (let i = 0; i < nodes.length; i += 1) {
    const owner = nodes[i]
    const props = owner && owner.properties ? owner.properties : {}
    const keys = Object.keys(props)
    if (!keys.length) continue
    for (let j = 0; j < keys.length; j += 1) {
      const key = keys[j]
      const value = props[key] as JSONValue
      if (!Array.isArray(value)) continue
      const memberIds: string[] = []
      for (let k = 0; k < value.length; k += 1) {
        const v = value[k] as JSONValue
        if (typeof v === 'string') {
          const id = normalizeId(v)
          if (nodeIdSet.has(id)) memberIds.push(id)
        } else if (v && typeof v === 'object') {
          const maybe = (v as { [key: string]: unknown })['@id']
          if (typeof maybe === 'string') {
            const id = normalizeId(maybe)
            if (nodeIdSet.has(id)) memberIds.push(id)
          }
        }
      }
      if (memberIds.length < 2) continue
      const deduped = Array.from(new Set(memberIds))
      if (deduped.length < 2) continue
      const groupId = String(owner.id) + '::' + key
      groups.push({
        id: groupId,
        memberIds: deduped,
        meta: { groupBy: 'property', ownerId: String(owner.id), ownerType: String(owner.type || ''), propertyKey: key },
      })
    }
  }
  return groups
}

const DOCUMENT_BLOCK_TYPES = new Set([
  'Document',
  'Section',
  'Paragraph',
  'CodeBlock',
  'Table',
  'List',
  'ListItem',
])

const buildNodeGroupsByCommunity = (graphData: GraphData, minGroupSize: number): NodeGroup[] => {
  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  if (!nodes.length) return []
  const byCommunity = new Map<string, string[]>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const props = (n.properties || {}) as Record<string, unknown>
    const raw = props['visual:community']
    const c =
      typeof raw === 'number'
        ? (Number.isFinite(raw) ? String(raw) : '')
        : (typeof raw === 'string' ? raw.trim() : '')
    if (!c) continue
    const arr = byCommunity.get(c) || []
    arr.push(String(n.id))
    byCommunity.set(c, arr)
  }
  const groups: NodeGroup[] = []
  byCommunity.forEach((memberIds, c) => {
    const deduped = Array.from(new Set(memberIds))
    if (deduped.length < Math.max(2, minGroupSize)) return
    groups.push({ id: `community::${c}`, memberIds: deduped, meta: { groupBy: 'community', groupValue: c } })
  })
  return groups
}

export const buildNodeGroupsFromSchema = (graphData: GraphData, schema: GraphSchema): NodeGroup[] => {
  const mode = schema.layers?.mode || 'property'
  if (mode === 'document-structure') {
    const groups = buildNodeGroups(graphData)
    if (!groups.length) return groups
    const filtered = groups.filter((g) => {
      const ownerType = g.meta?.ownerType ? String(g.meta.ownerType) : ''
      if (!ownerType) return true
      if (DOCUMENT_BLOCK_TYPES.has(ownerType)) return false
      return true
    })
    return filtered.length > 0 ? filtered : groups
  }
  if (mode === 'semantic') {
    const minGroupSizeRaw = schema.layers?.documentStructure?.minGroupSize
    const minGroupSize =
      typeof minGroupSizeRaw === 'number' && Number.isFinite(minGroupSizeRaw) ? Math.max(2, Math.floor(minGroupSizeRaw)) : 2
    return buildNodeGroupsByCommunity(graphData, minGroupSize)
  }
  return buildNodeGroups(graphData)
}

export const getGraphLayerStyleForGroup = (args: {
  group: NodeGroup
  graphData: GraphData
  schema: GraphSchema
}): GraphLayerGroupStyle => {
  const { group, graphData, schema } = args

  const palette = getRendererPalette(schema)
  const baseColor = typeof palette.nodes.idea === 'string' && palette.nodes.idea.trim()
    ? palette.nodes.idea
    : MVP_COLOR_PALETTE.nodes.idea

  const base: GraphLayerGroupStyle = {
    fill: baseColor,
    fillOpacity: 0.16,
    stroke: baseColor,
    strokeWidth: 1.25,
    dash: '4,2',
  }

  const nodes = Array.isArray(graphData.nodes) ? graphData.nodes : []
  const nodeById = new Map<string, GraphNode>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    nodeById.set(String(n.id), n)
  }

  const idParts = String(group.id || '').split('::')
  const ownerId = group.meta?.ownerId ?? (idParts[0] || '')
  const propKey = group.meta?.propertyKey ?? (idParts.length > 1 ? idParts[1] : '')
  const owner = ownerId ? nodeById.get(ownerId) || null : null
  const ownerType = group.meta?.ownerType ?? (owner ? String(owner.type || '') : '')

  const metadata = schema && schema.metadata && isRecord(schema.metadata) ? schema.metadata : null
  const hasGraphLayersMeta =
    metadata && Object.prototype.hasOwnProperty.call(metadata, 'canvas:graphLayers')
  const graphLayersMetaRaw = hasGraphLayersMeta
    ? (metadata['canvas:graphLayers'] as JSONValue | undefined)
    : undefined

  const style: GraphLayerGroupStyle = { ...base }

  if (group.meta?.groupBy === 'community') {
    const first = group.memberIds.length > 0 ? nodeById.get(String(group.memberIds[0])) : null
    const props = (first?.properties || {}) as Record<string, unknown>
    const fill = typeof props['visual:fill'] === 'string' ? String(props['visual:fill']).trim() : ''
    if (fill) {
      style.fill = fill
      style.stroke = fill
      style.fillOpacity = 0.12
      style.strokeWidth = 1.25
      style.dash = '3,2'
    }
  }

  if (graphLayersMetaRaw && isRecord(graphLayersMetaRaw)) {
    const meta = graphLayersMetaRaw

    const defaultStyleRaw = 'defaultStyle' in meta ? meta.defaultStyle : undefined
    if (defaultStyleRaw && isRecord(defaultStyleRaw)) {
      applyStyleOverrides(style, defaultStyleRaw as GraphLayerStyleConfig)
    }

    const byOwnerTypeRaw = 'byOwnerType' in meta ? meta.byOwnerType : undefined
    if (ownerType && byOwnerTypeRaw && isRecord(byOwnerTypeRaw)) {
      const ownerStyleRaw = byOwnerTypeRaw[ownerType] as unknown
      if (ownerStyleRaw && isRecord(ownerStyleRaw)) {
        applyStyleOverrides(style, ownerStyleRaw as GraphLayerStyleConfig)
      }
    }

    const byPropertyKeyRaw = 'byPropertyKey' in meta ? meta.byPropertyKey : undefined
    if (propKey && byPropertyKeyRaw && isRecord(byPropertyKeyRaw)) {
      const keyStyleRaw = byPropertyKeyRaw[propKey] as unknown
      if (keyStyleRaw && isRecord(keyStyleRaw)) {
        applyStyleOverrides(style, keyStyleRaw as GraphLayerStyleConfig)
      }
    }
  }

  if (!graphLayersMetaRaw) {
    if (group.meta?.groupBy !== 'community' && owner) {
      const tagColor = getAgenticRagTagColor(owner, schema)
      if (typeof tagColor === 'string' && tagColor.trim()) {
        style.fill = tagColor
        style.fillOpacity = 0.16
        style.stroke = tagColor
        style.strokeWidth = 1.5
      } else if (ownerType && schema.nodeStyles && schema.nodeStyles[ownerType] && schema.nodeStyles[ownerType]?.color) {
        const c = schema.nodeStyles[ownerType]?.color
        if (typeof c === 'string' && c.trim()) {
          style.fill = c
          style.fillOpacity = 0.12
          style.stroke = c
          style.strokeWidth = 1.5
        }
      }
    }
  }

  return style
}

export const computeGraphLayerHullGeometry = (args: {
  group: NodeGroup
  nodeById: Map<string, GraphNode>
  schema: GraphSchema
}): GraphLayerHullGeometry => {
  const { group, nodeById, schema } = args
  const ids = group.memberIds
  if (!ids || !ids.length) return null
  const points: [number, number][] = []
  for (let i = 0; i < ids.length; i += 1) {
    const id = ids[i]
    const node = nodeById.get(String(id))
    if (!node) continue
    const x = typeof node.x === 'number' ? node.x : null
    const y = typeof node.y === 'number' ? node.y : null
    if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) continue
    const r = getRenderNodeRadius2d(node, schema)
    const radius = Number.isFinite(r) && r > 0 ? r : 10
    const px1 = x + radius
    const py1 = y
    if (Number.isFinite(px1) && Number.isFinite(py1)) points.push([px1, py1])
    const px2 = x
    const py2 = y + radius
    if (Number.isFinite(px2) && Number.isFinite(py2)) points.push([px2, py2])
    const px3 = x - radius
    const py3 = y
    if (Number.isFinite(px3) && Number.isFinite(py3)) points.push([px3, py3])
    const px4 = x
    const py4 = y - radius
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
} => {
  const { g, nodeGroups, graphData, schema, graphLayersVisible, hoverEnabled, setHoverInfo, simulation } = args
  if (!nodeGroups.length || !graphLayersVisible) {
    return { hullSel: null, centroidSel: null }
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
          if (simulation && !event.active) {
            simulation.alphaTarget(0.3).restart()
          }
        })
        .on('drag', (event, group) => {
          const dx = typeof event.dx === 'number' && Number.isFinite(event.dx) ? event.dx : 0
          const dy = typeof event.dy === 'number' && Number.isFinite(event.dy) ? event.dy : 0
          if (dx === 0 && dy === 0) return
          applyGraphLayerCentroidDelta({ group, dx, dy, nodeById, hullSel, centroidSel, schema })
        })
        .on('end', (event) => {
          if (!simulation) return
          if (!event.active) {
            simulation.alphaTarget(0)
          }
          if (schema.layout?.mode === 'radial' || schema.layout?.mode === 'tidy-tree') {
            simulation.stop()
          }
        }),
    )

  return { hullSel, centroidSel }
}
