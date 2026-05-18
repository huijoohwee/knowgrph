import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (absPath: string): string => fs.readFileSync(absPath, { encoding: 'utf8' })

export const testCanvasDocDeepLinkAppliesWorkspaceSwitchPresetAndGraph = () => {
  const text = readUtf8(path.resolve(process.cwd(), 'src', 'features', 'canvas', 'CanvasDocDeepLinkRuntime.tsx'))
  const helperText = readUtf8(path.resolve(process.cwd(), 'src', 'features', 'canvas', 'canvasDocDeepLink.ts'))
  const explorerStoreText = readUtf8(path.resolve(process.cwd(), 'src', 'features', 'markdown-explorer', 'store.ts'))
  if (!text.includes("from './canvasDocDeepLink'")) {
    throw new Error('Expected document deep links to use the shared parser/URL helper')
  }
  if (!explorerStoreText.includes('readLocalDocDeepLinkPathFromCurrentLocation()')) {
    throw new Error('Expected markdown explorer startup to prefer a live local document deep link before persisted active path')
  }
  if (!text.includes("import('@/lib/markdown-workspace-runtime/workspaceSwitchPreset')")) {
    throw new Error('Expected local document deep links to reuse the shared workspace switch preset helper')
  }
  if (!text.includes('applyCanvasWorkspacePresetForSwitch({ text: entryText })')) {
    throw new Error('Expected local document deep links to apply canonical YAML canvas presets through the shared helper')
  }
  const selectIndex = text.indexOf('setActivePath(targetPath)')
  const applyIndex = text.indexOf('applyCanvasWorkspacePresetForSwitch({ text: entryText })')
  if (selectIndex < 0 || applyIndex < 0 || selectIndex > applyIndex) {
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
  if (!text.includes('applyToGraph: true') || !text.includes('normalizeWebpageFrontmatterToMarkdown: false')) {
    throw new Error('Expected local document deep links to apply the target markdown graph without frontmatter normalization churn')
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
}
