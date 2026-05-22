import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => fs.readFileSync(absPath, { encoding: 'utf8' })

export const testCanvasDocDeepLinkSelectsDocumentBeforePassiveGraphApply = () => {
  const text = readUtf8(path.resolve(process.cwd(), 'src', 'features', 'canvas', 'CanvasDocDeepLinkRuntime.tsx'))
  const helperText = readUtf8(path.resolve(process.cwd(), 'src', 'features', 'canvas', 'canvasDocDeepLink.ts'))
  const shareTokenText = readUtf8(path.resolve(process.cwd(), 'src', 'features', 'canvas', 'canvasDocShareToken.mjs'))
  const explorerStoreText = readUtf8(path.resolve(process.cwd(), 'src', 'features', 'markdown-explorer', 'store.ts'))
  if (!text.includes("from './canvasDocDeepLink'")) {
    throw new Error('Expected document deep links to use the shared parser/URL helper')
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
  if (!text.includes('applyToGraph: false') || !text.includes('normalizeWebpageFrontmatterToMarkdown: false')) {
    throw new Error('Expected local document deep links to open the target markdown document without mutating the Canvas graph')
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
  if (!helperText.includes('buildPublishedDocShareDeepLink')) {
    throw new Error('Expected published Share URL generation to prefer the canonical opaque share-route builder')
  }
  if (!shareTokenText.includes('PUBLISHED_DOC_SHARE_TOKEN_PARAM = "kgShare"') || !helperText.includes('encodePublishedDocShareToken')) {
    throw new Error('Expected published Share URL generation to use the shared opaque share-token contract')
  }
  if (!helperText.includes("const SHARE_DEEP_LINK_PREFIX = '/share/'")) {
    throw new Error('Expected published Share URL generation to expose the canonical opaque share path')
  }
  if (!text.includes("link.kind === 'default-remote'")) {
    throw new Error('Expected the deep-link runtime to route default-workspace shared documents through the shared storage markdown reader')
  }
}
