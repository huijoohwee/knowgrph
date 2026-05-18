import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  analyzeMarkdownGeodataSources,
  buildMarkdownGeodataAnalysisCacheSignature,
  buildMarkdownGeodataCandidateProfile,
} from '@/lib/markdown/markdownGeodataAnalysis'
import { buildMarkdownGeoDatasetGraphSourcePath } from '@/features/geospatial/markdownGeoDatasetRequest'
import { cloneMarkdownGeoAnalysis, cloneMarkdownGeoFeatureCollection } from '@/features/geospatial/markdownGeoClone'

export function testMarkdownGeodataAnalysisExtractsEmbeddedGeoJsonAndPoiTablesTogether() {
  const markdownText = [
    '---',
    'kgCanvasSurfaceMode: "geospatial"',
    '---',
    '',
    '```geojson',
    '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Fence A"},"geometry":{"type":"Point","coordinates":[103.851959,1.29027]}}]}',
    '```',
    '',
    '| # | name | poi_id | location (lat,lng) |',
    '| --- | --- | --- | --- |',
    '| 1 | Table A | poi-1 | 1.2801, 103.8502 |',
    '',
  ].join('\n')

  const analysis = analyzeMarkdownGeodataSources({
    markdownText,
    sourceDocumentPath: 'workspace:/analysis/markdown-geodata.md',
    embeddedGeoLimit: 8,
    poiTableLimit: 3,
    poiRowLimit: 50,
  })

  if (analysis.embeddedGeoJsonGraphDataRequests.length !== 1) {
    throw new Error(`expected one embedded GeoJSON request, got ${analysis.embeddedGeoJsonGraphDataRequests.length}`)
  }
  if (analysis.embeddedGeoJsonGraphDataRequests[0]?.featureCollection.type !== 'FeatureCollection') {
    throw new Error('expected shared markdown geodata analysis to preserve parsed embedded FeatureCollection payloads upstream')
  }
  if (analysis.embeddedGeoBlockCount !== 1) {
    throw new Error(`expected embeddedGeoBlockCount=1, got ${analysis.embeddedGeoBlockCount}`)
  }
  if (analysis.poiFeatureCollections.length !== 1) {
    throw new Error(`expected one POI feature collection, got ${analysis.poiFeatureCollections.length}`)
  }
  const tableEntry = analysis.poiFeatureCollections[0]
  if (tableEntry?.sourceDescriptor.kind !== 'table') {
    throw new Error(`expected shared markdown geodata analysis to carry table source descriptors upstream, got ${String(tableEntry?.sourceDescriptor.kind)}`)
  }
  const tableFeatures = tableEntry?.featureCollection.features || []
  if (tableFeatures.length !== 1) {
    throw new Error(`expected one POI table feature, got ${tableFeatures.length}`)
  }
}

export function testMarkdownGeodataAnalysisReusesSharedAnalyzerUpstream() {
  const markdownText = [
    '```geojson',
    '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Fence B"},"geometry":{"type":"Point","coordinates":[103.85,1.29]}}]}',
    '```',
    '',
    '| name | location (lat,lng) |',
    '| --- | --- |',
    '| Table B | 1.3000, 103.8000 |',
    '',
  ].join('\n')
  const args = {
    markdownText,
    sourceDocumentPath: 'workspace:/analysis/shared-cache.md',
    embeddedGeoLimit: 8,
    poiTableLimit: 3,
    poiRowLimit: 50,
  } as const
  const first = analyzeMarkdownGeodataSources(args)
  const second = analyzeMarkdownGeodataSources(args)

  if (first === second) {
    throw new Error('expected analyzer to return cloned results rather than shared mutable references')
  }
  if (first.embeddedGeoJsonGraphDataRequests.length !== second.embeddedGeoJsonGraphDataRequests.length) {
    throw new Error('expected shared analyzer cache reuse to preserve embedded GeoJSON request counts')
  }
  if (first.embeddedGeoJsonGraphDataRequests[0] === second.embeddedGeoJsonGraphDataRequests[0]) {
    throw new Error('expected shared analyzer cache reuse to clone embedded GeoJSON request objects rather than sharing mutable references')
  }
  if (first.poiFeatureCollections.length !== second.poiFeatureCollections.length) {
    throw new Error('expected shared analyzer cache reuse to preserve POI feature collection counts')
  }
  const firstEmbeddedFeatureCollection = first.embeddedGeoJsonGraphDataRequests[0]?.featureCollection
  const secondEmbeddedFeatureCollection = second.embeddedGeoJsonGraphDataRequests[0]?.featureCollection
  if (!firstEmbeddedFeatureCollection || !secondEmbeddedFeatureCollection) {
    throw new Error('expected shared analyzer cache reuse to preserve embedded GeoJSON FeatureCollection payloads')
  }
  if (firstEmbeddedFeatureCollection === secondEmbeddedFeatureCollection) {
    throw new Error('expected shared analyzer cache reuse to clone embedded GeoJSON FeatureCollection payloads rather than sharing mutable references')
  }
  const cloned = cloneMarkdownGeoFeatureCollection(firstEmbeddedFeatureCollection)
  if (cloned === firstEmbeddedFeatureCollection || cloned.features === firstEmbeddedFeatureCollection.features) {
    throw new Error('expected shared markdown geo clone helper to return graph-safe FeatureCollection copies')
  }
  const clonedAnalysis = cloneMarkdownGeoAnalysis(first)
  if (
    clonedAnalysis === first
    || clonedAnalysis.embeddedGeoJsonGraphDataRequests === first.embeddedGeoJsonGraphDataRequests
    || clonedAnalysis.poiFeatureCollections === first.poiFeatureCollections
  ) {
    throw new Error('expected shared markdown geo cache clone helper to return fresh analysis wrapper objects')
  }
}

