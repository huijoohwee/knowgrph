import type { FeatureCollection, Geometry } from 'geojson'
import { extractFencedCodeBlocks } from './extractFencedCodeBlocks'
import { hashText } from '@/features/parsers/hash'
import { SimpleTtlLruCache } from '@/lib/cache/SimpleTtlLruCache'
import { cloneMarkdownGeoEmbeddedBlocks } from '@/features/geospatial/markdownGeoClone'
import type { MarkdownGeoEmbeddedBlock, MarkdownGeoEmbeddedRequest } from '@/features/geospatial/markdownGeoSnapshotContract'
import { normalizeMarkdownGeoSourceDocumentPath } from '@/features/geospatial/markdownGeoDocumentPath'
import {
  buildMarkdownGeoCodeBlockContentHash,
} from '@/features/geospatial/markdownGeoContentSignature'
import { resolveMarkdownGeoTextParseResult } from '@/features/geospatial/markdownGeoParse'
import {
  buildMarkdownGeoDocumentLineRangePath,
  normalizeMarkdownGeoLineRange,
} from '@/features/geospatial/markdownGeoLineRange'
import { buildMarkdownGeoCodeBlockGraphSourceDescriptor } from '@/features/geospatial/markdownGeoSourcePath'

export type EmbeddedGeoJsonBlock = MarkdownGeoEmbeddedBlock<Geometry>

export type EmbeddedGeoJsonGraphDataRequest = MarkdownGeoEmbeddedRequest<Geometry>

const embeddedGeoExtractionCache = new SimpleTtlLruCache<string, EmbeddedGeoJsonBlock[]>(120, 20 * 60 * 1000)

export function extractEmbeddedGeoJsonFeatureCollections(markdownText: string): EmbeddedGeoJsonBlock[] {
  const normalizedMarkdown = String(markdownText || '')
  if (!normalizedMarkdown.trim()) return []
  const cacheKey = hashText(normalizedMarkdown)
  const cached = embeddedGeoExtractionCache.get(cacheKey)
  if (cached) return cloneMarkdownGeoEmbeddedBlocks(cached)

  const blocks = extractFencedCodeBlocks(normalizedMarkdown)
  const out: EmbeddedGeoJsonBlock[] = []

  for (const b of blocks) {
    const lang = b.lang
    if (lang !== 'geojson' && lang !== 'json') continue
    const parsed = resolveMarkdownGeoTextParseResult({ geojsonText: b.content })
    if (!parsed.normalizedText) continue

    if (lang === 'json') {
      const lc = parsed.normalizedText.toLowerCase()
      if (!lc.includes('"type"')) continue
      if (!lc.includes('featurecollection') && !lc.includes('"feature"')) continue
    }

    if (!parsed.featureCollection) continue
    out.push({
      featureCollection: parsed.featureCollection as FeatureCollection<Geometry>,
      geojsonText: parsed.normalizedText,
      startLine: b.startLine,
      endLine: b.endLine,
    })
  }

  embeddedGeoExtractionCache.set(cacheKey, out)
  return cloneMarkdownGeoEmbeddedBlocks(out)
}

export function extractEmbeddedGeoJsonGraphDataRequests(args: {
  markdownText: string
  sourceDocumentPath: string
  limit?: number
}): EmbeddedGeoJsonGraphDataRequest[] {
  const sourceDocumentPath = normalizeMarkdownGeoSourceDocumentPath(args.sourceDocumentPath)
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
    const lineRange = normalizeMarkdownGeoLineRange({
      startLine: block.startLine,
      endLine: block.endLine,
    })
    const sourceLineRangePath = buildMarkdownGeoDocumentLineRangePath({
      sourceDocumentPath,
      startLine: lineRange.startLine,
      endLine: lineRange.endLine,
    })
    const signature = `geojson:${sourceLineRangePath}:${buildMarkdownGeoCodeBlockContentHash(text)}`
    if (seen.has(signature)) continue
    seen.add(signature)
    const sourceDescriptor = buildMarkdownGeoCodeBlockGraphSourceDescriptor({
      sourceDocumentPath,
      codeBlock: {
        lang: 'geojson',
        text,
        startLine: lineRange.startLine,
        endLine: lineRange.endLine,
      },
    })
    out.push({
      sourceDocumentPath,
      sourceDescriptor,
      featureCollection: block.featureCollection,
      codeBlock: {
        lang: 'geojson',
        text,
        startLine: lineRange.startLine,
        endLine: lineRange.endLine,
      },
    })
  }
  return out
}
