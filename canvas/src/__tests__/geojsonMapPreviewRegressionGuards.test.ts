import React from 'react'
import { createRoot } from 'react-dom/client'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { InlineMarkdownGeoJsonLayerMap } from '@/features/geospatial/InlineMarkdownGeoJsonLayerMap'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { readMarkdownSlideDemo } from '@/tests/lib/markdownSlideDemo'
import { extractFirstFencedBlock } from '@/tests/lib/markdownFence'

export async function testGeoJsonMapPreviewRendersMapContainerAboveSvgFallback() {
  const raw = readMarkdownSlideDemo()
  if (!raw) return

  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const geojson = extractFirstFencedBlock(raw, 'geojson')
    if (!geojson) throw new Error('Expected sandbox slide demo to include a fenced geojson code block')

    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)

    const root = createRoot(container as unknown as HTMLElement)
    root.render(
      React.createElement(InlineMarkdownGeoJsonLayerMap, {
        geojsonText: geojson,
        datasetId: 'sandbox:geojson:zindex-guard',
        className: 'w-full',
        heightPx: 320,
      }),
    )

    const raf = (cb: () => void) => {
      const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: () => void) => number }
      if (anyWindow.requestAnimationFrame) {
        anyWindow.requestAnimationFrame(cb)
        return
      }
      setTimeout(cb, 0)
    }
    const tick = () => new Promise<void>(resolvePromise => raf(() => resolvePromise()))
    await tick()
    await tick()

    const wrapper = container.firstElementChild as HTMLElement | null
    if (!wrapper) throw new Error('Expected InlineMarkdownGeoJsonLayerMap to render a wrapper element')

    const mapContainer = wrapper.querySelector('[data-testid="geojson-map-container"]') as HTMLElement | null
    if (!mapContainer) throw new Error('Expected InlineMarkdownGeoJsonLayerMap to render a map container')
    if (!String(mapContainer.className || '').includes('z-[1]')) {
      throw new Error(`Expected map container to include z-[1], got "${mapContainer.className}"`)
    }

    const svgLayer = wrapper.querySelector('div.absolute.inset-0.z-0') as HTMLElement | null
    if (!svgLayer) throw new Error('Expected SVG fallback layer to include z-0 and sit below map container')

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}

export async function testGeoJsonMapPreviewSupportsContainerHeightMode() {
  const raw = readMarkdownSlideDemo()
  if (!raw) return

  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const geojson = extractFirstFencedBlock(raw, 'geojson')
    if (!geojson) throw new Error('Expected sandbox slide demo to include a fenced geojson code block')

    const doc = dom.window.document
    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)

    const root = createRoot(container as unknown as HTMLElement)
    root.render(
      React.createElement(InlineMarkdownGeoJsonLayerMap, {
        geojsonText: geojson,
        datasetId: 'sandbox:geojson:container-height',
        className: 'w-full h-full',
        useContainerHeight: true,
      }),
    )

    const raf = (cb: () => void) => {
      const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: () => void) => number }
      if (anyWindow.requestAnimationFrame) {
        anyWindow.requestAnimationFrame(cb)
        return
      }
      setTimeout(cb, 0)
    }
    const tick = () => new Promise<void>(resolvePromise => raf(() => resolvePromise()))
    await tick()
    await tick()

    const wrapper = container.firstElementChild as HTMLElement | null
    if (!wrapper) throw new Error('Expected InlineMarkdownGeoJsonLayerMap to render a wrapper element')
    if (wrapper.style.height !== '100%') {
      throw new Error(`Expected wrapper to use container height (100%), got "${wrapper.style.height}"`)
    }
    if (!wrapper.style.minHeight || wrapper.style.minHeight === '0px') {
      throw new Error(`Expected wrapper to set a non-zero minHeight, got "${wrapper.style.minHeight}"`)
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}

