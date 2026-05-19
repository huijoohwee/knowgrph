import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testGeospatialOverlayGraphDataUsesSemanticCache() {
  const geospatialOverlayPath = resolve(process.cwd(), 'src', 'features', 'geospatial', 'geospatialOverlayGraphData.ts')
  const markdownGeoContentSignaturePath = resolve(process.cwd(), 'src', 'features', 'geospatial', 'markdownGeoContentSignature.ts')
  const markdownGeoSourcePath = resolve(process.cwd(), 'src', 'features', 'geospatial', 'markdownGeoSourcePath.ts')
  const markdownGeoSourceContractPath = resolve(process.cwd(), 'src', 'features', 'geospatial', 'markdownGeoSourceContract.ts')
  const geospatialSourceContextPath = resolve(process.cwd(), 'src', 'features', 'source-files', 'geospatialSourceContext.ts')
  const canvasViewportPath = resolve(process.cwd(), 'src', 'components', 'CanvasViewport.tsx')
  const mainPanelPath = resolve(process.cwd(), 'src', 'features', 'panels', 'MainPanel.tsx')

  const geospatialOverlayText = readFileSync(geospatialOverlayPath, 'utf8')
  const markdownGeoContentSignatureText = readFileSync(markdownGeoContentSignaturePath, 'utf8')
  const markdownGeoSourcePathText = readFileSync(markdownGeoSourcePath, 'utf8')
  const markdownGeoSourceContractText = readFileSync(markdownGeoSourceContractPath, 'utf8')
  const geospatialSourceContextText = readFileSync(geospatialSourceContextPath, 'utf8')
  const canvasViewportText = readFileSync(canvasViewportPath, 'utf8')
  const mainPanelText = readFileSync(mainPanelPath, 'utf8')

  if (
    !geospatialOverlayText.includes('const geospatialOverlayGraphCache = new Map<string, GraphData>()')
    || !geospatialOverlayText.includes('const geospatialOverlaySupplementGraphCache = new Map<string, GraphData>()')
    || !geospatialOverlayText.includes("buildScopedGraphSemanticKey('geospatial-overlay-base-graph'")
    || !geospatialOverlayText.includes('buildSourceFilesGeospatialSelectionSignature')
    || !geospatialOverlayText.includes('const readGeoNodeSemanticKey = (node: GraphNode | null | undefined): string | null => {')
    || !geospatialOverlayText.includes('const buildGraphNodeDedupKeySet = (nodes: GraphNode[]): Set<string> => {')
    || !geospatialOverlayText.includes('const buildGeospatialOverlaySupplementGraphCacheKey = (args: {')
    || !geospatialOverlayText.includes('const buildMarkdownGeodataSupplementGraph = (args: {')
    || !geospatialOverlayText.includes('resolveGeospatialSourceContext')
    || !geospatialOverlayText.includes('buildMarkdownGeodataAnalysisCacheSignature')
    || !geospatialOverlayText.includes('buildMarkdownGeodataCandidateProfile')
    || !geospatialOverlayText.includes('buildMarkdownGeoFeatureCollectionGraphSourceHash')
    || !geospatialOverlayText.includes('geodataAnalysis: MarkdownGeodataAnalysis')
    || !geospatialOverlayText.includes('candidateProfile: geodataCandidateProfile')
    || !geospatialOverlayText.includes('cacheSignature: geodataAnalysisCacheSignature')
    || !geospatialOverlayText.includes("const { featureCollection: fc, sourceDescriptor } = geodataAnalysis.poiFeatureCollections[i]!")
    || !geospatialOverlayText.includes('featureCollection: req.featureCollection')
    || !geospatialOverlayText.includes('sourcePath: req.sourceDescriptor.sourcePath')
    || !geospatialOverlayText.includes('const resolvedOverlayContext = resolveGeospatialSourceContext(args)')
    || !geospatialOverlayText.includes('const cacheKey = buildGeospatialOverlayGraphCacheKey(args)')
    || !geospatialOverlayText.includes('const cached = readCachedGeospatialOverlayGraphData(cacheKey)')
    || geospatialOverlayText.includes('const resolveGeospatialOverlayContext = (args: {')
    || geospatialOverlayText.includes('#markdown-table-geodata-')
    || geospatialOverlayText.includes('#overlay')
    || geospatialOverlayText.includes('const markdownContext = resolveMarkdownContext(args)')
    || geospatialOverlayText.includes('markdownText ? hashText(markdownText) :')
    || geospatialOverlayText.includes('hashText(args.markdownText)')
    || geospatialOverlayText.includes('analyzeMarkdownGeodataSources({\n    markdownText: args.markdownText')
    || geospatialOverlayText.includes('buildMarkdownGeoCodeBlockGraphSourceDescriptor(')
    || geospatialOverlayText.includes('buildMarkdownGeoTableGraphSourceDescriptor(')
    || geospatialOverlayText.includes('parseGeoJsonFeatureCollectionFromText(String(req.codeBlock.text || \'\'))')
  ) {
    throw new Error('expected geospatial overlay graph data helper to cache by semantic graph and source-file signatures while consuming upstream markdown geo descriptors and parsed FeatureCollections directly')
  }

  if (
    !markdownGeoContentSignatureText.includes('export function normalizeMarkdownGeoCodeBlockText(raw: unknown): string {')
    || !markdownGeoContentSignatureText.includes('export function buildMarkdownGeoCodeBlockContentHash(raw: unknown): string {')
    || !markdownGeoContentSignatureText.includes('export function buildMarkdownGeoFeatureCollectionGraphSourceHash(')
  ) {
    throw new Error('expected shared markdown geo content-signature helper to centralize normalized code-block hashing and feature-collection graph hashing upstream')
  }

  if (
    !markdownGeoSourceContractText.includes("export type MarkdownGeoGraphSourceKind = 'code-block' | 'table'")
    || !markdownGeoSourceContractText.includes('export type MarkdownGeoGraphSourceDescriptor = {')
    || !markdownGeoSourcePathText.includes("import type { MarkdownGeoGraphSourceDescriptor } from './markdownGeoSourceContract'")
    || markdownGeoSourcePathText.includes("export type MarkdownGeoGraphSourceKind = 'code-block' | 'table'")
    || markdownGeoSourcePathText.includes('export type MarkdownGeoGraphSourceDescriptor = {')
    || !markdownGeoSourcePathText.includes('export function buildMarkdownGeoCodeBlockGraphSourceDescriptor(')
    || !markdownGeoSourcePathText.includes('export function buildMarkdownGeoTableGraphSourceDescriptor(args: {')
    || !markdownGeoSourcePathText.includes('export function buildMarkdownGeoCodeBlockGraphSourcePath(')
    || !markdownGeoSourcePathText.includes('export function buildMarkdownGeoTableGraphSourcePath(args: {')
    || !markdownGeoSourcePathText.includes('#markdown-geo-table-L')
  ) {
    throw new Error('expected shared markdown geo source-path helper to centralize explicit source-kind metadata and source-path naming upstream')
  }

  if (
    !geospatialSourceContextText.includes('export const isGeospatialSourceFileEligible = (file: SourceFile | null | undefined): boolean => {')
    || !geospatialSourceContextText.includes('export function resolvePreferredGeospatialSourceFile(args: {')
    || !geospatialSourceContextText.includes('export function resolveGeospatialSourceContext(args: {')
    || !geospatialSourceContextText.includes('const findUniqueEligibleGeospatialSourceFileByNormalizedPath = (')
    || !geospatialSourceContextText.includes('const findUniqueEligibleGeospatialSourceFileByBasename = (')
  ) {
    throw new Error('expected shared geospatial source-context helper to centralize geo eligibility and semantic source-file matching')
  }

  if (!canvasViewportText.includes('graphRevision: graphDataRevision')) {
    throw new Error('expected CanvasViewport geospatial overlay call to pass graph revision into the shared semantic cache helper')
  }

  if (
    !mainPanelText.includes("cacheScope: 'main-panel-traversal-graph'")
    || !mainPanelText.includes('getCachedGraphLookup({')
    || !mainPanelText.includes("hashScopedStringArraySignature('main-panel-traversal-edge-ids'")
  ) {
    throw new Error('expected MainPanel traversal chip to reuse shared graph lookup and semantic edge-id signatures instead of rescanning raw graph edges')
  }
}
