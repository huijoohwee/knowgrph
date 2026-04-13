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
