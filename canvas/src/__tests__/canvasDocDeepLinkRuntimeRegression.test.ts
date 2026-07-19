import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => fs.readFileSync(absPath, { encoding: 'utf8' })

export const testCanvasDocDeepLinkSelectsDocumentBeforePassiveGraphApply = () => {
  const text = readUtf8(path.resolve(process.cwd(), 'src', 'features', 'canvas', 'CanvasDocDeepLinkRuntime.tsx'))
  const canvasViewportText = readUtf8(path.resolve(process.cwd(), 'src', 'components', 'CanvasViewport.tsx'))
  const helperText = readUtf8(path.resolve(process.cwd(), 'src', 'features', 'canvas', 'canvasDocDeepLink.ts'))
  const shareTokenText = readUtf8(path.resolve(process.cwd(), 'src', 'features', 'canvas', 'canvasDocShareToken.mjs'))
  const explorerStoreText = readUtf8(path.resolve(process.cwd(), 'src', 'features', 'markdown-explorer', 'store.ts'))
  if (!text.includes("from './canvasDocDeepLink'")) {
    throw new Error('Expected document deep links to use the shared parser/URL helper')
  }
  if (!text.includes("import { useSourceFilesBootstrapReady } from '@/features/source-files/sourceFilesBootstrapReadiness'")) {
    throw new Error('Expected document deep links to use the shared Source Files bootstrap readiness owner')
  }
  const bootstrapReadyHookIndex = text.indexOf('const sourceFilesBootstrapReady = useSourceFilesBootstrapReady()')
  const bootstrapReadyGuardIndex = text.indexOf('if (!sourceFilesBootstrapReady) return')
  const liveSearchIndex = text.indexOf("const currentSearch = typeof window !== 'undefined'")
  const parseDeepLinkIndex = text.indexOf('const link = parseDocDeepLink(currentSearch)')
  const consumeDeepLinkIndex = text.indexOf('consumeDeepLinkParams(currentSearch)')
  if (
    bootstrapReadyHookIndex < 0
    || bootstrapReadyGuardIndex < 0
    || liveSearchIndex < 0
    || parseDeepLinkIndex < 0
    || consumeDeepLinkIndex < 0
    || bootstrapReadyHookIndex > bootstrapReadyGuardIndex
    || bootstrapReadyGuardIndex > liveSearchIndex
    || bootstrapReadyGuardIndex > parseDeepLinkIndex
    || bootstrapReadyGuardIndex > consumeDeepLinkIndex
  ) {
    throw new Error('Expected document deep links to remain unconsumed until persisted Source Files startup finishes')
  }
  if (!text.includes('[search, pushUiToast, sourceFilesBootstrapReady]')) {
    throw new Error('Expected Source Files bootstrap readiness to re-run deferred document deep links')
  }
  if (!explorerStoreText.includes('readLocalDocDeepLinkPathFromCurrentLocation()')) {
    throw new Error('Expected markdown explorer startup to prefer a live local document deep link before persisted active path')
  }
  if (text.includes("import('@/lib/markdown-workspace-runtime/workspaceSwitchPreset')") || text.includes('applyCanvasWorkspacePresetForSwitch')) {
    throw new Error('Expected local document deep links not to pre-apply YAML canvas presets before active document graph ownership changes')
  }
  const selectIndex = text.indexOf('setActivePath(targetPath)')
  const graphApplyIndex = text.indexOf('applyActiveMarkdownDocumentPayload({')
  if (selectIndex < 0 || graphApplyIndex < 0 || selectIndex > graphApplyIndex) {
    throw new Error('Expected local document deep links to select the target path before non-blocking graph work')
  }
  const selectionSourceIndex = text.indexOf("setSelectionSource('editor')")
  const clearNodeIndex = text.indexOf('selectNode(null)')
  const clearEdgeIndex = text.indexOf('selectEdge(null)')
  if (
    selectionSourceIndex < 0 ||
    clearNodeIndex < 0 ||
    clearEdgeIndex < 0 ||
    selectionSourceIndex > selectIndex ||
    clearNodeIndex > selectIndex ||
    clearEdgeIndex > selectIndex
  ) {
    throw new Error('Expected local document deep links to neutralize stale canvas selection before selecting the target path')
  }
  if (!text.includes("import('@/features/markdown/activeMarkdownDocument')")) {
    throw new Error('Expected local document deep links to reuse the shared active markdown document apply helper')
  }
  if (!text.includes('name: workspaceDocumentKey(targetPath)')) {
    throw new Error('Expected local document deep links to use canonical workspace document keys')
  }
  if (!text.includes('applyToGraph: options.applyToGraph') || !text.includes('normalizeWebpageFrontmatterToMarkdown: false')) {
    throw new Error('Expected local document deep links to keep graph application under the explicit preview option')
  }
  if (!text.includes("get('kgPreview') === '1'") || !text.includes('applyToGraph: previewRequested')) {
    throw new Error('Expected source-addressed canvas preview links to hydrate their graph while normal local document links stay passive')
  }
  if (!text.includes('forceApplyToGraph: options.applyToGraph')) {
    throw new Error('Expected repeated preview links to force the selected source graph into the embedded canvas')
  }
  if (!canvasViewportText.includes("get('kgLiveHero') === '1'") || !canvasViewportText.includes('deriveLiveCanvasHeroCommandRouteGraph(safeGraphData)')) {
    throw new Error('Expected Live Canvas Hero embeds to reuse the exact source-derived command-route projection at the viewport boundary')
  }
  if (!canvasViewportText.includes('data-kg-live-canvas-hero-embed-preview="true"') || !canvasViewportText.includes('canvas2dRendererOverride="flow"')) {
    throw new Error('Expected Live Canvas Hero embeds to own a dedicated interactive Flow renderer')
  }
  if (!canvasViewportText.includes('graphDataOverride={liveCanvasHeroEmbedGraph}') || !canvasViewportText.includes('mutationSourceGraphDataOverride={safeGraphData}')) {
    throw new Error('Expected the embedded Flow renderer to retain source-derived display and interaction ownership across hydration')
  }
  if (text.includes('consumedRef') || text.includes('consumedSearchRef')) {
    throw new Error('Expected document deep-link consumption to avoid stale one-shot latches')
  }
  if (!text.includes('window.location.search') || !text.includes('parseDocDeepLink(currentSearch)')) {
    throw new Error('Expected document deep-link parsing to use the live URL search instead of a stale router prop snapshot')
  }
  if (!helperText.includes("window.dispatchEvent(new PopStateEvent('popstate'") || !helperText.includes("window.dispatchEvent(new Event('popstate'))")) {
    throw new Error('Expected document deep-link consumption to notify the router after URL cleanup')
  }
  if (!helperText.includes("const DEFAULT_DEEP_LINK_PREFIX = '/doc-default/'")) {
    throw new Error('Expected document deep-link helpers to support default-workspace share routes')
  }
  if (!helperText.includes('buildPublishedDocShareUrlFromSource')) {
    throw new Error('Expected published Share URL generation to reuse the shared document deep-link helper')
  }
  if (!helperText.includes('buildPublishedDocCanvasEmbedUrlFromSource') || !helperText.includes('appendCanvasPreviewParam')) {
    throw new Error('Expected canvas embed URL generation to reuse the shared document deep-link helper and preview-param appender')
  }
  if (!helperText.includes('buildPublishedDocShareDeepLink')) {
    throw new Error('Expected published Share URL generation to prefer the canonical opaque share-route builder')
  }
  if (!shareTokenText.includes('PUBLISHED_DOC_SHARE_TOKEN_PARAM = "kgShare"') || !helperText.includes('encodePublishedDocShareToken')) {
    throw new Error('Expected published Share URL generation to use the shared opaque share-token contract')
  }
  if (!helperText.includes("const SHARE_DEEP_LINK_PREFIX = '/share/'")) {
    throw new Error('Expected published Share URL generation to expose the canonical opaque share path')
  }
  if (!helperText.includes("const CANVAS_PREVIEW_PARAM = 'kgPreview'")) {
    throw new Error('Expected canvas embed URL generation to expose the canonical embedded-preview query param')
  }
  if (!text.includes("link.kind === 'default-remote'")) {
    throw new Error('Expected the deep-link runtime to route default-workspace shared documents through the shared storage markdown reader')
  }
}
