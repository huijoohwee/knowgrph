import { readMarkdownSlideDemo, resolveMarkdownSlideDemoPath } from '@/tests/lib/markdownSlideDemo'
import { parseJsonLd } from '@/lib/graph/jsonld'
import { buildMarkdownJsonLd } from '@/features/parsers/markdownJsonLd'
import { filterGraphToFrontmatterMermaid } from '@/lib/graph/layerDerivation'

export const testFrontmatterModeFiltersToFrontmatterMermaidOnly = () => {
  const markdown = readMarkdownSlideDemo()
  if (!markdown) return
  const mdPath = resolveMarkdownSlideDemoPath() ?? 'markdown-slide-demo.md'
  const jsonld = buildMarkdownJsonLd(mdPath, markdown)
  const graph = parseJsonLd(jsonld)
  const filtered = filterGraphToFrontmatterMermaid(graph)

  if (filtered.nodes.length === 0) {
    throw new Error('expected frontmatter filter to include Mermaid nodes')
  }

  const allowedTypes = new Set(['MermaidDiagram', 'MermaidNode', 'MermaidSubgraph'])
  for (let i = 0; i < filtered.nodes.length; i += 1) {
    const n = filtered.nodes[i]
    if (!allowedTypes.has(String(n.type || ''))) {
      throw new Error(`unexpected node type in frontmatter mode: ${String(n.type || '')}`)
    }
    const m = n.metadata || {}
    const ls = typeof m.lineStart === 'number' ? m.lineStart : Number.NaN
    const le = typeof m.lineEnd === 'number' ? m.lineEnd : Number.NaN
    if (!Number.isFinite(ls) || !Number.isFinite(le)) {
      throw new Error(`expected node ${String(n.id)} to have lineStart/lineEnd metadata`)
    }
    if (ls < 19 || le > 50) {
      throw new Error(`expected node ${String(n.id)} to be within frontmatter mermaid line range`)
    }
  }
}
