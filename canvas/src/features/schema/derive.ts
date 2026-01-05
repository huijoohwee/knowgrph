import type { GraphData } from '@/lib/graph/types'
import type { GraphSchema } from '@/lib/graph/schema'
import { useGraphStore } from '@/hooks/useGraphStore'

const NULL_REF: Record<string, never> = {}
type DataKey = GraphData | typeof NULL_REF
const nodeCache = new WeakMap<GraphSchema, Map<DataKey, { dataLen: number; catLen: number; result: string[] }>>()
const edgeCache = new WeakMap<GraphSchema, Map<DataKey, { dataLen: number; catLen: number; result: string[] }>>()
const BASE_LRU_CAPACITY = (() => {
  try {
    return Math.max(1, Number(useGraphStore.getState().schemaDeriveCacheCapacity || 16))
  } catch {
    return 16
  }
})()

const capacityFor = (len: number): number => {
  if (len < 1000) return 16
  if (len < 10000) return 24
  return 32
}

const evictLRU = (map: Map<DataKey, unknown>, limit: number) => {
  while (map.size > limit) {
    const iter = map.keys().next()
    if (iter.done) return
    const oldest = iter.value
    map.delete(oldest)
  }
}

export const uniqueNodeTypes = (data: GraphData | null, schema: GraphSchema): string[] => {
  const arr = data && Array.isArray(data.nodes) ? data.nodes : []
  const fromCatalog = schema.catalog && Array.isArray(schema.catalog.nodeTypes) ? schema.catalog.nodeTypes : []
  const dataKey = data ?? NULL_REF
  let schemaMap = nodeCache.get(schema)
  if (!schemaMap) {
    schemaMap = new Map()
    nodeCache.set(schema, schemaMap)
  }
  const cached = schemaMap.get(dataKey)
  if (cached && cached.dataLen === arr.length && cached.catLen === fromCatalog.length) {
    return cached.result
  }
  const types = new Set<string>()
  for (const n of arr) types.add(String(n.type || ''))
  const combined = new Set<string>([...fromCatalog, ...Array.from(types).filter(Boolean)])
  const result = Array.from(combined)
  schemaMap.set(dataKey, { dataLen: arr.length, catLen: fromCatalog.length, result })
  evictLRU(schemaMap, Math.max(BASE_LRU_CAPACITY, capacityFor(arr.length)))
  return result
}

export const uniqueEdgeLabels = (data: GraphData | null, schema: GraphSchema): string[] => {
  const arr = data && Array.isArray(data.edges) ? data.edges : []
  const fromCatalog = schema.catalog && Array.isArray(schema.catalog.edgeLabels) ? schema.catalog.edgeLabels : []
  const dataKey = data ?? NULL_REF
  let schemaMap = edgeCache.get(schema)
  if (!schemaMap) {
    schemaMap = new Map()
    edgeCache.set(schema, schemaMap)
  }
  const cached = schemaMap.get(dataKey)
  if (cached && cached.dataLen === arr.length && cached.catLen === fromCatalog.length) {
    return cached.result
  }
  const labels = new Set<string>()
  for (const e of arr) labels.add(String(e.label || ''))
  const combined = new Set<string>([...fromCatalog, ...Array.from(labels).filter(Boolean)])
  const result = Array.from(combined)
  schemaMap.set(dataKey, { dataLen: arr.length, catLen: fromCatalog.length, result })
  evictLRU(schemaMap, Math.max(BASE_LRU_CAPACITY, capacityFor(arr.length)))
  return result
}
