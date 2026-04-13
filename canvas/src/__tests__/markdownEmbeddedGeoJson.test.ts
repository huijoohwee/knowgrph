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

export function testMarkdownEmbeddedGeoJsonExtractionFindsFeatureCollectionInComputingFlowSample() {
  const p = resolve(process.cwd(), '..', '..', 'sandbox', 'test-data', 'markdown-syntax-computing-flow-sample.md')
  const text = readFileSync(p, 'utf8')
  const blocks = extractEmbeddedGeoJsonFeatureCollections(text)
  if (blocks.length < 1) {
    throw new Error('Expected computing-flow sample to include at least one embedded GeoJSON FeatureCollection block')
  }
  const parsed = JSON.parse(blocks[0].geojsonText) as { type?: unknown; features?: unknown[] }
  if (parsed.type !== 'FeatureCollection') throw new Error('Expected computing-flow sample GeoJSON block to be a FeatureCollection')
  if (!Array.isArray(parsed.features) || parsed.features.length < 2) {
    throw new Error('Expected computing-flow sample GeoJSON block to include at least two features')
  }
}
