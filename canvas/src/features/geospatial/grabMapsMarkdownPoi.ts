import type { Feature, FeatureCollection, Point } from 'geojson'
import { SimpleTtlLruCache } from '@/lib/cache/SimpleTtlLruCache'
import { hashText } from '@/features/parsers/hash'
import { parseMarkdownBlocks, parseMarkdownFrontmatter, splitMarkdownLines } from '@/lib/markdown'
import { deriveSgAdministrativeAreasFromAddress } from 'grph-shared/geospatial/sgpAdministrativeAreas'
import { parseGeodataValueToLatLng } from '@/features/geospatial/geodataValue'
import { normalizeMarkdownGeoSourceDocumentPath } from './markdownGeoDocumentPath'
import { buildMarkdownGeoTableGraphSourceDescriptor } from './markdownGeoSourcePath'
import type { MarkdownGeoPoiFeatureCollectionEntry } from './markdownGeoSnapshotContract'

export type GrabMapsPoiFeatureCollectionEntry = MarkdownGeoPoiFeatureCollectionEntry<Point>

type GrabMapsPoiFeatureCollectionExtraction = {
  featureCollections: GrabMapsPoiFeatureCollectionEntry[]
  matchedTables: number
  matchedRows: number
}

const extractionCache = new SimpleTtlLruCache<string, GrabMapsPoiFeatureCollectionExtraction>(80, 15 * 60 * 1000)

const normalizeHeader = (value: string): string => {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
}

