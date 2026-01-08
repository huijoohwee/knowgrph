import * as d3 from 'd3'
import type { GraphData, GraphNode, JSONValue } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'

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

export type PolygonGroupStyle = {
  fill: string
  fillOpacity: number
  stroke: string
  strokeWidth: number
  dash: string
}

const isRecord = (val: unknown): val is Record<string, unknown> =>
  !!val && typeof val === 'object' && !Array.isArray(val)

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

export const getPolygonStyleForGroup = (args: {
  group: NodeGroup
  graphData: GraphData
  schema: GraphSchema
}): PolygonGroupStyle => {
  const { group, graphData, schema } = args

  const base: PolygonGroupStyle = {
    fill: '#E5E7EB',
    fillOpacity: 0.22,
    stroke: '#9CA3AF',
    strokeWidth: 1,
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
  const polygonMetaRaw = metadata && Object.prototype.hasOwnProperty.call(metadata, 'canvas:polygons')
    ? (metadata['canvas:polygons'] as JSONValue | undefined)
    : undefined

  const style: PolygonGroupStyle = { ...base }

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

  if (polygonMetaRaw && isRecord(polygonMetaRaw)) {
    const meta = polygonMetaRaw

    const defaultStyleRaw = 'defaultStyle' in meta ? meta.defaultStyle : undefined
    if (defaultStyleRaw && isRecord(defaultStyleRaw)) {
      const m = defaultStyleRaw
      const fill = typeof m.fill === 'string' ? m.fill : typeof m.fillColor === 'string' ? m.fillColor : null
      const stroke = typeof m.stroke === 'string' ? m.stroke : typeof m.strokeColor === 'string' ? m.strokeColor : null
      const dash =
        typeof m.dash === 'string'
          ? m.dash
          : typeof m.dashArray === 'string'
            ? m.dashArray
            : typeof m.strokeDasharray === 'string'
              ? m.strokeDasharray
              : null
      const opacity =
        typeof m.opacity === 'number'
          ? m.opacity
          : typeof m.fillOpacity === 'number'
            ? m.fillOpacity
            : null
      const strokeWidth = typeof m.strokeWidth === 'number' ? m.strokeWidth : null

      if (fill) style.fill = fill
      if (stroke) style.stroke = stroke
      if (dash) style.dash = dash
      if (opacity != null && Number.isFinite(opacity)) style.fillOpacity = opacity
      if (strokeWidth != null && Number.isFinite(strokeWidth)) style.strokeWidth = strokeWidth
    }

    const byOwnerTypeRaw = 'byOwnerType' in meta ? meta.byOwnerType : undefined
    if (ownerType && byOwnerTypeRaw && isRecord(byOwnerTypeRaw)) {
      const ownerStyleRaw = byOwnerTypeRaw[ownerType] as unknown
      if (ownerStyleRaw && isRecord(ownerStyleRaw)) {
        const m = ownerStyleRaw
        const fill = typeof m.fill === 'string' ? m.fill : typeof m.fillColor === 'string' ? m.fillColor : null
        const stroke = typeof m.stroke === 'string' ? m.stroke : typeof m.strokeColor === 'string' ? m.strokeColor : null
        const dash =
          typeof m.dash === 'string'
            ? m.dash
            : typeof m.dashArray === 'string'
              ? m.dashArray
              : typeof m.strokeDasharray === 'string'
                ? m.strokeDasharray
                : null
        const opacity =
          typeof m.opacity === 'number'
            ? m.opacity
            : typeof m.fillOpacity === 'number'
              ? m.fillOpacity
              : null
        const strokeWidth = typeof m.strokeWidth === 'number' ? m.strokeWidth : null

        if (fill) style.fill = fill
        if (stroke) style.stroke = stroke
        if (dash) style.dash = dash
        if (opacity != null && Number.isFinite(opacity)) style.fillOpacity = opacity
        if (strokeWidth != null && Number.isFinite(strokeWidth)) style.strokeWidth = strokeWidth
      }
    }

    const byPropertyKeyRaw = 'byPropertyKey' in meta ? meta.byPropertyKey : undefined
    if (propKey && byPropertyKeyRaw && isRecord(byPropertyKeyRaw)) {
      const keyStyleRaw = byPropertyKeyRaw[propKey] as unknown
      if (keyStyleRaw && isRecord(keyStyleRaw)) {
        const m = keyStyleRaw
        const fill = typeof m.fill === 'string' ? m.fill : typeof m.fillColor === 'string' ? m.fillColor : null
        const stroke = typeof m.stroke === 'string' ? m.stroke : typeof m.strokeColor === 'string' ? m.strokeColor : null
        const dash =
          typeof m.dash === 'string'
            ? m.dash
            : typeof m.dashArray === 'string'
              ? m.dashArray
              : typeof m.strokeDasharray === 'string'
                ? m.strokeDasharray
                : null
        const opacity =
          typeof m.opacity === 'number'
            ? m.opacity
            : typeof m.fillOpacity === 'number'
              ? m.fillOpacity
              : null
        const strokeWidth = typeof m.strokeWidth === 'number' ? m.strokeWidth : null

        if (fill) style.fill = fill
        if (stroke) style.stroke = stroke
        if (dash) style.dash = dash
        if (opacity != null && Number.isFinite(opacity)) style.fillOpacity = opacity
        if (strokeWidth != null && Number.isFinite(strokeWidth)) style.strokeWidth = strokeWidth
      }
    }
  }

  if (!polygonMetaRaw) {
    if (ownerType && schema.nodeStyles && schema.nodeStyles[ownerType] && schema.nodeStyles[ownerType]?.color) {
      const c = schema.nodeStyles[ownerType]?.color
      if (typeof c === 'string' && c.trim()) {
        style.fill = c
        style.fillOpacity = 0.12
        style.stroke = c
        style.strokeWidth = 1.5
      }
    }
  }

  return style
}

export const createPolygonsLayer = (args: {
  g: GSelection
  nodeGroups: NodeGroup[]
  graphData: GraphData
  schema: GraphSchema
  polygonsVisible: boolean
}) => {
  const { g, nodeGroups, graphData, schema, polygonsVisible } = args
  if (!nodeGroups.length || !polygonsVisible) {
    return null
  }
  const layerRoot = g.append('g').attr('data-kg-layer', 'node-groups')
  const layer = layerRoot
    .selectAll<SVGPathElement, NodeGroup>('path')
    .data(nodeGroups, d => d.id)
    .enter()
    .append('path')
    .attr('fill', group => getPolygonStyleForGroup({ group, graphData, schema }).fill)
    .attr('fill-opacity', group => getPolygonStyleForGroup({ group, graphData, schema }).fillOpacity)
    .attr('stroke', group => getPolygonStyleForGroup({ group, graphData, schema }).stroke)
    .attr('stroke-width', group => getPolygonStyleForGroup({ group, graphData, schema }).strokeWidth)
    .attr('stroke-dasharray', group => getPolygonStyleForGroup({ group, graphData, schema }).dash)
    .style('pointer-events', 'none')
  return layer as d3.Selection<SVGPathElement, NodeGroup, SVGGElement, unknown> | null
}