export function testMarkdownGeodataAnalysisUsesCandidateSignatureBeforeFullTextHashing() {
  const plainA = 'Plain source file without map data.\n'.repeat(120)
  const plainB = 'Neutral source text without geo.\n'.repeat(120)
  const plainProfile = buildMarkdownGeodataCandidateProfile(plainA)
  if (plainProfile.mayContainEmbeddedGeoJson || plainProfile.mayContainPoiTables || !plainProfile.textSignature.startsWith('plain:')) {
    throw new Error('expected plain markdown geodata candidate profiling to avoid full content hashing')
  }

  const plainASignature = buildMarkdownGeodataAnalysisCacheSignature({
    markdownText: plainA,
    sourceDocumentPath: 'workspace:/analysis/plain.md',
  })
  const plainBSignature = buildMarkdownGeodataAnalysisCacheSignature({
    markdownText: plainB.padEnd(plainA.length, '.').slice(0, plainA.length),
    sourceDocumentPath: 'workspace:/analysis/plain.md',
  })
  if (plainASignature !== plainBSignature) {
    throw new Error('expected non-geospatial markdown signatures to be candidate-based instead of full-text-hash based')
  }

  const geoText = [
    '```geojson',
    '{"type":"FeatureCollection","features":[]}',
    '```',
  ].join('\n')
  const geoProfile = buildMarkdownGeodataCandidateProfile(geoText)
  if (!geoProfile.mayContainEmbeddedGeoJson || !geoProfile.textSignature.startsWith('geo:')) {
    throw new Error('expected geospatial markdown candidate profiling to include a content hash only when map data markers exist')
  }
}

