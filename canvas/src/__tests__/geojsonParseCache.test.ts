import { parseGeoJsonFeatureCollectionFromText } from '@/features/geospatial/geojsonParseCache'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGeoJsonParseCacheClonesFeatureCollectionsForRepeatedText() {
  const featureCollection = {
    type: 'FeatureCollection' as const,
    features: Array.from({ length: 32 }, (_, index) => ({
      type: 'Feature' as const,
      properties: { id: index, name: `Point ${index}` },
      geometry: { type: 'Point' as const, coordinates: [103.8 + index * 0.001, 1.3 + index * 0.001] },
    })),
  }
  const text = JSON.stringify(featureCollection)
  const first = parseGeoJsonFeatureCollectionFromText(text)
  const second = parseGeoJsonFeatureCollectionFromText(text)
  if (!first || !second) {
    throw new Error('expected parseGeoJsonFeatureCollectionFromText to return a FeatureCollection')
  }
  if (first === second) {
    throw new Error('expected GeoJSON parse cache hits to clone FeatureCollection wrappers rather than sharing mutable references')
  }
  if (first.features === second.features) {
    throw new Error('expected GeoJSON parse cache hits to clone FeatureCollection feature arrays rather than sharing mutable references')
  }
  if (first.features.length !== featureCollection.features.length) {
    throw new Error('expected all features to be preserved in cached FeatureCollection')
  }
}

export function testGeoJsonParseCacheRemembersFailures() {
  const invalidText = 'not valid geojson'
  const first = parseGeoJsonFeatureCollectionFromText(invalidText)
  const second = parseGeoJsonFeatureCollectionFromText(invalidText)
  if (first !== null || second !== null) {
    throw new Error('expected invalid GeoJSON text to yield null consistently')
  }
}

export function testGeoJsonParseCacheReusesSharedMarkdownGeoCloneHelper() {
  const sourcePath = resolve(process.cwd(), 'src', 'features', 'geospatial', 'geojsonParseCache.ts')
  const sourceText = readFileSync(sourcePath, 'utf8')
  if (
    !sourceText.includes("import { cloneMarkdownGeoFeatureCollection } from './markdownGeoClone'")
    || !sourceText.includes('if (cached) return cached.ok ? cloneMarkdownGeoFeatureCollection(cached.featureCollection) : null')
    || !sourceText.includes('const normalized = cloneMarkdownGeoFeatureCollection(coerceGeoJsonToFeatureCollection(parsed))')
    || !sourceText.includes('return cloneMarkdownGeoFeatureCollection(normalized)')
    || sourceText.includes('if (cached) return cached.ok ? cached.featureCollection : null')
  ) {
    throw new Error('expected geojsonParseCache to reuse the shared markdown geo clone helper instead of returning cached FeatureCollection references directly')
  }
}
