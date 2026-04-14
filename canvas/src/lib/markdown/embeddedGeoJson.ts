import { extractFencedCodeBlocks } from './extractFencedCodeBlocks'
import { parseGeoJsonFeatureCollectionFromText } from '@/features/geospatial/geojsonParseCache'
import { hashText } from '@/features/parsers/hash'
import { LRUCache } from '@/lib/cache/LRUCache'

export type EmbeddedGeoJsonBlock = {
  geojsonText: string
  startLine: number
  endLine: number
}

export type EmbeddedGeoJsonGraphDataRequest = {
  sourceDocumentPath: string
  codeBlock: {
    lang: 'geojson'
    text: string
    startLine: number
    endLine: number
  }
}

const embeddedGeoExtractionCache = new LRUCache<string, EmbeddedGeoJsonBlock[]>(120, 20 * 60 * 1000)

const cloneBlocks = (blocks: EmbeddedGeoJsonBlock[]): EmbeddedGeoJsonBlock[] => blocks.map(b => ({ ...b }))

export function extractEmbeddedGeoJsonFeatureCollections(markdownText: string): EmbeddedGeoJsonBlock[] {
  const normalizedMarkdown = String(markdownText || '')
  if (!normalizedMarkdown.trim()) return []
  const cacheKey = hashText(normalizedMarkdown)
  const cached = embeddedGeoExtractionCache.get(cacheKey)
  if (cached) return cloneBlocks(cached)

  const blocks = extractFencedCodeBlocks(normalizedMarkdown)
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

    const fc = parseGeoJsonFeatureCollectionFromText(trimmed)
    if (!fc) continue
    out.push({ geojsonText: JSON.stringify(fc), startLine: b.startLine, endLine: b.endLine })
  }

  embeddedGeoExtractionCache.set(cacheKey, out)
  return cloneBlocks(out)
}

export function extractEmbeddedGeoJsonGraphDataRequests(args: {
  markdownText: string
  sourceDocumentPath: string
  limit?: number
}): EmbeddedGeoJsonGraphDataRequest[] {
  const sourceDocumentPath = String(args.sourceDocumentPath || '').trim()
  if (!sourceDocumentPath) return []

  const blocks = extractEmbeddedGeoJsonFeatureCollections(args.markdownText)
  if (blocks.length === 0) return []

  const limit = Number.isFinite(args.limit) ? Math.max(0, Math.floor(args.limit as number)) : 40
  if (limit === 0) return []

  const seen = new Set<string>()
  const out: EmbeddedGeoJsonGraphDataRequest[] = []
  for (const block of blocks) {
    if (out.length >= limit) break
    const text = String(block.geojsonText || '').trim()
    if (!text) continue
    const signature = `geojson:${block.startLine}:${block.endLine}:${hashText(text)}`
    if (seen.has(signature)) continue
    seen.add(signature)
    out.push({
      sourceDocumentPath,
      codeBlock: {
        lang: 'geojson',
        text,
        startLine: block.startLine,
        endLine: block.endLine,
      },
    })
  }
  return out
}

export function buildEmbeddedGeoJsonUploadName(sourceName: string, index: number): string {
  const base = String(sourceName || 'document').trim() || 'document'
  const stem = base.replace(/\.(md|markdown)$/i, '')
  const n = Number.isFinite(index) ? Math.max(0, Math.floor(index)) : 0
  return `${stem}-embedded-geojson-${n + 1}.geojson`
}
