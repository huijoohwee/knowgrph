import type { GraphData, GraphNode, GraphEdge, JSONValue } from './types'

export const isGraphRagBundle = (json: unknown): boolean => {
  try {
    const obj = (json && typeof json === 'object') ? (json as Record<string, unknown>) : {}
    const hasEntities = Array.isArray(obj.entities)
    const hasRelationships = Array.isArray(obj.relationships)
    const hasChunks = Array.isArray(obj.chunks) || Array.isArray(obj.documents)
    return hasEntities || hasRelationships || hasChunks
  } catch {
    return false
  }
}

export const parseGraphRagBundle = (json: unknown): GraphData => {
  const nodes: GraphNode[] = []
  const edges: GraphEdge[] = []
  const obj = (json && typeof json === 'object') ? (json as Record<string, unknown>) : {}
  const entities = Array.isArray(obj.entities) ? obj.entities as Array<Record<string, unknown>> : []
  const relationships = Array.isArray(obj.relationships) ? obj.relationships as Array<Record<string, unknown>> : []
  const chunks = Array.isArray(obj.chunks) ? obj.chunks as Array<Record<string, unknown>> : (Array.isArray(obj.documents) ? obj.documents as Array<Record<string, unknown>> : [])
  for (const e of entities) {
    const id = String((e as Record<string, unknown>)?.id ?? (e as Record<string, unknown>)?.name ?? `entity-${nodes.length}`)
    const label = String((e as Record<string, unknown>)?.name ?? id)
    const type = String((e as Record<string, unknown>)?.type ?? 'Entity')
    const properties = typeof (e as Record<string, unknown>)?.properties === 'object' ? (e as Record<string, unknown>).properties as Record<string, JSONValue> : {}
    nodes.push({ id, label, type, properties })
  }
  for (const c of chunks) {
    const id = String((c as Record<string, unknown>)?.id ?? `chunk-${nodes.length}`)
    const label = String((c as Record<string, unknown>)?.label ?? (c as Record<string, unknown>)?.title ?? `Chunk ${id}`)
    const properties = typeof c === 'object' ? c as Record<string, JSONValue> : { value: c as JSONValue }
    nodes.push({ id, label, type: 'Chunk', properties })
  }
  for (const r of relationships) {
    const source = String((r as Record<string, unknown>)?.source ?? (r as Record<string, unknown>)?.from ?? '')
    const target = String((r as Record<string, unknown>)?.target ?? (r as Record<string, unknown>)?.to ?? '')
    if (!source || !target) continue
    const id = String((r as Record<string, unknown>)?.id ?? `${source}-${target}-${edges.length}`)
    const label = String((r as Record<string, unknown>)?.label ?? (r as Record<string, unknown>)?.type ?? 'relatedTo')
    const properties = typeof (r as Record<string, unknown>)?.properties === 'object' ? (r as Record<string, unknown>).properties as Record<string, JSONValue> : {}
    edges.push({ id, source, target, label, properties })
  }
  return { context: 'graphrag', type: 'Graph', nodes, edges }
}
