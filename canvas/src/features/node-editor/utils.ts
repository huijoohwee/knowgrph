import { GraphNode, GraphEdge, JSONValue } from '@/lib/graph/types'

export function computeNeighborEdges(data: { edges: GraphEdge[] } | null | undefined, selectedNodeId: string | null | undefined): GraphEdge[] {
  if (!data || !selectedNodeId) return []
  return (data.edges || []).filter(e => {
    const src = typeof e.source === 'string' ? e.source : (e as unknown as { source?: { id?: string } }).source?.id
    const tgt = typeof e.target === 'string' ? e.target : (e as unknown as { target?: { id?: string } }).target?.id
    return src === selectedNodeId || tgt === selectedNodeId
  })
}

export function computeNeighborNodes(data: { nodes: GraphNode[] } | null | undefined, selectedNodeId: string | null | undefined, neighborEdges: GraphEdge[]): GraphNode[] {
  if (!data || !selectedNodeId) return []
  const ids = new Set<string>()
  neighborEdges.forEach(e => {
    const src = typeof e.source === 'string' ? e.source : (e as unknown as { source?: { id?: string } }).source?.id
    const tgt = typeof e.target === 'string' ? e.target : (e as unknown as { target?: { id?: string } }).target?.id
    const other = src === selectedNodeId ? tgt : src
    if (other) ids.add(other)
  })
  return (data.nodes || []).filter(n => ids.has(n.id))
}

type NodeFieldValue = JSONValue | number | Record<string, JSONValue>

export function formatNodeFields(node: GraphNode | null, neighborEdges: GraphEdge[]): Array<{ key: string; value: NodeFieldValue }> {
  if (!node) return []
  const props = node.properties || {}
  const name = node.label || (props.name as string | undefined) || ''
  const typeVal = node.type || (props.type as string | undefined) || ''
  const descriptionVal = props.description as JSONValue | undefined
  const imageVal = props.image as JSONValue | undefined
  const videoVal = props.video as JSONValue | undefined
  const referenceVal = props.reference as JSONValue | undefined
  const remaining: Record<string, JSONValue> = { ...props }
  delete remaining.name
  delete remaining.type
  delete remaining.description
  delete remaining.image
  delete remaining.video
  delete remaining.reference
  const rows: Array<{ key: string; value: NodeFieldValue }> = []
  rows.push({ key: 'name', value: name })
  rows.push({ key: 'type', value: typeVal })
  if (descriptionVal !== undefined) rows.push({ key: 'description', value: descriptionVal })
  if (imageVal !== undefined) rows.push({ key: 'image', value: imageVal })
  if (videoVal !== undefined) rows.push({ key: 'video', value: videoVal })
  if (referenceVal !== undefined) rows.push({ key: 'reference', value: referenceVal })
  rows.push({ key: 'degree', value: neighborEdges.length })
  if (Object.keys(remaining).length > 0) rows.push({ key: 'properties', value: remaining })
  return rows
}

export function extractMediaFromProperties(node: GraphNode | null): { images: string[]; videos: string[] } {
  const imgs: string[] = []
  const vids: string[] = []
  if (node) {
    const p = node.properties || {}
    const tryAdd = (val: unknown) => {
      if (typeof val === 'string') {
        if (/^https?:\/\//.test(val)) {
          if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(val)) imgs.push(val)
          if (/\.(mp4|webm|ogg)$/i.test(val)) vids.push(val)
        }
      } else if (Array.isArray(val)) {
        val.forEach(tryAdd)
      }
    }
    tryAdd(p.image as JSONValue)
    tryAdd(p.images as JSONValue)
    tryAdd(p.video as JSONValue)
    tryAdd(p.videos as JSONValue)
    tryAdd(p.media as JSONValue)
  }
  return { images: imgs, videos: vids }
}

export const isHttpUrl = (value: unknown): value is string =>
  typeof value === 'string' && /^https?:\/\//.test(value)

export const getEndpointId = (edge: GraphEdge, key: 'source' | 'target'): string => {
  const value = (edge as unknown as { source?: unknown; target?: unknown })[key]
  if (typeof value === 'string') return value
  if (value && typeof (value as { id?: unknown }).id === 'string') {
    return String((value as { id: string }).id)
  }
  return ''
}
