import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { extractEmbeddedGeoJsonFeatureCollections } from '@/lib/markdown/embeddedGeoJson'

export function testMarkdownEmbeddedGeoJsonExtractionFindsFeatureCollections() {
  const p = resolve(process.cwd(), 'src', '__tests__', 'fixtures', 'markdown-embedded-geojson-demo.md')
  const text = readFileSync(p, 'utf8')
  const blocks = extractEmbeddedGeoJsonFeatureCollections(text)
  if (blocks.length !== 2) {
    throw new Error(`Expected 2 embedded GeoJSON FeatureCollection blocks, got ${blocks.length}`)
  }
  for (const b of blocks) {
    const parsed = JSON.parse(b.geojsonText) as { type?: unknown }
    if (parsed.type !== 'FeatureCollection') throw new Error('Expected FeatureCollection')
  }
}