export function testMarkdownGeodataAnalysisNormalizesCanonicalSourceDocumentIdentity() {
  const markdownText = [
    '```geojson',
    '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Fence C"},"geometry":{"type":"Point","coordinates":[103.81,1.31]}}]}',
    '```',
    '',
    '| name | location (lat,lng) |',
    '| --- | --- |',
    '| Table C | 1.3100, 103.8100 |',
    '',
  ].join('\n')

  const workspaceStyle = analyzeMarkdownGeodataSources({
    markdownText,
    sourceDocumentPath: 'workspace:/analysis/canonical-path.md#panel',
    embeddedGeoLimit: 8,
    poiTableLimit: 3,
    poiRowLimit: 50,
  })
  const relativeStyle = analyzeMarkdownGeodataSources({
    markdownText,
    sourceDocumentPath: 'analysis/canonical-path.md',
    embeddedGeoLimit: 8,
    poiTableLimit: 3,
    poiRowLimit: 50,
  })

  const embeddedPath = workspaceStyle.embeddedGeoJsonGraphDataRequests[0]?.sourceDocumentPath || ''
  if (embeddedPath !== '/analysis/canonical-path.md') {
    throw new Error(`expected markdown geodata analysis to normalize embedded GeoJSON document identities upstream, got ${embeddedPath}`)
  }
  const embeddedSourcePath = workspaceStyle.embeddedGeoJsonGraphDataRequests[0]?.sourceDescriptor.sourcePath || ''
  if (embeddedSourcePath !== '/analysis/canonical-path.md#L1-L3') {
    throw new Error(`expected markdown geodata analysis to carry canonical embedded GeoJSON source descriptors upstream, got ${embeddedSourcePath}`)
  }
  const relativeEmbeddedPath = relativeStyle.embeddedGeoJsonGraphDataRequests[0]?.sourceDocumentPath || ''
  if (relativeEmbeddedPath !== embeddedPath) {
    throw new Error('expected equivalent source document paths to converge on one canonical embedded GeoJSON identity')
  }
  const relativeEmbeddedSourcePath = relativeStyle.embeddedGeoJsonGraphDataRequests[0]?.sourceDescriptor.sourcePath || ''
  if (relativeEmbeddedSourcePath !== embeddedSourcePath) {
    throw new Error('expected equivalent source document paths to converge on one canonical embedded GeoJSON source descriptor')
  }

  const poiPath = String(workspaceStyle.poiFeatureCollections[0]?.featureCollection.features[0]?.properties?.kgSourceDocumentPath || '')
  if (poiPath !== '/analysis/canonical-path.md') {
    throw new Error(`expected markdown geodata analysis to normalize POI document identities upstream, got ${poiPath}`)
  }
  const poiSourcePath = workspaceStyle.poiFeatureCollections[0]?.sourceDescriptor.sourcePath || ''
  if (poiSourcePath !== '/analysis/canonical-path.md#markdown-geo-table-L5') {
    throw new Error(`expected markdown geodata analysis to carry canonical POI table source descriptors upstream, got ${poiSourcePath}`)
  }
  const relativePoiPath = String(relativeStyle.poiFeatureCollections[0]?.featureCollection.features[0]?.properties?.kgSourceDocumentPath || '')
  if (relativePoiPath !== poiPath) {
    throw new Error('expected equivalent source document paths to reuse one canonical POI document identity')
  }
  const relativePoiSourcePath = relativeStyle.poiFeatureCollections[0]?.sourceDescriptor.sourcePath || ''
  if (relativePoiSourcePath !== poiSourcePath) {
    throw new Error('expected equivalent source document paths to reuse one canonical POI table source descriptor')
  }
}

export function testMarkdownGeodataAnalysisSharesCanonicalLineRangeIdentityWithDatasetGraphSourcePaths() {
  const markdownText = [
    'Intro',
    '',
    '```geojson',
    '{"type":"FeatureCollection","features":[{"type":"Feature","properties":{"name":"Fence D"},"geometry":{"type":"Point","coordinates":[103.82,1.32]}}]}',
    '```',
    '',
  ].join('\n')

  const analysis = analyzeMarkdownGeodataSources({
    markdownText,
    sourceDocumentPath: 'workspace:/analysis/line-range-contract.md#preview',
    embeddedGeoLimit: 8,
    poiTableLimit: 3,
    poiRowLimit: 50,
  })

  const request = analysis.embeddedGeoJsonGraphDataRequests[0]
  if (!request) {
    throw new Error('expected markdown geodata analysis to produce one embedded GeoJSON request for line-range identity testing')
  }
  if (request.sourceDescriptor.kind !== 'code-block') {
    throw new Error(`expected markdown geodata analysis to preserve code-block source kind upstream, got ${String(request.sourceDescriptor.kind)}`)
  }
  if (request.featureCollection.type !== 'FeatureCollection') {
    throw new Error('expected markdown geodata analysis to preserve parsed embedded GeoJSON FeatureCollection payloads upstream')
  }

  const graphSourcePath = buildMarkdownGeoDatasetGraphSourcePath({
    sourceDocumentPath: request.sourceDocumentPath,
    codeBlock: request.codeBlock,
  })
  if (graphSourcePath !== '/analysis/line-range-contract.md#L3-L5') {
    throw new Error(`expected shared markdown geo helpers to derive one canonical graph source path, got ${graphSourcePath}`)
  }
  if (request.sourceDescriptor.sourcePath !== graphSourcePath) {
    throw new Error('expected markdown geodata analysis to reuse the canonical dataset graph source path in its embedded source descriptor')
  }
}