const normalizeSemanticPlaceLabel = (value: unknown): string => {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[`*_]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const normalizeMarkdownInlineText = (value: unknown): string => {
  return String(value || '')
    .trim()
    .replace(/\\([`*_])/g, (_match, ch: string) => `KGESC${ch.charCodeAt(0)}X`)
    .replace(/[`*_]/g, '')
    .replace(/KGESC(\d+)X/g, (_match, code: string) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim()
}

const normalizeColumnKey = (value: unknown): string => {
  return normalizeMarkdownInlineText(value).replace(/\\([^A-Za-z0-9\s])/g, '$1').trim()
}

const deriveColumnKeyAliases = (value: unknown): string[] => {
  const aliases: string[] = []
  const normalized = normalizeColumnKey(value)
  if (!normalized) return aliases
  aliases.push(normalized)
  const withoutTrailingParens = normalized.replace(/\s*\([^)]*\)\s*$/g, '').trim()
  if (withoutTrailingParens && !aliases.includes(withoutTrailingParens)) aliases.push(withoutTrailingParens)
  const beforeEquation = withoutTrailingParens.split(/\s*=\s*/)[0]?.trim() || ''
  if (beforeEquation && !aliases.includes(beforeEquation)) aliases.push(beforeEquation)
  return aliases
}

const isCoordinateLikeHeader = (headerNorm: string): boolean => {
  if (!headerNorm) return false
  if (headerNorm.includes('geodata') || headerNorm === 'geo') return true
  if (headerNorm.includes('coordinate') || headerNorm.includes('coord')) return true
  return headerNorm.includes('location') && (headerNorm.includes('lat') || headerNorm.includes('lng'))
}

const isGrabMapsPoiTableHeader = (headerNorm: string[]): boolean => {
  const hasName = headerNorm.some(h => h === 'name' || h.endsWith(' name') || h.startsWith('name '))
  const hasPoiId = headerNorm.some(h => h === 'poi_id' || h === 'poi id' || h.includes('poi'))
  const hasLocation = headerNorm.some(h => h.includes('location') && (h.includes('lat') || h.includes('lng')))
  return hasName && hasPoiId && hasLocation
}

const isGenericGeodataTableHeader = (headerNorm: string[]): boolean => {
  const hasLat = headerNorm.some(h => h === 'lat' || h.includes('latitude'))
  const hasLng = headerNorm.some(h => h === 'lng' || h === 'lon' || h.includes('longitude'))
  const hasGeoCol = headerNorm.some(isCoordinateLikeHeader)
  return (hasLat && hasLng) || hasGeoCol
}

const findColumnIndex = (headerNorm: string[], candidates: string[]): number => {
  for (const c of candidates) {
    const idx = headerNorm.findIndex(h => h === c || h.includes(c))
    if (idx >= 0) return idx
  }
  return -1
}

const findCoordinateColumnIndex = (headerNorm: string[]): number => {
  return headerNorm.findIndex(isCoordinateLikeHeader)
}

const buildRowColumnRecord = (header: string[], row: unknown[]): Record<string, unknown> => {
  const rawColumns: Record<string, unknown> = {}
  for (let j = 0; j < header.length; j += 1) {
    const key = String(header[j] || '').trim()
    if (!key) continue
    const cell = row[j]
    const value = typeof cell === 'string' ? cell.trim() : cell
    if (value === null || value === undefined || value === '') continue
    rawColumns[key] = value
    const aliases = deriveColumnKeyAliases(key)
    for (const alias of aliases) {
      if (!alias || alias === key || alias in rawColumns) continue
      rawColumns[alias] = value
    }
  }
  return rawColumns
}

const mergeSupplementalColumns = (
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): void => {
  for (const [key, value] of Object.entries(source)) {
    if (key in target) continue
    target[key] = value
  }
}

export function extractGrabMapsPoiFeatureCollectionsFromMarkdown(args: {
  markdownText: string
  sourceDocumentPath: string
  limitTables?: number
  limitRowsPerTable?: number
}): GrabMapsPoiFeatureCollectionExtraction {
  const markdownText = String(args.markdownText || '')
  const sourceDocumentPath = normalizeMarkdownGeoSourceDocumentPath(args.sourceDocumentPath)
  const limitTables = Number.isFinite(args.limitTables) ? Math.max(0, Math.floor(args.limitTables as number)) : 3
  const limitRowsPerTable = Number.isFinite(args.limitRowsPerTable)
    ? Math.max(0, Math.floor(args.limitRowsPerTable as number))
    : 200
  if (!markdownText.trim() || !sourceDocumentPath || limitTables === 0 || limitRowsPerTable === 0) {
    return { featureCollections: [], matchedTables: 0, matchedRows: 0 }
  }

  const cacheKey = hashText([
    'grabmaps-poi-md',
    sourceDocumentPath,
    hashText(markdownText),
    String(limitTables),
    String(limitRowsPerTable),
  ].join(':'))
  const cached = extractionCache.get(cacheKey)
  if (cached) return cached

  const lines = splitMarkdownLines(markdownText)
  const { startIndex } = parseMarkdownFrontmatter(lines)
  const blocks = parseMarkdownBlocks(lines, startIndex)

  const featureCollections: GrabMapsPoiFeatureCollectionEntry[] = []
  let matchedTables = 0
  let matchedRows = 0
  const featurePropsBySemanticLabel = new Map<string, Record<string, unknown>>()
  const deferredSupplementRows: Array<Record<string, unknown>> = []

  for (const block of blocks) {
    if (featureCollections.length >= limitTables) break
    if (block.kind !== 'table') continue
    const header = Array.isArray(block.tableHeader) ? block.tableHeader : []
    const rows = Array.isArray(block.tableRows) ? block.tableRows : []
    if (header.length === 0 || rows.length === 0) continue
    const headerNorm = header.map(normalizeHeader)
    const grabMapsMode = isGrabMapsPoiTableHeader(headerNorm)
    const genericGeodataMode = isGenericGeodataTableHeader(headerNorm)
    const nameIdx = findColumnIndex(headerNorm, ['name'])
    const poiIdIdx = findColumnIndex(headerNorm, ['poi_id', 'poi id', 'poi'])
    const businessIdx = findColumnIndex(headerNorm, ['business_type', 'business type', 'category'])
    const postcodeIdx = findColumnIndex(headerNorm, ['postcode', 'postal'])
    const streetIdx = findColumnIndex(headerNorm, ['street', 'address'])
    const titleIdx = findColumnIndex(headerNorm, ['title', 'label'])
    const areaIdx = findColumnIndex(headerNorm, ['area', 'district', 'candidate', 'origin', 'location'])
    const locationNameIdx = findColumnIndex(headerNorm, ['location', 'place', 'destination'])
    const locationIdx = findCoordinateColumnIndex(headerNorm)
    const latIdx = findColumnIndex(headerNorm, ['lat', 'latitude', 'y'])
    const lngIdx = findColumnIndex(headerNorm, ['lng', 'lon', 'longitude', 'x'])
    const semanticNameIdx = nameIdx >= 0
      ? nameIdx
      : titleIdx >= 0
        ? titleIdx
        : areaIdx >= 0
          ? areaIdx
          : locationNameIdx
    const semanticSupplementMode =
      !grabMapsMode
      && !genericGeodataMode
      && featurePropsBySemanticLabel.size > 0
      && semanticNameIdx >= 0
      && header.length > 1
    if (!grabMapsMode && !genericGeodataMode && !semanticSupplementMode) continue
    const rowCanProvideCoordinates = locationIdx >= 0 || (latIdx >= 0 && lngIdx >= 0)
    const rowCanProvideSemanticName = semanticNameIdx >= 0
    const metadataOnlyMode = semanticSupplementMode || (!rowCanProvideCoordinates && rowCanProvideSemanticName)
    if (!metadataOnlyMode && locationIdx < 0 && (latIdx < 0 || lngIdx < 0)) continue

    const features: Array<Feature<Point>> = []
    const rowLimit = Math.min(rows.length, limitRowsPerTable)
    for (let i = 0; i < rowLimit; i += 1) {
      const row = rows[i] || []
      const rawColumns = buildRowColumnRecord(header, row)
      const name = normalizeMarkdownInlineText(semanticNameIdx >= 0 ? row[semanticNameIdx] : '') || `row_${i + 1}`
      const semanticLabel = normalizeSemanticPlaceLabel(name)
      const location = (() => {
        if (locationIdx >= 0) {
          const parsed = parseGeodataValueToLatLng(row[locationIdx])
          if (parsed) return parsed
        }
        if (latIdx >= 0 && lngIdx >= 0) {
          return parseGeodataValueToLatLng({ lat: row[latIdx], lng: row[lngIdx] })
        }
        return null
      })()
      if (!location) {
        if (metadataOnlyMode && semanticLabel) {
          const mapped = featurePropsBySemanticLabel.get(semanticLabel)
          if (mapped) {
            mergeSupplementalColumns(mapped, rawColumns)
            matchedRows += 1
          } else {
            deferredSupplementRows.push(rawColumns)
          }
        }
        continue
      }
      const poiId = poiIdIdx >= 0 ? String(row[poiIdIdx] || '').trim() : ''
      const businessType = businessIdx >= 0 ? String(row[businessIdx] || '').trim() : ''
      const postcode = postcodeIdx >= 0 ? String(row[postcodeIdx] || '').trim() : ''
      const street = streetIdx >= 0 ? String(row[streetIdx] || '').trim() : ''

      const derivedAdmin = grabMapsMode
        ? deriveSgAdministrativeAreasFromAddress({
            countryCode: 'SGP',
            city: 'Singapore City',
            postcode,
            street,
          })
        : null
      const properties: Record<string, unknown> = {
        label: name,
        name,
        ...rawColumns,
        ...(poiId ? { poi_id: poiId } : {}),
        ...(businessType ? { business_type: businessType } : {}),
        ...(postcode ? { postcode } : {}),
        ...(street ? { street } : {}),
        ...(grabMapsMode ? { country_code: 'SGP', city: 'Singapore City' } : {}),
        ...(derivedAdmin ? { admin: derivedAdmin } : {}),
        kgSourceDocumentPath: sourceDocumentPath,
        kgSourceTableStartLine: block.startLine,
      }
      if (semanticLabel) featurePropsBySemanticLabel.set(semanticLabel, properties)
      const featureId = poiId || `row:${block.startLine}:${i + 1}`
      features.push({
        type: 'Feature',
        id: featureId,
        geometry: { type: 'Point', coordinates: [location.lng, location.lat] },
        properties,
      })
    }

    if (features.length === 0) continue
    matchedTables += 1
    matchedRows += features.length
    const featureCollection: FeatureCollection<Point> = { type: 'FeatureCollection', features }
    featureCollections.push({
      featureCollection,
      sourceDescriptor: buildMarkdownGeoTableGraphSourceDescriptor({
        sourceDocumentPath,
        featureCollection,
        tableIndex: featureCollections.length + 1,
      }),
    })
  }

  if (deferredSupplementRows.length > 0 && featurePropsBySemanticLabel.size > 0) {
    for (const row of deferredSupplementRows) {
      const semanticCandidates = [
        row.Area,
        row.area,
        row.Location,
        row.location,
        row.Candidate,
        row.candidate,
        row.Name,
        row.name,
        row.Title,
        row.title,
      ]
      const semanticLabel = normalizeSemanticPlaceLabel(semanticCandidates.find(value => String(value || '').trim()) || '')
      if (!semanticLabel) continue
      const mapped = featurePropsBySemanticLabel.get(semanticLabel)
      if (!mapped) continue
      mergeSupplementalColumns(mapped, row)
      matchedRows += 1
    }
  }

  const result: GrabMapsPoiFeatureCollectionExtraction = { featureCollections, matchedTables, matchedRows }
  extractionCache.set(cacheKey, result)
  return result
}
