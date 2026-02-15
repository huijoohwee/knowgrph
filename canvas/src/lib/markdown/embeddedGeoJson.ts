import { extractFencedCodeBlocks } from './extractFencedCodeBlocks'
import { parseGeoJsonFromText } from 'gympgrph'

export type EmbeddedGeoJsonBlock = {
  geojsonText: string
  startLine: number
  endLine: number
}

export function extractEmbeddedGeoJsonFeatureCollections(markdownText: string): EmbeddedGeoJsonBlock[] {
  const blocks = extractFencedCodeBlocks(markdownText)
  const out: EmbeddedGeoJsonBlock[] = []

  for (const b of blocks) {
    const lang = b.lang
    if (lang !== 'geojson' && lang !== 'json') continue
    const trimmed = String(b.content || '').trim()
    if (!trimmed) continue

    if (lang === 'json') {
      const lc = trimmed.toLowerCase()
      if (!lc.includes('"type"')) continue
      if (!lc.includes('featurecollection') && !lc.includes('"feature"')) continue
    }

    try {
      const fc = parseGeoJsonFromText(trimmed)
      if (!fc) continue
      out.push({ geojsonText: JSON.stringify(fc), startLine: b.startLine, endLine: b.endLine })
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
