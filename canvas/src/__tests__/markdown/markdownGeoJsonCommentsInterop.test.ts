import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { extractEmbeddedGeoJsonFeatureCollections } from '@/lib/markdown/embeddedGeoJson'

export function testMarkdownGeoJsonWithCommentsParsesAndExtracts() {
  const p = resolve(process.cwd(), 'src', '__tests__', 'fixtures', 'trip-demo-geojson-comments.md')
  const text = readFileSync(p, 'utf8')
  const blocks = extractEmbeddedGeoJsonFeatureCollections(text)
  if (blocks.length !== 1) {
    throw new Error(`Expected 1 embedded GeoJSON FeatureCollection block, got ${blocks.length}`)
  }
  const parsed = JSON.parse(blocks[0].geojsonText) as { type?: unknown; features?: unknown }
  if (parsed.type !== 'FeatureCollection') throw new Error('Expected FeatureCollection')
  if (!Array.isArray(parsed.features) || parsed.features.length !== 2) throw new Error('Expected 2 features')
}

