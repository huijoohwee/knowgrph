import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testBottomPanelMarkdownSelectionReusesSharedLookup() {
  const text = readFileSync(
    resolve(process.cwd(), 'src', 'components', 'BottomPanel', 'markdownUtils.ts'),
    'utf8',
  )

  if (
    !text.includes("buildScopedGraphSemanticKey('bottom-panel-markdown-selection-graph'")
    || !text.includes("cacheScope: 'bottom-panel-markdown-selection-graph'")
    || !text.includes('getCachedGraphLookup({')
    || !text.includes("const node = graphLookup?.nodeById.get(id) || null")
    || !text.includes("const edge = graphLookup?.edgeById.get(id) || null")
    || text.includes('graphData.nodes.find(')
    || text.includes('graphData.edges.find(')
  ) {
    throw new Error('expected BottomPanel markdown selection helpers to reuse the shared graph lookup instead of rescanning graph arrays by selection id')
  }
}
