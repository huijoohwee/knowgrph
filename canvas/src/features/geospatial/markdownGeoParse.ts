import { computeBoundsFromCollections } from 'gympgrph/map-preview'
import { hashText } from '@/features/parsers/hash'
import { cloneMarkdownGeoParseResult } from './markdownGeoClone'
import { parseGeoJsonFeatureCollectionFromText } from '@/features/geospatial/geojsonParseCache'
import type { MarkdownGeoDatasetRegistrationRequest } from './markdownGeoDatasetContract'
import { normalizeMarkdownGeoCodeBlockText } from './markdownGeoContentSignature'
import type {
  MarkdownGeoParseResult,
  MarkdownGeoTextParseArgs,
} from './markdownGeoParseContract'

const requestParseCache = new WeakMap<MarkdownGeoDatasetRegistrationRequest, MarkdownGeoParseResult>()

export function resolveMarkdownGeoTextParseResult(args: MarkdownGeoTextParseArgs): MarkdownGeoParseResult {
  const normalizedText = normalizeMarkdownGeoCodeBlockText(args.geojsonText)
  const featureCollection = args.featureCollection || (normalizedText ? parseGeoJsonFeatureCollectionFromText(normalizedText) : null)
  return cloneMarkdownGeoParseResult({
    normalizedText,
    textHash: normalizedText ? hashText(normalizedText) : '',
    featureCollection,
    bounds: featureCollection ? computeBoundsFromCollections([featureCollection]) : null,
  })
}

export function resolveMarkdownGeoDatasetParseResult(
  req: MarkdownGeoDatasetRegistrationRequest,
): MarkdownGeoParseResult {
  const cached = requestParseCache.get(req)
  if (cached) return cloneMarkdownGeoParseResult(cached)
  const result = resolveMarkdownGeoTextParseResult({ geojsonText: req.codeBlock.text })
  requestParseCache.set(req, cloneMarkdownGeoParseResult(result))
  return cloneMarkdownGeoParseResult(result)
}