export function testMarkdownGeodataAnalysisMergesSemanticGeoMetadataFromLaterMarkdownTables() {
  const markdownText = [
    '## Candidates',
    '',
    '| Area | Coordinates (`lat, lng`) | Region Type |',
    '| --- | --- | --- |',
    '| Punggol | `1.4053, 103.9070` | New town |',
    '| Woodlands | `1.4416, 103.7951` | Regional centre |',
    '',
    '## Scores',
    '',
    '| Rank | Location | C* | Decisive signal |',
    '| --- | --- | --- | --- |',
    '| 1 | Punggol | 0.78 | Young growing demographic |',
    '| 2 | Woodlands | 0.71 | Causeway commuter flow |',
    '',
  ].join('\n')

  const analysis = analyzeMarkdownGeodataSources({
    markdownText,
    sourceDocumentPath: 'workspace:/analysis/semantic-geo-merge.md',
    embeddedGeoLimit: 8,
    poiTableLimit: 6,
    poiRowLimit: 50,
  })

  const tableEntry = analysis.poiFeatureCollections[0]
  if (!tableEntry || tableEntry.sourceDescriptor.kind !== 'table') {
    throw new Error('Expected semantic geo merge analysis to preserve canonical table source descriptors upstream')
  }
  const features = tableEntry.featureCollection.features || []
  if (features.length !== 2) {
    throw new Error(`expected two coordinate-derived semantic geo features, got ${features.length}`)
  }
  const punggol = features.find(feature => String(feature.properties?.name || '') === 'Punggol')
  if (!punggol) {
    throw new Error('Expected semantic geo merge analysis to preserve the original coordinate-derived place feature')
  }
  if (String(punggol.properties?.['C*'] || '') !== '0.78') {
    throw new Error('Expected semantic geo merge analysis to merge later score-table values into the canonical place feature')
  }
  if (String(punggol.properties?.['Decisive signal'] || '') !== 'Young growing demographic') {
    throw new Error('Expected semantic geo merge analysis to merge later qualitative geo metadata into the canonical place feature')
  }
}

export function testMarkdownGeodataAnalysisRespectsLimitSensitivePoiExtractionCache() {
  const markdownText = [
    '## Candidates',
    '',
    '| Area | Coordinates (`lat, lng`) |',
    '| --- | --- |',
    '| Punggol | `1.4053, 103.9070` |',
    '| Woodlands | `1.4416, 103.7951` |',
    '| Bukit Panjang | `1.3767, 103.7626` |',
    '',
  ].join('\n')

  const narrow = analyzeMarkdownGeodataSources({
    markdownText,
    sourceDocumentPath: 'workspace:/analysis/limit-sensitive-cache.md',
    embeddedGeoLimit: 8,
    poiTableLimit: 1,
    poiRowLimit: 1,
  })
  const wide = analyzeMarkdownGeodataSources({
    markdownText,
    sourceDocumentPath: 'workspace:/analysis/limit-sensitive-cache.md',
    embeddedGeoLimit: 8,
    poiTableLimit: 1,
    poiRowLimit: 10,
  })

  const narrowCount = narrow.poiFeatureCollections[0]?.featureCollection.features.length || 0
  const wideCount = wide.poiFeatureCollections[0]?.featureCollection.features.length || 0
  if (narrowCount !== 1) {
    throw new Error(`expected narrow geodata analysis to honor poiRowLimit=1, got ${narrowCount}`)
  }
  if (wideCount !== 3) {
    throw new Error(`expected wider geodata analysis to bypass stale POI cache entries and return all three rows, got ${wideCount}`)
  }
}

