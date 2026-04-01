import { parseGeoJsonFeatureCollectionFromText } from '@/features/geospatial/geojsonParseCache'

export function testGeoJsonParseCacheReturnsSameInstanceForSameText() {
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
  if (first !== second) {
    throw new Error('expected cached FeatureCollection instance to be reused for identical text')
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

