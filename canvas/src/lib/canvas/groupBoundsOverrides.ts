import type { GraphSchema } from '@/lib/graph/schema'
import type { GraphNode } from '@/lib/graph/types'
import type { GraphGroup } from '@/components/GraphCanvas/layout/graphGroupsTypes'
import { SCHEMA_META_KEY_GROUP_BOUNDS_OVERRIDES } from '@/lib/config.render'

export type GroupBoundsOverride = {
  x: number
  y: number
  width: number
  height: number
  labelX?: number
  labelY?: number
}

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)

export const readSchemaGroupBoundsOverrides = (schema: GraphSchema): Record<string, GroupBoundsOverride> => {
  const metaRaw = (schema as unknown as { metadata?: unknown })?.metadata
  if (!isRecord(metaRaw)) return {}
  const raw = metaRaw[SCHEMA_META_KEY_GROUP_BOUNDS_OVERRIDES]
  if (!isRecord(raw)) return {}
  const out: Record<string, GroupBoundsOverride> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (!k) continue
    if (!isRecord(v)) continue
    const x = typeof v.x === 'number' && Number.isFinite(v.x) ? v.x : Number.NaN
    const y = typeof v.y === 'number' && Number.isFinite(v.y) ? v.y : Number.NaN
    const width = typeof v.width === 'number' && Number.isFinite(v.width) ? v.width : Number.NaN
    const height = typeof v.height === 'number' && Number.isFinite(v.height) ? v.height : Number.NaN
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) continue
    const labelX = typeof v.labelX === 'number' && Number.isFinite(v.labelX) ? v.labelX : undefined
    const labelY = typeof v.labelY === 'number' && Number.isFinite(v.labelY) ? v.labelY : undefined
    out[k] = { x, y, width, height, ...(labelX != null ? { labelX } : {}), ...(labelY != null ? { labelY } : {}) }
  }
  return out
}

export const applySchemaGroupBoundsOverrides = (groups: GraphGroup[], overridesById: Record<string, GroupBoundsOverride>): GraphGroup[] => {
  if (!groups.length) return groups
  const keys = Object.keys(overridesById)
  if (keys.length === 0) return groups
  return groups.map(g => {
    const id = String(g.id || '').trim()
    if (!id) return g
    if (g.bounds) return g
    const b = overridesById[id]
    if (!b) return g
    return { ...g, bounds: b }
  })
}

export const readNodeBoundsOverride = (node: GraphNode | null | undefined): GroupBoundsOverride | null => {
  const props = ((node as unknown as { properties?: unknown })?.properties || {}) as Record<string, unknown>
  const raw = props['visual:boundsOverride']
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const x = typeof (raw as any).x === 'number' ? (raw as any).x : Number.NaN
  const y = typeof (raw as any).y === 'number' ? (raw as any).y : Number.NaN
  const width = typeof (raw as any).width === 'number' ? (raw as any).width : Number.NaN
  const height = typeof (raw as any).height === 'number' ? (raw as any).height : Number.NaN
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null
  const labelX = typeof (raw as any).labelX === 'number' && Number.isFinite((raw as any).labelX) ? (raw as any).labelX : undefined
  const labelY = typeof (raw as any).labelY === 'number' && Number.isFinite((raw as any).labelY) ? (raw as any).labelY : undefined
  return { x, y, width, height, ...(labelX != null ? { labelX } : {}), ...(labelY != null ? { labelY } : {}) }
}

export const withSchemaGroupBoundsOverride = (schema: GraphSchema, groupId: string, bounds: GroupBoundsOverride): GraphSchema => {
  const id = String(groupId || '').trim()
  if (!id) return schema
  if (!Number.isFinite(bounds.x) || !Number.isFinite(bounds.y) || !Number.isFinite(bounds.width) || !Number.isFinite(bounds.height)) return schema
  if (bounds.width <= 0 || bounds.height <= 0) return schema

  const metaRaw = (schema as unknown as { metadata?: unknown }).metadata
  const baseMeta = isRecord(metaRaw) ? metaRaw : {}
  const currentRaw = baseMeta[SCHEMA_META_KEY_GROUP_BOUNDS_OVERRIDES]
  const current = isRecord(currentRaw) ? (currentRaw as Record<string, unknown>) : {}
  const next = { ...current, [id]: { ...bounds } }
  return { ...schema, metadata: { ...(baseMeta as Record<string, any>), [SCHEMA_META_KEY_GROUP_BOUNDS_OVERRIDES]: next } as any }
}

export const withoutSchemaGroupBoundsOverride = (schema: GraphSchema, groupId: string): GraphSchema => {
  const id = String(groupId || '').trim()
  if (!id) return schema
  const metaRaw = (schema as unknown as { metadata?: unknown }).metadata
  const baseMeta = isRecord(metaRaw) ? metaRaw : {}
  const currentRaw = baseMeta[SCHEMA_META_KEY_GROUP_BOUNDS_OVERRIDES]
  const current = isRecord(currentRaw) ? (currentRaw as Record<string, unknown>) : null
  if (!current || !(id in current)) return schema
  const next = { ...current }
  delete (next as Record<string, unknown>)[id]
  return { ...schema, metadata: { ...(baseMeta as Record<string, any>), [SCHEMA_META_KEY_GROUP_BOUNDS_OVERRIDES]: next } as any }
}

export const readGroupBoundsOverrideSource = (args: {
  groupId: string
  graphNodes: ReadonlyArray<GraphNode>
  schema: GraphSchema
}): { source: 'node' | 'schema' | null; bounds: GroupBoundsOverride | null } => {
  const id = String(args.groupId || '').trim()
  if (!id) return { source: null, bounds: null }

  const findNode = (nodeId: string): GraphNode | null => {
    for (let i = 0; i < args.graphNodes.length; i += 1) {
      const n = args.graphNodes[i]
      if (String(n.id || '') === nodeId) return n
    }
    return null
  }

  const node = findNode(id) || (id.startsWith('md:') ? findNode(id.slice('md:'.length).trim()) : null)
  const nodeBounds = node ? readNodeBoundsOverride(node) : null
  if (nodeBounds) return { source: 'node', bounds: nodeBounds }

  const schemaBounds = readSchemaGroupBoundsOverrides(args.schema)[id] || null
  if (schemaBounds) return { source: 'schema', bounds: schemaBounds }
  return { source: null, bounds: null }
}