export function testMarkdownGeodataAnalysisAndEmbeddedExtractionReuseSharedMarkdownGeoCloneHelper() {
  const analysisPath = resolve(process.cwd(), 'src', 'lib', 'markdown', 'markdownGeodataAnalysis.ts')
  const embeddedPath = resolve(process.cwd(), 'src', 'lib', 'markdown', 'embeddedGeoJson.ts')
  const clonePath = resolve(process.cwd(), 'src', 'features', 'geospatial', 'markdownGeoClone.ts')
  const codeBlockContractPath = resolve(process.cwd(), 'src', 'features', 'geospatial', 'markdownGeoCodeBlockContract.ts')
  const sourceContractPath = resolve(process.cwd(), 'src', 'features', 'geospatial', 'markdownGeoSourceContract.ts')
  const snapshotContractPath = resolve(process.cwd(), 'src', 'features', 'geospatial', 'markdownGeoSnapshotContract.ts')
  const analysisText = readFileSync(analysisPath, 'utf8')
  const embeddedText = readFileSync(embeddedPath, 'utf8')
  const cloneText = readFileSync(clonePath, 'utf8')
  const codeBlockContractText = readFileSync(codeBlockContractPath, 'utf8')
  const sourceContractText = readFileSync(sourceContractPath, 'utf8')
  const snapshotContractText = readFileSync(snapshotContractPath, 'utf8')

  if (
    !analysisText.includes("import { cloneMarkdownGeoAnalysis } from '@/features/geospatial/markdownGeoClone'")
    || !analysisText.includes('if (cached) return cloneMarkdownGeoAnalysis(cached)')
    || !analysisText.includes('return cloneMarkdownGeoAnalysis(result)')
    || analysisText.includes('const cloneAnalysis = (')
    || analysisText.includes('as MarkdownGeodataAnalysis')
  ) {
    throw new Error('expected markdown geodata analysis to reuse the shared markdown geo cache clone helper')
  }
  if (
    !embeddedText.includes("import { cloneMarkdownGeoEmbeddedBlocks } from '@/features/geospatial/markdownGeoClone'")
    || !embeddedText.includes('if (cached) return cloneMarkdownGeoEmbeddedBlocks(cached)')
    || !embeddedText.includes('return cloneMarkdownGeoEmbeddedBlocks(out)')
    || embeddedText.includes('const cloneBlocks = (')
    || embeddedText.includes('as EmbeddedGeoJsonBlock[]')
  ) {
    throw new Error('expected embedded GeoJSON extraction to reuse the shared markdown geo cache clone helper')
  }
  if (
    !codeBlockContractText.includes("export type MarkdownGeoCodeBlockLanguage = 'geojson' | 'json'")
    || !codeBlockContractText.includes('export type MarkdownGeoCodeBlock = {')
    || !codeBlockContractText.includes("export type MarkdownGeoEmbeddedCodeBlock = Omit<MarkdownGeoCodeBlock, 'lang'> & {")
    || !snapshotContractText.includes("import type { MarkdownGeoEmbeddedCodeBlock } from './markdownGeoCodeBlockContract'")
  ) {
    throw new Error('expected markdown geo code-block contracts to live in a dedicated code-block contract module and be reused by the snapshot-contract module')
  }
  if (
    !sourceContractText.includes("export type MarkdownGeoGraphSourceKind = 'code-block' | 'table'")
    || !sourceContractText.includes('export type MarkdownGeoGraphSourceDescriptor = {')
    || !snapshotContractText.includes("import type { MarkdownGeoGraphSourceDescriptor } from './markdownGeoSourceContract'")
    || cloneText.includes("import type { MarkdownGeoGraphSourceDescriptor } from './markdownGeoSourceContract'")
    || cloneText.includes("import type { MarkdownGeoGraphSourceDescriptor } from './markdownGeoSourcePath'")
  ) {
    throw new Error('expected markdown geo graph source descriptor contracts to live in a dedicated source-contract module and be reused by the snapshot-contract module')
  }
  if (
    !snapshotContractText.includes('export type MarkdownGeoEmbeddedBlock')
    || !snapshotContractText.includes('export type MarkdownGeoEmbeddedRequest')
    || !snapshotContractText.includes('export type MarkdownGeoPoiFeatureCollectionEntry')
    || !snapshotContractText.includes('export type MarkdownGeoAnalysisSnapshot')
    || !snapshotContractText.includes('export type MarkdownGeoParseSnapshot')
    || !cloneText.includes("} from './markdownGeoSnapshotContract'")
    || cloneText.includes('export type MarkdownGeoEmbeddedBlock')
    || cloneText.includes('export type MarkdownGeoEmbeddedRequest')
    || cloneText.includes('export type MarkdownGeoPoiFeatureCollectionEntry')
    || cloneText.includes('export type MarkdownGeoAnalysisSnapshot')
    || cloneText.includes('export type MarkdownGeoParseSnapshot')
    || !cloneText.includes('export function cloneMarkdownGeoEmbeddedBlocks')
    || !cloneText.includes('export function cloneMarkdownGeoAnalysis')
    || !cloneText.includes('export function cloneMarkdownGeoParseResult')
    || !cloneText.includes('embeddedGeoJsonGraphDataRequests: cloneMarkdownGeoEmbeddedRequests(value.embeddedGeoJsonGraphDataRequests)')
    || !cloneText.includes('poiFeatureCollections: cloneMarkdownGeoPoiEntries(value.poiFeatureCollections)')
  ) {
    throw new Error('expected markdown geo snapshot contracts to live in a dedicated snapshot-contract module while markdown geo clone centralizes only cache-safe cloning implementations')
  }
}
