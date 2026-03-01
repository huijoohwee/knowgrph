import type { GraphData } from '@/lib/graph/types'

const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value)

const isLikelyMediaAssetUrl = (value: string): boolean => {
  const v = String(value || '').trim()
  if (!v) return false
  if (!isHttpUrl(v)) return false
  return /\.(png|jpe?g|gif|webp|svg|mp4|webm|mov|mp3|wav|m4a|aac|flac|ogg)(\?|#|$)/i.test(v)
}

export function tryExtractDesignDocumentUrl(graphData: GraphData | null): string | null {
  const accept = (raw: unknown): string | null => {
    const u = typeof raw === 'string' ? raw.trim() : ''
    if (!u) return null
    if (!isHttpUrl(u)) return null
    if (isLikelyMediaAssetUrl(u)) return null
    return u
  }
  const acceptFromMeta = (m: unknown): string | null => {
    if (!m || typeof m !== 'object' || Array.isArray(m)) return null
    const mm = m as Record<string, unknown>
    return accept(mm.documentUrl) || accept(mm.documentPath) || null
  }
  const meta =
    graphData?.metadata && typeof graphData.metadata === 'object' && !Array.isArray(graphData.metadata)
      ? (graphData.metadata as Record<string, unknown>)
      : null
  const direct = accept(meta?.documentUrl)
  if (direct) return direct
  const layers = meta?.sourceLayers
  if (Array.isArray(layers)) {
    for (let i = 0; i < layers.length; i += 1) {
      const layer = layers[i] as Record<string, unknown> | null
      const src = layer?.source as Record<string, unknown> | null
      if (!src || src.kind !== 'url') continue
      const u = accept(src.url)
      if (u) return u
    }
  }

  const nodes = Array.isArray(graphData?.nodes) ? (graphData!.nodes as unknown as Array<Record<string, unknown>>) : []
  for (let i = 0; i < Math.min(120, nodes.length); i += 1) {
    const n = nodes[i]
    if (!n || typeof n !== 'object') continue
    const u = acceptFromMeta((n as { metadata?: unknown }).metadata)
    if (u) return u
  }

  const edges = Array.isArray(graphData?.edges) ? (graphData!.edges as unknown as Array<Record<string, unknown>>) : []
  for (let i = 0; i < Math.min(180, edges.length); i += 1) {
    const e = edges[i]
    if (!e || typeof e !== 'object') continue
    const u = acceptFromMeta((e as { metadata?: unknown }).metadata)
    if (u) return u
  }

  return null
}
