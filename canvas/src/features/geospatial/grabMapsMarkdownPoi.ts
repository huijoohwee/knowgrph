import type { Feature, FeatureCollection, Point } from 'geojson'
import { SimpleTtlLruCache } from '@/lib/cache/SimpleTtlLruCache'
import { hashText } from '@/features/parsers/hash'
import { parseMarkdownBlocks, parseMarkdownFrontmatter, splitMarkdownLines } from '@/lib/markdown'
import { deriveSgAdministrativeAreasFromAddress } from 'grph-shared/geospatial/sgpAdministrativeAreas'
import { parseGeodataValueToLatLng } from '@/features/geospatial/geodataValue'

type GrabMapsPoiFeatureCollectionExtraction = {
  featureCollections: Array<FeatureCollection<Point>>
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

const isGrabMapsPoiTableHeader = (headerNorm: string[]): boolean => {
  const hasName = headerNorm.some(h => h === 'name' || h.endsWith(' name') || h.startsWith('name '))
  const hasPoiId = headerNorm.some(h => h === 'poi_id' || h === 'poi id' || h.includes('poi'))
  const hasLocation = headerNorm.some(h => h.includes('location') && (h.includes('lat') || h.includes('lng')))
  return hasName && hasPoiId && hasLocation
}

const isGenericGeodataTableHeader = (headerNorm: string[]): boolean => {
  const hasLat = headerNorm.some(h => h === 'lat' || h.includes('latitude'))
  const hasLng = headerNorm.some(h => h === 'lng' || h === 'lon' || h.includes('longitude'))
  const hasGeoCol = headerNorm.some(h => h.includes('geodata') || h === 'geo' || h.includes('location') || h.includes('coordinate'))
  return (hasLat && hasLng) || hasGeoCol
}

const findColumnIndex = (headerNorm: string[], candidates: string[]): number => {
  for (const c of candidates) {
    const idx = headerNorm.findIndex(h => h === c || h.includes(c))
    if (idx >= 0) return idx
  }
  return -1
}

export function extractGrabMapsPoiFeatureCollectionsFromMarkdown(args: {
  markdownText: string
  sourceDocumentPath: string
  limitTables?: number
  limitRowsPerTable?: number
}): GrabMapsPoiFeatureCollectionExtraction {
  const markdownText = String(args.markdownText || '')
  const sourceDocumentPath = String(args.sourceDocumentPath || '').trim()
  const limitTables = Number.isFinite(args.limitTables) ? Math.max(0, Math.floor(args.limitTables as number)) : 3
  const limitRowsPerTable = Number.isFinite(args.limitRowsPerTable)
    ? Math.max(0, Math.floor(args.limitRowsPerTable as number))
    : 200
  if (!markdownText.trim() || !sourceDocumentPath || limitTables === 0 || limitRowsPerTable === 0) {
    return { featureCollections: [], matchedTables: 0, matchedRows: 0 }
  }

  const cacheKey = hashText(`grabmaps-poi-md:${sourceDocumentPath}:${hashText(markdownText)}`)
  const cached = extractionCache.get(cacheKey)
  if (cached) return cached

  const lines = splitMarkdownLines(markdownText)
  const { startIndex } = parseMarkdownFrontmatter(lines)
  const blocks = parseMarkdownBlocks(lines, startIndex)

  const featureCollections: Array<FeatureCollection<Point>> = []
  let matchedTables = 0
  let matchedRows = 0

  for (const block of blocks) {
    if (featureCollections.length >= limitTables) break
    if (block.kind !== 'table') continue
    const header = Array.isArray(block.tableHeader) ? block.tableHeader : []
    const rows = Array.isArray(block.tableRows) ? block.tableRows : []
    if (header.length === 0 || rows.length === 0) continue
    const headerNorm = header.map(normalizeHeader)
    const grabMapsMode = isGrabMapsPoiTableHeader(headerNorm)
    const genericGeodataMode = isGenericGeodataTableHeader(headerNorm)
    if (!grabMapsMode && !genericGeodataMode) continue

    const nameIdx = findColumnIndex(headerNorm, ['name'])
    const poiIdIdx = findColumnIndex(headerNorm, ['poi_id', 'poi id', 'poi'])
    const businessIdx = findColumnIndex(headerNorm, ['business_type', 'business type', 'category'])
    const postcodeIdx = findColumnIndex(headerNorm, ['postcode', 'postal'])
    const streetIdx = findColumnIndex(headerNorm, ['street', 'address'])
    const titleIdx = findColumnIndex(headerNorm, ['title', 'label'])
    const locationIdx = findColumnIndex(headerNorm, ['location', 'geodata', 'geo', 'coordinates', 'coord'])
    const latIdx = findColumnIndex(headerNorm, ['lat', 'latitude', 'y'])
    const lngIdx = findColumnIndex(headerNorm, ['lng', 'lon', 'longitude', 'x'])
    if (nameIdx < 0 && !grabMapsMode) {
      const titleIdx = findColumnIndex(headerNorm, ['title', 'label'])
      if (titleIdx >= 0) {
        // no-op, handled in row parsing fallback
      }
    }
    if (locationIdx < 0 && (latIdx < 0 || lngIdx < 0)) continue

    const features: Array<Feature<Point>> = []
    const rowLimit = Math.min(rows.length, limitRowsPerTable)
    for (let i = 0; i < rowLimit; i += 1) {
      const row = rows[i] || []
      const name = String((nameIdx >= 0 ? row[nameIdx] : titleIdx >= 0 ? row[titleIdx] : '') || '').trim() || `row_${i + 1}`
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
      if (!location) continue
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
      const rawColumns: Record<string, unknown> = {}
      for (let j = 0; j < header.length; j += 1) {
        const key = String(header[j] || '').trim()
        if (!key) continue
        const cell = row[j]
        const value = typeof cell === 'string' ? cell.trim() : cell
        if (value === null || value === undefined || value === '') continue
        rawColumns[key] = value
      }
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
    featureCollections.push({ type: 'FeatureCollection', features })
  }

  const result: GrabMapsPoiFeatureCollectionExtraction = { featureCollections, matchedTables, matchedRows }
  extractionCache.set(cacheKey, result)
  return result
}
