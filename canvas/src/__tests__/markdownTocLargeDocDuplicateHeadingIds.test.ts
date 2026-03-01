import { lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'
import { buildTocTree } from '@/features/markdown/ui/markdownSectionUtils'

export function testMarkdownTocLargeDocGeneratesUniqueHeadingIds() {
  const filler = 'a'.repeat(210_000)
  const markdown = ['# Doc', '', '## Same', '', filler, '', '## Same', ''].join('\n')
  const tokens = lexMarkdown(markdown).tokens
  const sameHeadings = tokens.filter(t => t.type === 'heading' && String((t as unknown as { text?: unknown }).text || '') === 'Same') as Array<
    { id?: string; startLine?: number }
  >
  if (sameHeadings.length !== 2) throw new Error(`expected 2 "Same" headings, got ${sameHeadings.length}`)
  const a = String(sameHeadings[0]?.id || '')
  const b = String(sameHeadings[1]?.id || '')
  if (!a || !b) throw new Error('expected non-empty heading ids')
  if (a === b) throw new Error(`expected unique heading ids, got "${a}"`)

  const toc = buildTocTree(tokens)
  if (toc.length !== 1) throw new Error(`expected 1 toc root, got ${toc.length}`)
  const root = toc[0]!
  if (root.children.length !== 2) throw new Error(`expected 2 h2 children, got ${root.children.length}`)
  if (root.children[0]?.id === root.children[1]?.id) throw new Error('expected toc children to have distinct ids')
}