export function testInlineMarkdownGeoJsonMapReusesSharedBasemapHook() {
  const inlinePath = resolve(process.cwd(), 'src', 'features', 'geospatial', 'InlineMarkdownGeoJsonLayerMap.tsx')
  const text = readFileSync(inlinePath, 'utf8')

  if (!text.includes('useMapLibreBasemap')) {
    throw new Error('Expected InlineMarkdownGeoJsonLayerMap to reuse useMapLibreBasemap()')
  }
  if (text.includes('createMapLibreMapWithBasemap')) {
    throw new Error('Expected InlineMarkdownGeoJsonLayerMap to not use createMapLibreMapWithBasemap()')
  }
  if (!text.includes('UI_RESPONSIVE_PASSIVE_BASE_LAYER_SURFACE_CLASSNAME') || text.includes('className="absolute inset-0 z-0 pointer-events-none"')) {
    throw new Error('Expected InlineMarkdownGeoJsonLayerMap to reuse the shared passive base-layer surface class')
  }
}

export function testInlineMarkdownGeoJsonMapAvoidsLiveGeoJsonMapLibreSources() {
  const inlinePath = resolve(process.cwd(), 'src', 'features', 'geospatial', 'InlineMarkdownGeoJsonLayerMap.tsx')
  const text = readFileSync(inlinePath, 'utf8')

  if (text.includes('ensureDatasetLayer(')) {
    throw new Error('Expected InlineMarkdownGeoJsonLayerMap to avoid live MapLibre dataset-layer hydration for GeoJSON previews')
  }
  if (text.includes('setGeoJsonSourceData(')) {
    throw new Error('Expected InlineMarkdownGeoJsonLayerMap to avoid live MapLibre source data writes for GeoJSON previews')
  }
}

export function testMapLibreBasemapBootTimeoutDoesNotRequireStrictStyleLoadedOnly() {
  const p = resolve(process.cwd(), '..', 'gympgrph', 'src', 'features', 'geospatial', 'useMapLibreBasemap.ts')
  const text = readFileSync(p, 'utf8')

  const requiredSnippets = [
    'probe.tilesLoaded',
    'const el = containerRef.current',
    'vectorFallbackMs',
    "Math.max(1_500, Math.floor(vectorFallbackMs))",
  ]
  const missing = requiredSnippets.filter(s => !text.includes(s))
  if (missing.length) {
    const msg = missing.map(s => `missing: ${s}`).join('\n')
    throw new Error(`useMapLibreBasemap regression guard failed:\n${msg}`)
  }
}

