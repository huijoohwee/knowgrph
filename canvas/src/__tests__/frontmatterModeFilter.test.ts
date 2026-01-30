import { readMarkdownSlideDemo, resolveMarkdownSlideDemoPath } from '@/tests/lib/markdownSlideDemo'
import { parseJsonLd } from '@/lib/graph/jsonld'
import { buildMarkdownJsonLd } from '@/features/parsers/markdownJsonLd'
import { filterGraphToFrontmatterMermaid } from '@/lib/graph/layerDerivation'

export const testFrontmatterModeFiltersToFrontmatterMermaidOnly = () => {
  const markdown = readMarkdownSlideDemo()
  if (!markdown) return
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const frontmatterStart0 = lines.findIndex(l => String(l || '').trim() === '---')
  const frontmatterEnd0 = lines.findIndex((l, i) => i > frontmatterStart0 && String(l || '').trim() === '---')
  const mermaidKey0 =
    frontmatterStart0 >= 0 && frontmatterEnd0 > frontmatterStart0
      ? lines.findIndex((l, i) => i > frontmatterStart0 && i < frontmatterEnd0 && String(l || '').trim() === 'mermaid: |')
      : -1
  const allowedMermaidLineStart = mermaidKey0 >= 0 ? mermaidKey0 + 1 : 1
  const allowedMermaidLineEnd = frontmatterEnd0 >= 0 ? frontmatterEnd0 + 1 : allowedMermaidLineStart
  const mdPath = resolveMarkdownSlideDemoPath() ?? 'markdown-slide-demo.md'
  const jsonld = buildMarkdownJsonLd(mdPath, markdown)
  const graph = parseJsonLd(jsonld)
  const filtered = filterGraphToFrontmatterMermaid(graph)

  if (filtered.nodes.length === 0) {
    throw new Error('expected frontmatter filter to include Mermaid nodes')
  }

  const allowedTypes = new Set(['MermaidDiagram', 'MermaidNode', 'MermaidSubgraph', 'Anchor', 'InternalLink', 'Paragraph'])
  let sawFrontmatterMermaid = false
  let sawAnchor = false
  let sawInternalLink = false
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
    if (String(n.type || '') === 'MermaidDiagram' || String(n.type || '') === 'MermaidNode' || String(n.type || '') === 'MermaidSubgraph') {
      sawFrontmatterMermaid = true
      if (ls < allowedMermaidLineStart || le > allowedMermaidLineEnd) {
        throw new Error(`expected mermaid node ${String(n.id)} to be within frontmatter mermaid line range`)
      }
    }
    if (String(n.type || '') === 'Anchor') {
      const label = String(n.label || '')
      if (label === 'phase-1-input' || label === 'phase-2-transform' || label === 'phase-3-report' || label === 'phase-4-output') {
        sawAnchor = true
      }
    }
    if (String(n.type || '') === 'InternalLink') {
      sawInternalLink = true
    }
  }

  if (!sawFrontmatterMermaid) {
    throw new Error('expected at least one Mermaid node/subgraph/diagram in filtered graph')
  }
  if (!sawAnchor) {
    throw new Error('expected frontmatter filter to include at least one phase anchor')
  }
  if (!sawInternalLink) {
    throw new Error('expected frontmatter filter to include at least one internal link node')
  }
}
