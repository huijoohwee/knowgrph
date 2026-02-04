import { useGraphStore } from '@/hooks/useGraphStore'

export async function testMarkdownApplyWithoutFrontmatterBuildsGraph() {
  const state = useGraphStore.getState()
  state.setDocumentStructureBaselineLock(false)
  const prevFrontmatterModeEnabled = !!state.frontmatterModeEnabled
  try {
    state.clearGraphData()
  } catch {
    void 0
  }
  state.setDocumentSemanticMode('document')
  state.setFrontmatterModeEnabled(false)

  const ok = await state.applyMarkdownDocumentToGraph('apply-without-frontmatter.md', '# Title\n\nHello')
  if (!ok) throw new Error('expected applyMarkdownDocumentToGraph to apply for plain markdown')

  const next = useGraphStore.getState().graphData
  const n = next && Array.isArray(next.nodes) ? next.nodes.length : 0
  if (n <= 0) throw new Error('expected graphData.nodes to be non-empty after markdown apply')

  state.setFrontmatterModeEnabled(prevFrontmatterModeEnabled)
}
