import { shouldSuppressBasemapErrorMessage } from '@/features/geospatial/basemapErrorSuppression'

export async function testMarkdownGeoJsonBasemapErrorsAreSuppressed() {
  const suppressed = [
    'Map preview unavailable',
    'Failed to fetch (https://tiles.example.com/1/2/3.pbf)',
    'HTTP 404 (https://tiles.example.com/style.json)',
    'CORS error (https://tiles.example.com/style.json)',
    'Map error (lastRequest=https://tiles.example.com/sprite.png)',
    'glyph request failed',
    'tile request failed',
    'style load failed',
  ]
  for (const msg of suppressed) {
    if (!shouldSuppressBasemapErrorMessage(msg)) {
      throw new Error(`expected to suppress basemap error message: ${msg}`)
    }
  }

  const notSuppressed = [
    'WebGL is not supported',
    'GeoJSON render failed',
  ]
  for (const msg of notSuppressed) {
    if (shouldSuppressBasemapErrorMessage(msg)) {
      throw new Error(`expected to not suppress message: ${msg}`)
    }
  }
}
