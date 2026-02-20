import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testKeywordModeDerivationIsOffMainThreadOrDeferred() {
  const p = resolve(process.cwd(), 'src', 'hooks', 'useActiveGraphData.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('deriveKeywordGraphInWorker')) {
    throw new Error('expected keyword derivation to use worker helper')
  }
  if (!text.includes('markdownDocumentText')) {
    throw new Error('expected keyword derivation to consider markdown document text when available')
  }
  if (text.includes('deriveKeywordGraphFromText(')) {
    throw new Error('expected useActiveGraphData to avoid synchronous keyword derivation calls in render path')
  }
  if (text.includes("import('@/features/semantic-mode/keywordGraph')")) {
    throw new Error('expected useActiveGraphData to avoid importing keywordGraph for fallback derivation')
  }
  if (text.includes("documentStructureBaselineLock") && text.includes("? 'document'")) {
    throw new Error('expected baseline lock to not force semantic mode to document during render')
  }
  if (!text.includes("pending: true")) {
    throw new Error('expected keyword mode to return a pending keyword graph instead of document graph while deriving')
  }
}
