import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { useGraphStore } from '@/hooks/useGraphStore'
import { autoApplyFrontmatterMermaidMarkdownToGraphIfEmpty } from '@/features/parsers/loader'
import { filterGraphToFrontmatterMermaid } from '@/lib/graph/layerDerivation'

export async function testMarkdownAutoAppliesFrontmatterMermaidToCanvasWhenGraphEmpty() {
  const storage = new MemoryStorage()
  const { restore } = initWindowHarness({ storage })
  try {
    const state = useGraphStore.getState()
    state.resetAll()
    state.clearGraphData()

    const text = [
      '---',
      'title: Demo',
      'mermaid: |',
      '  graph TD',
      '    A[Start] --> B[End]',
      '---',
      '',
      '# Body',
      '',
      '<a id="end"></a>',
      '',
      '> [!note] Callout',
      '> tied to frontmatter diagram.',
    ].join('\n')

    state.setMarkdownDocument('sandbox/demo.md', text)
    const ok = await autoApplyFrontmatterMermaidMarkdownToGraphIfEmpty({ name: 'sandbox/demo.md', text })
    if (!ok) throw new Error('expected auto-apply to succeed')

    const after = useGraphStore.getState()
    const graph = after.graphData
    if (!graph) throw new Error('expected graphData')
    if ((graph.nodes || []).length === 0) throw new Error('expected non-empty graph nodes after auto-apply')

    const focused = filterGraphToFrontmatterMermaid(graph)
    if ((focused.nodes || []).length === 0) throw new Error('expected frontmatter-focused graph nodes')

    const hasFrontmatterMermaid = (focused.nodes || []).some(n => {
      const props = (n.properties || {}) as Record<string, unknown>
      return props.isMermaidFrontmatter === true || props.mermaidScope === 'frontmatter'
    })
    if (!hasFrontmatterMermaid) throw new Error('expected focused graph to include frontmatter MermaidDiagram')
  } finally {
    restore()
  }
}

