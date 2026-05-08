import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (filePath: string): string => {
  try {
    return fs.readFileSync(filePath, { encoding: 'utf8' })
  } catch {
    throw new Error(`Expected to read ${filePath}`)
  }
}

export function testLoaderPerfFinalizesFallbackAndEarlyReturns() {
  const filePath = path.resolve(process.cwd(), 'src/features/parsers/loader.ts')
  const text = readUtf8(filePath)
  if (!text.includes('const finalizeLoaderResult =')) {
    throw new Error('Expected loader to centralize import pipeline finalization for all outcomes')
  }
  if (!text.includes("stage: 'parser:fallback:markdown'")) {
    throw new Error('Expected markdown fallback parses to emit a dedicated performance stage')
  }
  if (!text.includes("outcome: 'no-match'")) {
    throw new Error('Expected loader to finalize perf for no-match parser exits')
  }
  if (!text.includes("outcome: 'empty-result'")) {
    throw new Error('Expected loader to finalize perf for empty parser exits')
  }
  if (!text.includes("outcome: 'fallback'")) {
    throw new Error('Expected loader to finalize perf for markdown fallback exits')
  }
}

export function testPwaShellPrecachesHashedAssetsAndCachesLocalJson() {
  const filePath = path.resolve(process.cwd(), 'vite.config.ts')
  const text = readUtf8(filePath)
  if (!text.includes("assets/*.{js,css,woff,woff2,ttf}")) {
    throw new Error('Expected PWA precache glob to include all hashed asset chunks, not only entry bundles')
  }
  if (!text.includes("globIgnores: ['assets/monaco-*.js', 'assets/mermaid-*.js']")) {
    throw new Error('Expected PWA precache to keep oversized Monaco and Mermaid bundles on runtime cache only')
  }
  if (!text.includes("request.destination === 'worker'")) {
    throw new Error('Expected PWA runtime cache to include worker assets for lazy parser/editor surfaces')
  }
  if (!text.includes("url.pathname.endsWith('.json')")) {
    throw new Error('Expected PWA runtime cache to include same-origin JSON data payloads')
  }
  if (!text.includes("url: './?openEditorWorkspace=1'")) {
    throw new Error('Expected PWA manifest shortcuts to include direct editor workspace launch')
  }
  if (!text.includes("'apple-touch-icon.png'")) {
    throw new Error('Expected PWA precache glob to include apple-touch-icon for offline iOS installs')
  }
  if (!text.includes("share_target:")) {
    throw new Error('Expected PWA manifest to declare share_target for Web Share API integration')
  }
  if (!text.includes("action: './?share=1'")) {
    throw new Error('Expected PWA share_target action to route shared content to the app')
  }
}

export function testPwaRuntimeTracksStandaloneInstallAndUpdateState() {
  const runtimePath = path.resolve(process.cwd(), 'src/lib/pwa/runtime.ts')
  const runtimeText = readUtf8(runtimePath)
  const mainPath = path.resolve(process.cwd(), 'src/main.tsx')
  const mainText = readUtf8(mainPath)
  if (!runtimeText.includes("const DISPLAY_MODE_FULLSCREEN_MEDIA = '(display-mode: fullscreen)'")) {
    throw new Error('Expected PWA runtime to track fullscreen display-mode shells')
  }
  if (!runtimeText.includes("const DISPLAY_MODE_MINIMAL_UI_MEDIA = '(display-mode: minimal-ui)'")) {
    throw new Error('Expected PWA runtime to track minimal-ui display-mode shells')
  }
  if (!runtimeText.includes("window.addEventListener('appinstalled', handleAppInstalled)")) {
    throw new Error('Expected PWA runtime to react to appinstalled for installed mobile shells')
  }
  if (!runtimeText.includes('root.dataset.kgDisplayMode = displayMode')) {
    throw new Error('Expected PWA runtime to publish display mode on the document root')
  }
  if (!runtimeText.includes("root.dataset.kgOfflineReady = swState?.offlineReady ? '1' : '0'")) {
    throw new Error('Expected PWA runtime to publish offline-ready state on the document root')
  }
  if (!runtimeText.includes("root.dataset.kgUpdateReady = swState?.updateReady ? '1' : '0'")) {
    throw new Error('Expected PWA runtime to publish update-ready state on the document root')
  }
  if (!runtimeText.includes("root.dataset.kgInstalled = displayMode === 'browser' && !installedHint ? '0' : '1'")) {
    throw new Error('Expected PWA runtime to publish installed-shell state on the document root')
  }
  if (!runtimeText.includes('onOfflineReady()')) {
    throw new Error('Expected PWA runtime to surface offline-ready state')
  }
  if (!runtimeText.includes('onNeedRefresh()')) {
    throw new Error('Expected PWA runtime to surface update-ready state')
  }
  if (!runtimeText.includes('const updateServiceWorker = registerSW({')) {
    throw new Error('Expected PWA runtime to retain the service-worker update handle for stale shell recovery')
  }
  if (!runtimeText.includes('void updateServiceWorker(true)')) {
    throw new Error('Expected PWA runtime to auto-activate a newly available shell so stale clients do not stay on outdated startup logic')
  }
  if (!runtimeText.includes("console.warn('[knowgrph] Offline shell registration failed.', error)")) {
    throw new Error('Expected PWA runtime to log offline-shell registration failures without forcing a user warning toast')
  }
  if (runtimeText.includes("message: 'Offline shell registration failed.'")) {
    throw new Error('Expected PWA runtime to avoid user-facing offline-shell registration failure toasts')
  }
  if (!mainText.includes("import { installPwaRuntime } from '@/lib/pwa/runtime'")) {
    throw new Error('Expected main.tsx to source PWA boot from the shared runtime helper')
  }
  if (!mainText.includes('installPwaRuntime()')) {
    throw new Error('Expected main.tsx to install the shared PWA runtime')
  }
  if (!runtimeText.includes("window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)")) {
    throw new Error('Expected PWA runtime to capture beforeinstallprompt for deferred install UX')
  }
  if (!runtimeText.includes('event.preventDefault()')) {
    throw new Error('Expected PWA runtime to prevent default beforeinstallprompt browser dialog')
  }
  if (!runtimeText.includes('export function getDeferredInstallPrompt')) {
    throw new Error('Expected PWA runtime to export deferred install prompt accessor')
  }
  if (!runtimeText.includes('export async function promptPwaInstall')) {
    throw new Error('Expected PWA runtime to export programmatic install prompt trigger')
  }
  if (!runtimeText.includes("data-kg-installable")) {
    throw new Error('Expected PWA runtime to publish installable state on document element')
  }
}

