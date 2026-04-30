import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFrontmatterOnlyPolicySkipsKeywordTableAndComposedSourceDerivations() {
  const activeGraphDataPath = resolve(process.cwd(), 'src', 'hooks', 'active-graph-data', 'useActiveGraphData.impl.ts')
  const activeGraphRenderDataPath = resolve(process.cwd(), 'src', 'hooks', 'active-graph-data', 'useActiveGraphRenderData.impl.ts')
  const activeGraphDataText = readFileSync(activeGraphDataPath, 'utf8')
  const activeGraphRenderDataText = readFileSync(activeGraphRenderDataPath, 'utf8')
  if (!activeGraphDataText.includes('isFrontmatterOnlyPolicyActive')) {
    throw new Error('expected active graph derivation to use centralized frontmatter-only policy helper')
  }
  if (!activeGraphDataText.includes("const effectiveMode: 'document' | 'keyword' = frontmatterOnlyPolicyActive ? 'document' : mode")) {
    throw new Error('expected frontmatter-only policy to force effective semantic mode to document')
  }
  if (!activeGraphRenderDataText.includes('const effectiveMultiDimTableModeEnabled = frontmatterOnlyPolicyActive ? false : multiDimTableModeEnabled')) {
    throw new Error('expected frontmatter-only policy to disable table derivation mode')
  }
  if (!activeGraphRenderDataText.includes('multiDimTableModeEnabled: effectiveMultiDimTableModeEnabled')) {
    throw new Error('expected active view graph derivation to use effective table mode state')
  }

  const composedSourcePath = resolve(process.cwd(), 'src', 'features', 'source-files', 'applyComposedGraphFromSourceFiles.ts')
  const composedSourceText = readFileSync(composedSourcePath, 'utf8')
  if (!composedSourceText.includes('isFrontmatterOnlyPolicyActive')) {
    throw new Error('expected composed source graph application to use frontmatter-only policy helper')
  }
  if (!composedSourceText.includes('if (isFrontmatterOnlyPolicyActive({ canvasRenderMode: store.canvasRenderMode, canvas2dRenderer: store.canvas2dRenderer })) return')) {
    throw new Error('expected composed source graph derivation to be skipped under frontmatter-only policy')
  }
}