export function testHostImportsMapLibreCssForMarkdownGeoJsonPreviews() {
  const loaderPath = resolve(process.cwd(), 'src', 'lib', 'ui', 'lazyStyles.ts')
  const loaderText = readFileSync(loaderPath, 'utf8')
  if (!loaderText.includes("import('maplibre-gl/dist/maplibre-gl.css')")) {
    throw new Error('Expected lazy style loader to include maplibre-gl CSS import')
  }
  const rendererPath = resolve(process.cwd(), 'src', 'features', 'markdown', 'ui', 'codeblock', 'GeoJsonGeoPanelRenderer.tsx')
  const markdownCodeBlockPath = resolve(process.cwd(), 'src', 'features', 'markdown', 'ui', 'MarkdownCodeBlock.tsx')
  const inlinePath = resolve(process.cwd(), 'src', 'features', 'geospatial', 'InlineMarkdownGeoJsonLayerMap.tsx')
  const parsePath = resolve(process.cwd(), 'src', 'features', 'geospatial', 'markdownGeoParse.ts')
  const codeBlockContractPath = resolve(process.cwd(), 'src', 'features', 'geospatial', 'markdownGeoCodeBlockContract.ts')
  const parseContractPath = resolve(process.cwd(), 'src', 'features', 'geospatial', 'markdownGeoParseContract.ts')
  const datasetContractPath = resolve(process.cwd(), 'src', 'features', 'geospatial', 'markdownGeoDatasetContract.ts')
  const clonePath = resolve(process.cwd(), 'src', 'features', 'geospatial', 'markdownGeoClone.ts')
  const snapshotContractPath = resolve(process.cwd(), 'src', 'features', 'geospatial', 'markdownGeoSnapshotContract.ts')
  const rendererTypesPath = resolve(process.cwd(), 'src', 'features', 'markdown', 'ui', 'MarkdownRendererTypes.ts')
  const rendererText = readFileSync(rendererPath, 'utf8')
  const markdownCodeBlockText = readFileSync(markdownCodeBlockPath, 'utf8')
  const inlineText = readFileSync(inlinePath, 'utf8')
  const parseText = readFileSync(parsePath, 'utf8')
  const codeBlockContractText = readFileSync(codeBlockContractPath, 'utf8')
  const parseContractText = readFileSync(parseContractPath, 'utf8')
  const datasetContractText = readFileSync(datasetContractPath, 'utf8')
  const cloneText = readFileSync(clonePath, 'utf8')
  const snapshotContractText = readFileSync(snapshotContractPath, 'utf8')
  const rendererTypesText = readFileSync(rendererTypesPath, 'utf8')
  if (!rendererText.includes('ensureMapLibreStyles')) {
    throw new Error('Expected GeoJsonGeoPanelRenderer to ensure MapLibre styles before map preview rendering')
  }
  if (!rendererText.includes('buildMarkdownGeoDatasetRequestFingerprint')) {
    throw new Error('Expected GeoJsonGeoPanelRenderer to reuse the shared markdown geo request fingerprint helper')
  }
  if (rendererText.includes('trimmed.slice(0, 128)')) {
    throw new Error('Expected GeoJsonGeoPanelRenderer to avoid ad hoc markdown geo auto-register fingerprint strings')
  }
  if (!rendererText.includes('req: MarkdownGeoDatasetRegistrationRequest')) {
    throw new Error('Expected GeoJsonGeoPanelRenderer to accept a shared markdown geo dataset request from upstream callers')
  }
  if (
    !codeBlockContractText.includes("export type MarkdownGeoCodeBlockLanguage = 'geojson' | 'json'")
    || !codeBlockContractText.includes('export type MarkdownGeoCodeBlock = {')
    || !rendererText.includes("import type { MarkdownGeoCodeBlockLanguage } from '@/features/geospatial/markdownGeoCodeBlockContract'")
    || !rendererText.includes('lang: MarkdownGeoCodeBlockLanguage')
    || rendererText.includes("req: { sourceDocumentPath: string; codeBlock: { lang: 'geojson' | 'json'; text: string; startLine: number; endLine: number } }")
  ) {
    throw new Error('Expected markdown geo code-block contracts to live in a dedicated contract module reused by GeoJsonGeoPanelRenderer instead of inline code-block shapes')
  }
  if (!rendererText.includes("import type { MarkdownGeoDatasetRegistrationRequest } from '@/features/geospatial/markdownGeoDatasetContract'")) {
    throw new Error('Expected GeoJsonGeoPanelRenderer to import markdown geo dataset request contracts from the shared geospatial contract module')
  }
  if (rendererText.includes('buildMarkdownGeoDatasetRegistrationRequest')) {
    throw new Error('Expected GeoJsonGeoPanelRenderer to avoid rebuilding markdown geo dataset requests locally')
  }

  if (!markdownCodeBlockText.includes('const markdownGeoReq = React.useMemo(() => {')) {
    throw new Error('Expected MarkdownCodeBlock to build one shared markdown geo request upstream')
  }
  if (!markdownCodeBlockText.includes('const req = markdownGeoReq')) {
    throw new Error('Expected MarkdownCodeBlock geojson eligibility checks to reuse the shared markdown geo request')
  }
  if (!markdownCodeBlockText.includes('req={markdownGeoReq}')) {
    throw new Error('Expected MarkdownCodeBlock to pass the shared markdown geo request into GeoJsonGeoPanelRenderer')
  }

  const integrationPath = resolve(process.cwd(), 'src', 'features', 'geospatial', 'markdownGeoDatasetIntegration.tsx')
  const integrationText = readFileSync(integrationPath, 'utf8')
  if (
    !datasetContractText.includes('export type MarkdownGeoDatasetRegistrationRequest = {')
    || !datasetContractText.includes('codeBlock: MarkdownGeoCodeBlock')
    || !datasetContractText.includes('export type MarkdownGeoDatasetRegistrationResult = {')
    || !datasetContractText.includes('export type MarkdownGeoDatasetIntegration = {')
    || !integrationText.includes("} from './markdownGeoDatasetContract'")
    || !parseText.includes("import type { MarkdownGeoDatasetRegistrationRequest } from './markdownGeoDatasetContract'")
  ) {
    throw new Error('Expected markdown geo dataset request and integration contracts to live in a dedicated geospatial contract module reused by geospatial runtime helpers')
  }
  if (
    !rendererTypesText.includes("} from '@/features/geospatial/markdownGeoDatasetContract'")
    || rendererTypesText.includes('export type MarkdownGeoDatasetRegistrationRequest = {')
    || rendererTypesText.includes('export type MarkdownGeoDatasetRegistrationResult = {')
    || rendererTypesText.includes('export type MarkdownGeoDatasetIntegration = {')
  ) {
    throw new Error('Expected MarkdownRendererTypes to re-export markdown geo dataset contracts instead of defining them locally')
  }
  if (!integrationText.includes('buildMarkdownGeoDatasetRequestFingerprint')) {
    throw new Error('Expected markdownGeoDatasetIntegration to reuse the shared markdown geo request fingerprint helper')
  }
  if (!integrationText.includes('buildMarkdownGeoFeatureCollectionGraphSourceHash')) {
    throw new Error('Expected markdownGeoDatasetIntegration to reuse the shared markdown geo feature-collection graph hash helper')
  }
  if (integrationText.includes('const uploadCacheKey = `${req.codeBlock.lang}:${hashText(trimmed)}:${uploadName}`')) {
    throw new Error('Expected markdownGeoDatasetIntegration to avoid local markdown geo upload cache key strings')
  }
  if (integrationText.includes('sourceHash: buildMarkdownGeoCodeBlockContentHash(req.codeBlock.text)')) {
    throw new Error('Expected markdownGeoDatasetIntegration to avoid code-block text hashing for markdown geo graph source hashes')
  }
  if (integrationText.includes('sourceHash: hashText(trimmed)')) {
    throw new Error('Expected markdownGeoDatasetIntegration to avoid local markdown geo sourceHash hashing')
  }
  if (!integrationText.includes('resolveMarkdownGeoDatasetParseResult')) {
    throw new Error('Expected markdownGeoDatasetIntegration to reuse the shared markdown geo parse resolver')
  }
  if (integrationText.includes('parseGeoJsonFeatureCollectionFromText(trimmed)')) {
    throw new Error('Expected markdownGeoDatasetIntegration to avoid reparsing normalized GeoJSON text locally')
  }
  if (!integrationText.includes('const parsed = resolveMarkdownGeoDatasetParseResult(req)')) {
    throw new Error('Expected markdownGeoDatasetIntegration to resolve a shared markdown geo parse result for preview and actions')
  }
  if (!integrationText.includes('featureCollection: parsed.featureCollection')) {
    throw new Error('Expected markdownGeoDatasetIntegration preview rendering to pass the shared parsed FeatureCollection downstream')
  }
  if (
    !parseText.includes('const requestParseCache = new WeakMap<MarkdownGeoDatasetRegistrationRequest, MarkdownGeoParseResult>()')
    || !parseText.includes('export function resolveMarkdownGeoDatasetParseResult(')
    || !parseText.includes('const result = resolveMarkdownGeoTextParseResult({ geojsonText: req.codeBlock.text })')
    || !parseText.includes("import { cloneMarkdownGeoParseResult } from './markdownGeoClone'")
    || !parseText.includes("MarkdownGeoParseResult,\n  MarkdownGeoTextParseArgs,\n} from './markdownGeoParseContract'")
    || !parseText.includes('if (cached) return cloneMarkdownGeoParseResult(cached)')
    || !parseText.includes('requestParseCache.set(req, cloneMarkdownGeoParseResult(result))')
    || parseText.includes('export function cloneMarkdownGeoParseResult(value: MarkdownGeoParseResult): MarkdownGeoParseResult')
  ) {
    throw new Error('Expected unified markdown geo parse helper to centralize request-scoped parse reuse through one SSOT')
  }
  if (
    !inlineText.includes('featureCollection?: MarkdownGeoParsedFeatureCollection | null')
    || !inlineText.includes('return resolveMarkdownGeoTextParseResult({ geojsonText, featureCollection })')
  ) {
    throw new Error('Expected InlineMarkdownGeoJsonLayerMap to reuse the unified markdown geo text parse helper instead of owning local parse logic')
  }
  if (
    !parseContractText.includes("import type { computeBoundsFromCollections } from 'gympgrph/map-preview'")
    || !parseContractText.includes('export type MarkdownGeoParsedFeatureCollection = FeatureCollection')
    || !parseContractText.includes('export type MarkdownGeoTextParseArgs = {')
    || !parseContractText.includes('export type MarkdownGeoParseBounds = ReturnType<typeof computeBoundsFromCollections>')
    || !parseContractText.includes('export type MarkdownGeoParseResult = MarkdownGeoParseSnapshot')
    || parseContractText.includes('export function resolveMarkdownGeoTextParseResult(')
    || parseContractText.includes('export function resolveMarkdownGeoDatasetParseResult(')
    || parseContractText.includes('export function cloneMarkdownGeoParseResult(')
    || !parseText.includes('export function resolveMarkdownGeoTextParseResult(args: MarkdownGeoTextParseArgs)')
    || !parseText.includes('normalizeMarkdownGeoCodeBlockText(args.geojsonText)')
    || !parseText.includes('parseGeoJsonFeatureCollectionFromText(normalizedText)')
    || !parseText.includes('computeBoundsFromCollections([featureCollection])')
    || !parseText.includes('textHash: normalizedText ? hashText(normalizedText) : \'\'')
    || parseText.includes('export type MarkdownGeoParsedFeatureCollection = FeatureCollection')
    || parseText.includes('export type MarkdownGeoTextParseArgs = {')
    || parseText.includes('export type MarkdownGeoParseBounds = ReturnType<typeof computeBoundsFromCollections>')
  ) {
    throw new Error('Expected unified markdown geo parse helper to centralize normalized text, hash, parsed FeatureCollection, and bounds for direct preview callers')
  }
  if (
    !snapshotContractText.includes('export type MarkdownGeoParseSnapshot')
    || !parseContractText.includes("import type { MarkdownGeoParseSnapshot } from './markdownGeoSnapshotContract'")
    || cloneText.includes('export type MarkdownGeoParseSnapshot')
    || !cloneText.includes('export function cloneMarkdownGeoParseResult')
    || !cloneText.includes('featureCollection: value.featureCollection ? cloneMarkdownGeoFeatureCollection(value.featureCollection) : null')
    || !cloneText.includes('bounds: Array.isArray(value.bounds)')
  ) {
    throw new Error('Expected markdown geo parse snapshot contracts to live in a dedicated snapshot-contract module while markdown geo clone centralizes only parse snapshot clone behavior')
  }
  if (
    !inlineText.includes("import type { MarkdownGeoParsedFeatureCollection } from './markdownGeoParseContract'")
    || !inlineText.includes('featureCollection?: MarkdownGeoParsedFeatureCollection | null')
    || !inlineText.includes('fc: MarkdownGeoParsedFeatureCollection')
    || inlineText.includes("import type { FeatureCollection } from 'geojson'")
  ) {
    throw new Error('Expected InlineMarkdownGeoJsonLayerMap to reuse shared markdown geo parse typings instead of spelling raw FeatureCollection preview types locally')
  }
}