export function testPwaIndexHtmlIncludesInstallMeta() {
  const htmlPath = path.resolve(process.cwd(), 'index.html')
  const htmlText = readUtf8(htmlPath)
  if (!htmlText.includes('rel="apple-touch-icon"')) {
    throw new Error('Expected index.html to include apple-touch-icon link for iOS PWA install')
  }
  if (!htmlText.includes('href="/apple-touch-icon.png"')) {
    throw new Error('Expected index.html apple-touch-icon to reference the generated PNG')
  }
  if (!htmlText.includes('rel="manifest"')) {
    throw new Error('Expected index.html to include explicit manifest link for broader browser support')
  }
}

export function testPwaHeadersIncludeSwAndManifestCacheControl() {
  const headersPath = path.resolve(process.cwd(), 'public/_headers')
  const headersText = readUtf8(headersPath)
  if (!headersText.includes('/sw.js')) {
    throw new Error('Expected _headers to include sw.js cache bypass rule')
  }
  if (!headersText.includes('Service-Worker-Allowed')) {
    throw new Error('Expected _headers to include Service-Worker-Allowed for scope flexibility')
  }
  if (!headersText.includes('/manifest.webmanifest')) {
    throw new Error('Expected _headers to include manifest.webmanifest cache bypass rule')
  }
}

export function testPwaToolbarInstallButtonWiresDeferredPrompt() {
  const toolbarPath = path.resolve(process.cwd(), 'src/components/Toolbar.tsx')
  const toolbarText = readUtf8(toolbarPath)
  if (!toolbarText.includes('getDeferredInstallPrompt')) {
    throw new Error('Expected Toolbar to import getDeferredInstallPrompt for install visibility guard')
  }
  if (!toolbarText.includes('promptPwaInstall')) {
    throw new Error('Expected Toolbar to import promptPwaInstall for install button click handler')
  }
  if (!toolbarText.includes('isInstallable')) {
    throw new Error('Expected Toolbar to track installable state for conditional button rendering')
  }
  if (!toolbarText.includes('data-kg-installable')) {
    throw new Error('Expected Toolbar to observe data-kg-installable attribute for reactive install state')
  }
  if (!toolbarText.includes('UI_LABELS.installApp')) {
    throw new Error('Expected Toolbar install button to use UI_LABELS.installApp label')
  }
}

export function testPwaShareQueryParamsHandledInBootstrap() {
  const bootstrapPath = path.resolve(process.cwd(), 'src/features/canvas/CanvasQueryBootstrapRuntime.tsx')
  const bootstrapText = readUtf8(bootstrapPath)
  const queryParamsPath = path.resolve(process.cwd(), 'src/lib/routing/queryParams.ts')
  const queryParamsText = readUtf8(queryParamsPath)
  if (!queryParamsText.includes("QUERY_PARAM_SHARE = 'share'")) {
    throw new Error('Expected queryParams to declare QUERY_PARAM_SHARE constant')
  }
  if (!queryParamsText.includes("QUERY_PARAM_SHARE_TITLE = 'title'")) {
    throw new Error('Expected queryParams to declare QUERY_PARAM_SHARE_TITLE constant')
  }
  if (!queryParamsText.includes("QUERY_PARAM_SHARE_TEXT = 'text'")) {
    throw new Error('Expected queryParams to declare QUERY_PARAM_SHARE_TEXT constant')
  }
  if (!queryParamsText.includes("QUERY_PARAM_SHARE_URL = 'url'")) {
    throw new Error('Expected queryParams to declare QUERY_PARAM_SHARE_URL constant')
  }
  if (!bootstrapText.includes('QUERY_PARAM_SHARE')) {
    throw new Error('Expected CanvasQueryBootstrapRuntime to import share query param constants')
  }
  if (!bootstrapText.includes('pwa:share-received')) {
    throw new Error('Expected CanvasQueryBootstrapRuntime to surface shared content via toast')
  }
  if (!bootstrapText.includes("params.delete(QUERY_PARAM_SHARE)")) {
    throw new Error('Expected CanvasQueryBootstrapRuntime to clean share params from URL after handling')
  }
}
