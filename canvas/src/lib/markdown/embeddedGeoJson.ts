import { extractFencedCodeBlocks } from './extractFencedCodeBlocks'

export type EmbeddedGeoJsonBlock = {
  geojsonText: string
  startLine: number
  endLine: number
}

function isFeatureCollection(value: unknown): value is { type: 'FeatureCollection'; features: unknown[] } {
  if (!value || typeof value !== 'object') return false
  const v = value as { type?: unknown; features?: unknown }
  if (v.type !== 'FeatureCollection') return false
  return Array.isArray(v.features)
}

export function extractEmbeddedGeoJsonFeatureCollections(markdownText: string): EmbeddedGeoJsonBlock[] {
  const blocks = extractFencedCodeBlocks(markdownText)
  const out: EmbeddedGeoJsonBlock[] = []

  for (const b of blocks) {
    const lang = b.lang
    if (lang !== 'geojson' && lang !== 'json') continue
    const trimmed = String(b.content || '').trim()
    if (!trimmed) continue

    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (!isFeatureCollection(parsed)) continue
      out.push({ geojsonText: trimmed, startLine: b.startLine, endLine: b.endLine })
    } catch {
      continue
    }
  }

  return out
}

export function buildEmbeddedGeoJsonUploadName(sourceName: string, index: number): string {
  const base = String(sourceName || 'document').trim() || 'document'
  const stem = base.replace(/\.(md|markdown)$/i, '')
  const n = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0
  return `${stem}-embedded-geojson-${n + 1}.geojson`
}

