import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { extractEmbeddedGeoJsonFeatureCollections, extractEmbeddedGeoJsonGraphDataRequests } from '@/lib/markdown/embeddedGeoJson'
import { resolveMarkdownGeoTextParseResult } from '@/features/geospatial/markdownGeoParse'
import { readTripDemoMmd } from '@/tests/lib/tripDemo'
import { resolveRepoTestDataPath } from '@/tests/lib/repoTestData'

export function testMarkdownEmbeddedGeoJsonExtractionFindsFeatureCollections() {
  const p = resolve(process.cwd(), 'src', '__tests__', 'fixtures', 'markdown-embedded-geojson-demo.md')
  const text = readFileSync(p, 'utf8')
  const blocks = extractEmbeddedGeoJsonFeatureCollections(text)
  if (blocks.length !== 2) {
    throw new Error(`Expected 2 embedded GeoJSON FeatureCollection blocks, got ${blocks.length}`)
  }
  for (const b of blocks) {
    const parsed = resolveMarkdownGeoTextParseResult({ geojsonText: b.geojsonText })
    if (parsed.featureCollection?.type !== 'FeatureCollection') throw new Error('Expected FeatureCollection')
  }
}

export function testMarkdownEmbeddedGeoJsonExtractionFindsFeatureCollectionInComputingFlowSample() {
  const p = resolveRepoTestDataPath('markdown-syntax-computing-flow-sample.md')
  const text = readFileSync(p, 'utf8')
  const blocks = extractEmbeddedGeoJsonFeatureCollections(text)
  if (blocks.length < 1) {
    throw new Error('Expected computing-flow sample to include at least one embedded GeoJSON FeatureCollection block')
  }
  const parsed = resolveMarkdownGeoTextParseResult({ geojsonText: blocks[0].geojsonText }).featureCollection
  if (parsed?.type !== 'FeatureCollection') throw new Error('Expected computing-flow sample GeoJSON block to be a FeatureCollection')
  if (!Array.isArray(parsed.features) || parsed.features.length < 2) {
    throw new Error('Expected computing-flow sample GeoJSON block to include at least two features')
  }
}

export function testMarkdownEmbeddedGeoJsonExtractionSupportsTripDemoMmdJsonFence() {
  const text = readTripDemoMmd()
  if (!text) return

  const blocks = extractEmbeddedGeoJsonFeatureCollections(text)
  if (blocks.length < 1) {
    throw new Error('Expected trip-demo-mmd markdown to include at least one embedded GeoJSON FeatureCollection block')
  }

  const reqs = extractEmbeddedGeoJsonGraphDataRequests({
    markdownText: text,
    sourceDocumentPath: 'fixtures/trip-demo-mmd.md',
    limit: 10,
  })
  if (reqs.length < 1) {
    throw new Error('Expected trip-demo-mmd markdown to produce at least one embedded GeoJSON graph-data request')
  }
  const first = reqs[0]
  if (first.codeBlock.lang !== 'geojson') {
    throw new Error(`Expected embedded GeoJSON graph-data request lang=geojson, got ${String(first.codeBlock.lang)}`)
  }
  if (first.sourceDescriptor.kind !== 'code-block') {
    throw new Error(`Expected embedded GeoJSON extraction to attach code-block source descriptors upstream, got ${String(first.sourceDescriptor.kind)}`)
  }
  if (first.featureCollection.type !== 'FeatureCollection') {
    throw new Error(`Expected embedded GeoJSON extraction to attach parsed FeatureCollection payloads upstream, got ${String(first.featureCollection.type)}`)
  }
  const reparsed = resolveMarkdownGeoTextParseResult({ geojsonText: first.codeBlock.text }).featureCollection
  if (!reparsed || reparsed.type !== first.featureCollection.type) {
    throw new Error('Expected embedded GeoJSON graph-data requests to reuse the unified markdown geo parse contract')
  }
  if (!String(first.codeBlock.text || '').includes('"FeatureCollection"')) {
    throw new Error('Expected embedded GeoJSON graph-data request payload to contain FeatureCollection text')
  }
}

export function testMarkdownEmbeddedGeoJsonExtractionReusesUnifiedMarkdownGeoParseHelper() {
  const sourcePath = resolve(process.cwd(), 'src', 'lib', 'markdown', 'embeddedGeoJson.ts')
  const sourceText = readFileSync(sourcePath, 'utf8')
  if (
    !sourceText.includes("import { resolveMarkdownGeoTextParseResult } from '@/features/geospatial/markdownGeoParse'")
    || !sourceText.includes("const parsed = resolveMarkdownGeoTextParseResult({ geojsonText: b.content })")
    || sourceText.includes('parseGeoJsonFeatureCollectionFromText(trimmed)')
    || sourceText.includes('normalizeMarkdownGeoCodeBlockText(b.content)')
  ) {
    throw new Error('Expected embedded GeoJSON extraction to reuse the unified markdown geo parse helper instead of local normalize-and-parse branches')
  }
}
