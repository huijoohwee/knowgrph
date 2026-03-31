import type { GraphNode } from '@/lib/graph/types'

const KNOWN_LAYER_ORDER = ['product', 'solution', 'market']

export type VoxelLayer = {
  key: string
  order: number
}

const parseFiniteNumber = (v: unknown): number | null => {
  if (typeof v !== 'number') return null
  if (!Number.isFinite(v)) return null
  return v
}

export const resolveVoxelLayerKey = (node: GraphNode): string => {
  const props = (node.properties || {}) as Record<string, unknown>
  const visualLayerRaw = props['visual:layer']
  const raw = String(
    (typeof visualLayerRaw === 'string' ? visualLayerRaw : '')
    || props['kg:layer']
    || props['layer']
    || props['layerId']
    || props['layer_id']
    || '',
  ).trim()
  if (raw) return raw.toLowerCase()
  return 'layer'
}

export const resolveVoxelLayerOrderHint = (node: GraphNode): number | null => {
  const props = (node.properties || {}) as Record<string, unknown>
  const n =
    parseFiniteNumber(props['visual:layerLevel']) ??
    parseFiniteNumber(props['layerLevel']) ??
    parseFiniteNumber(props['layer_level']) ??
    parseFiniteNumber(props['level']) ??
    parseFiniteNumber(props['layerIndex']) ??
    parseFiniteNumber(props['layer_index'])
  if (n != null) return n
  const key = resolveVoxelLayerKey(node)
  const idx = KNOWN_LAYER_ORDER.indexOf(key)
  return idx >= 0 ? idx : null
}

export const listVoxelLayers = (nodes: GraphNode[]): VoxelLayer[] => {
  const byKey = new Map<string, { minOrder: number | null }>()
  for (let i = 0; i < nodes.length; i += 1) {
    const n = nodes[i]
    const key = resolveVoxelLayerKey(n)
    const hint = resolveVoxelLayerOrderHint(n)
    const prev = byKey.get(key)
    if (!prev) {
      byKey.set(key, { minOrder: hint })
      continue
    }
    if (hint == null) continue
    if (prev.minOrder == null || hint < prev.minOrder) prev.minOrder = hint
  }

  const entries = Array.from(byKey.entries()).map(([key, v]) => ({ key, minOrder: v.minOrder }))
  const hasAnyNumeric = entries.some(e => typeof e.minOrder === 'number' && Number.isFinite(e.minOrder))
  entries.sort((a, b) => {
    if (hasAnyNumeric) {
      const ao = typeof a.minOrder === 'number' && Number.isFinite(a.minOrder) ? a.minOrder : Infinity
      const bo = typeof b.minOrder === 'number' && Number.isFinite(b.minOrder) ? b.minOrder : Infinity
      if (ao !== bo) return ao - bo
    }
    const ka = a.key
    const kb = b.key
    const ia = KNOWN_LAYER_ORDER.indexOf(ka)
    const ib = KNOWN_LAYER_ORDER.indexOf(kb)
    if (ia >= 0 || ib >= 0) {
      const oa = ia >= 0 ? ia : KNOWN_LAYER_ORDER.length + 100
      const ob = ib >= 0 ? ib : KNOWN_LAYER_ORDER.length + 100
      if (oa !== ob) return oa - ob
    }
    return ka.localeCompare(kb)
  })

  const out: VoxelLayer[] = []
  for (let i = 0; i < entries.length; i += 1) {
    out.push({ key: entries[i]!.key, order: i })
  }
  return out
}
