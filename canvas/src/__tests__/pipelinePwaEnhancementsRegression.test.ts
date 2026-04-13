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
}

export function testPwaRuntimeTracksStandaloneInstallAndUpdateState() {
  const runtimePath = path.resolve(process.cwd(), 'src/lib/pwa/runtime.ts')
  const runtimeText = readUtf8(runtimePath)
  const mainPath = path.resolve(process.cwd(), 'src/main.tsx')
  const mainText = readUtf8(mainPath)
  if (!runtimeText.includes("const DISPLAY_MODE_STANDALONE_MEDIA = '(display-mode: standalone)'")) {
    throw new Error('Expected PWA runtime to centralize standalone display-mode detection')
  }
  if (!runtimeText.includes("window.addEventListener('appinstalled', handleAppInstalled)")) {
    throw new Error('Expected PWA runtime to react to appinstalled for installed mobile shells')
  }
  if (!runtimeText.includes('root.dataset.kgDisplayMode = standalone ? \'standalone\' : \'browser\'')) {
    throw new Error('Expected PWA runtime to publish display mode on the document root')
  }
  if (!runtimeText.includes('root.dataset.kgInstalled = standalone || installedHint ? \'1\' : \'0\'')) {
    throw new Error('Expected PWA runtime to publish installed-shell state on the document root')
  }
  if (!runtimeText.includes('onOfflineReady()')) {
    throw new Error('Expected PWA runtime to surface offline-ready state')
  }
  if (!runtimeText.includes('onNeedRefresh()')) {
    throw new Error('Expected PWA runtime to surface update-ready state')
  }
  if (!mainText.includes("import { installPwaRuntime } from '@/lib/pwa/runtime'")) {
    throw new Error('Expected main.tsx to source PWA boot from the shared runtime helper')
  }
  if (!mainText.includes('installPwaRuntime()')) {
    throw new Error('Expected main.tsx to install the shared PWA runtime')
  }
}
