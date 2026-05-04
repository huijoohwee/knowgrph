import { SimpleTtlLruCache } from '@/lib/cache/SimpleTtlLruCache'
import { hashText } from '@/features/parsers/hash'
import { cloneMarkdownGeoAnalysis } from '@/features/geospatial/markdownGeoClone'
import type { MarkdownGeoAnalysisSnapshot } from '@/features/geospatial/markdownGeoSnapshotContract'
import { extractEmbeddedGeoJsonGraphDataRequests } from './embeddedGeoJson'
import { extractGrabMapsPoiFeatureCollectionsFromMarkdown } from '@/features/geospatial/grabMapsMarkdownPoi'
import { normalizeMarkdownGeoSourceDocumentPath } from '@/features/geospatial/markdownGeoDocumentPath'

export type MarkdownGeodataAnalysis = MarkdownGeoAnalysisSnapshot

const markdownGeodataAnalysisCache = new SimpleTtlLruCache<string, MarkdownGeodataAnalysis>(96, 20 * 60 * 1000)

export function analyzeMarkdownGeodataSources(args: {
  markdownText: string
  sourceDocumentPath: string
  embeddedGeoLimit?: number
  poiTableLimit?: number
  poiRowLimit?: number
}): MarkdownGeodataAnalysis {
  const markdownText = String(args.markdownText || '')
  const sourceDocumentPath = normalizeMarkdownGeoSourceDocumentPath(args.sourceDocumentPath)
  const embeddedGeoLimit = Number.isFinite(args.embeddedGeoLimit) ? Math.max(0, Math.floor(args.embeddedGeoLimit as number)) : 40
  const poiTableLimit = Number.isFinite(args.poiTableLimit) ? Math.max(0, Math.floor(args.poiTableLimit as number)) : 3
  const poiRowLimit = Number.isFinite(args.poiRowLimit) ? Math.max(0, Math.floor(args.poiRowLimit as number)) : 200
  if (!markdownText.trim() || !sourceDocumentPath) {
    return {
      embeddedGeoJsonGraphDataRequests: [],
      embeddedGeoBlockCount: 0,
      poiFeatureCollections: [],
      matchedPoiTables: 0,
      matchedPoiRows: 0,
    }
  }

  const cacheKey = hashText([
    'markdown-geodata-analysis',
    sourceDocumentPath,
    hashText(markdownText),
    embeddedGeoLimit,
    poiTableLimit,
    poiRowLimit,
  ].join(':'))
  const cached = markdownGeodataAnalysisCache.get(cacheKey)
  if (cached) return cloneMarkdownGeoAnalysis(cached)

  const mayContainEmbeddedGeoJson =
    markdownText.includes('```')
    && /(FeatureCollection|```geojson|```json)/i.test(markdownText)
  const mayContainPoiTables =
    markdownText.includes('|')
    && /(?:\blat\b|\blng\b|\blatitude\b|\blongitude\b|\blocation\b|\bcoordinates?\b|\bpoi[_ ]?id\b)/i.test(markdownText)

  const embeddedGeoJsonGraphDataRequests = mayContainEmbeddedGeoJson
    ? extractEmbeddedGeoJsonGraphDataRequests({
        markdownText,
        sourceDocumentPath,
        limit: embeddedGeoLimit,
      })
    : []
  const poiExtraction = mayContainPoiTables
    ? extractGrabMapsPoiFeatureCollectionsFromMarkdown({
        markdownText,
        sourceDocumentPath,
        limitTables: poiTableLimit,
        limitRowsPerTable: poiRowLimit,
      })
    : { featureCollections: [], matchedTables: 0, matchedRows: 0 }

  const result: MarkdownGeodataAnalysis = {
    embeddedGeoJsonGraphDataRequests,
    embeddedGeoBlockCount: embeddedGeoJsonGraphDataRequests.length,
    poiFeatureCollections: poiExtraction.featureCollections,
    matchedPoiTables: poiExtraction.matchedTables,
    matchedPoiRows: poiExtraction.matchedRows,
  }
  markdownGeodataAnalysisCache.set(cacheKey, result)
  return cloneMarkdownGeoAnalysis(result)
}
