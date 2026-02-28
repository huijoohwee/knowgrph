import type { GraphData } from '@/lib/graph/types'

const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value)

const isLikelyMediaAssetUrl = (value: string): boolean => {
  const v = String(value || '').trim()
  if (!v) return false
  if (!isHttpUrl(v)) return false
  return /\.(png|jpe?g|gif|webp|svg|mp4|webm|mov|mp3|wav|m4a|aac|flac|ogg)(\?|#|$)/i.test(v)
}

export function tryExtractDesignDocumentUrl(graphData: GraphData | null): string | null {
  const meta =
    graphData?.metadata && typeof graphData.metadata === 'object' && !Array.isArray(graphData.metadata)
      ? (graphData.metadata as Record<string, unknown>)
      : null
  const pick = (v: unknown): string => (typeof v === 'string' ? v.trim() : '')
  const direct = pick(meta?.documentUrl)
  if (direct && isHttpUrl(direct) && !isLikelyMediaAssetUrl(direct)) return direct
  const layers = meta?.sourceLayers
  if (!Array.isArray(layers)) return null
  for (let i = 0; i < layers.length; i += 1) {
    const layer = layers[i] as Record<string, unknown> | null
    const src = layer?.source as Record<string, unknown> | null
    if (!src || src.kind !== 'url') continue
    const u = pick(src.url)
    if (u && isHttpUrl(u) && !isLikelyMediaAssetUrl(u)) return u
  }
  return null
}
