import { SimpleTtlLruCache } from '@/lib/cache/SimpleTtlLruCache'
import { hashText } from '@/features/parsers/hash'
import { hashSignatureParts } from '@/lib/hash/signature'
import { cloneMarkdownGeoAnalysis } from '@/features/geospatial/markdownGeoClone'
import type { MarkdownGeoAnalysisSnapshot } from '@/features/geospatial/markdownGeoSnapshotContract'
import { extractEmbeddedGeoJsonGraphDataRequests } from './embeddedGeoJson'
import { extractGrabMapsPoiFeatureCollectionsFromMarkdown } from '@/features/geospatial/grabMapsMarkdownPoi'
import { normalizeMarkdownGeoSourceDocumentPath } from '@/features/geospatial/markdownGeoDocumentPath'

export type MarkdownGeodataAnalysis = MarkdownGeoAnalysisSnapshot

const markdownGeodataAnalysisCache = new SimpleTtlLruCache<string, MarkdownGeodataAnalysis>(96, 20 * 60 * 1000)

export type MarkdownGeodataCandidateProfile = {
  mayContainEmbeddedGeoJson: boolean
  mayContainPoiTables: boolean
  textSignature: string
}

const createEmptyMarkdownGeodataAnalysis = (): MarkdownGeodataAnalysis => ({
  embeddedGeoJsonGraphDataRequests: [],
  embeddedGeoBlockCount: 0,
  poiFeatureCollections: [],
  matchedPoiTables: 0,
  matchedPoiRows: 0,
})

export function buildMarkdownGeodataCandidateProfile(rawMarkdownText: unknown): MarkdownGeodataCandidateProfile {
  const markdownText = String(rawMarkdownText || '')
  const hasCodeFence = markdownText.includes('```')
  const hasTablePipe = markdownText.includes('|')
  const mayContainEmbeddedGeoJson =
    hasCodeFence
    && /(FeatureCollection|```geojson|```json)/i.test(markdownText)
  const mayContainPoiTables =
    hasTablePipe
    && /(?:\blat\b|\blng\b|\blatitude\b|\blongitude\b|\blocation\b|\bcoordinates?\b|\bpoi[_ ]?id\b)/i.test(markdownText)
  const needsContentHash = mayContainEmbeddedGeoJson || mayContainPoiTables
  return {
    mayContainEmbeddedGeoJson,
    mayContainPoiTables,
    textSignature: needsContentHash
      ? `geo:${markdownText.length}:${hashText(markdownText)}`
      : `plain:${markdownText.length}:${hasCodeFence ? 1 : 0}:${hasTablePipe ? 1 : 0}`,
  }
}

export function buildMarkdownGeodataAnalysisCacheSignature(args: {
  markdownText: string
  sourceDocumentPath: string
  embeddedGeoLimit?: number
  poiTableLimit?: number
  poiRowLimit?: number
  candidateProfile?: MarkdownGeodataCandidateProfile
}): string {
  const sourceDocumentPath = normalizeMarkdownGeoSourceDocumentPath(args.sourceDocumentPath)
  const embeddedGeoLimit = Number.isFinite(args.embeddedGeoLimit) ? Math.max(0, Math.floor(args.embeddedGeoLimit as number)) : 40
  const poiTableLimit = Number.isFinite(args.poiTableLimit) ? Math.max(0, Math.floor(args.poiTableLimit as number)) : 3
  const poiRowLimit = Number.isFinite(args.poiRowLimit) ? Math.max(0, Math.floor(args.poiRowLimit as number)) : 200
  const profile = args.candidateProfile || buildMarkdownGeodataCandidateProfile(args.markdownText)
  return hashSignatureParts([
    'markdown-geodata-analysis',
    sourceDocumentPath,
    profile.textSignature,
    embeddedGeoLimit,
    poiTableLimit,
    poiRowLimit,
  ])
}

export function analyzeMarkdownGeodataSources(args: {
  markdownText: string
  sourceDocumentPath: string
  embeddedGeoLimit?: number
  poiTableLimit?: number
  poiRowLimit?: number
  candidateProfile?: MarkdownGeodataCandidateProfile
  cacheSignature?: string
}): MarkdownGeodataAnalysis {
  const markdownText = String(args.markdownText || '')
  const sourceDocumentPath = normalizeMarkdownGeoSourceDocumentPath(args.sourceDocumentPath)
  const embeddedGeoLimit = Number.isFinite(args.embeddedGeoLimit) ? Math.max(0, Math.floor(args.embeddedGeoLimit as number)) : 40
  const poiTableLimit = Number.isFinite(args.poiTableLimit) ? Math.max(0, Math.floor(args.poiTableLimit as number)) : 3
  const poiRowLimit = Number.isFinite(args.poiRowLimit) ? Math.max(0, Math.floor(args.poiRowLimit as number)) : 200
  if (!markdownText.trim() || !sourceDocumentPath) {
    return createEmptyMarkdownGeodataAnalysis()
  }

  const candidateProfile = args.candidateProfile || buildMarkdownGeodataCandidateProfile(markdownText)
  const cacheKey = String(args.cacheSignature || '').trim() || buildMarkdownGeodataAnalysisCacheSignature({
    markdownText,
    sourceDocumentPath,
    embeddedGeoLimit,
    poiTableLimit,
    poiRowLimit,
    candidateProfile,
  })
  const cached = markdownGeodataAnalysisCache.get(cacheKey)
  if (cached) return cloneMarkdownGeoAnalysis(cached)

  const embeddedGeoJsonGraphDataRequests = candidateProfile.mayContainEmbeddedGeoJson
    ? extractEmbeddedGeoJsonGraphDataRequests({
        markdownText,
        sourceDocumentPath,
        limit: embeddedGeoLimit,
      })
    : []
  const poiExtraction = candidateProfile.mayContainPoiTables
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
