import { buildMarkdownJsonLd } from '@/features/parsers/markdownJsonLd'
import { readMarkdownSlideDemo, resolveMarkdownSlideDemoDocumentPath } from '@/tests/lib/markdownSlideDemo'
import { slugify } from 'grph-shared/markdown/slugify'

export async function testMarkdownJsonLdSlideDemoEmitsAnchorsAndWikilinks() {
  const markdownText = readMarkdownSlideDemo()
  if (!markdownText) return

  const jsonld = buildMarkdownJsonLd(resolveMarkdownSlideDemoDocumentPath() ?? 'markdown-slide-demo.md', markdownText) as unknown as {
    '@graph'?: Array<Record<string, unknown>>
  }
  const nodes = Array.isArray(jsonld['@graph']) ? jsonld['@graph'] : []
  if (nodes.length === 0) throw new Error('expected non-empty @graph')

  const hasAnchor = (anchorId: string) =>
    nodes.some(n => String(n['@type'] || '') === 'Anchor' && String(n['name'] || '') === anchorId)

  if (!hasAnchor('phase-1-input')) {
    throw new Error('expected anchor node for phase-1-input')
  }

  if (!hasAnchor('^mermaid-s2-decide')) {
    throw new Error('expected anchor node for block id ^mermaid-s2-decide')
  }

  const headingAnchor = slugify('Phase 2 Transform (Mermaid S2)')
  if (!hasAnchor(headingAnchor)) {
    throw new Error('expected anchor node for heading slug')
  }

  const hasInternalLink = (anchorId: string) =>
    nodes.some(n => {
      if (String(n['@type'] || '') !== 'InternalLink') return false
      const props = (n['properties'] || {}) as Record<string, unknown>
      return String(props.anchorId || '') === anchorId
    })

  if (!hasInternalLink('^mermaid-s2-decide')) {
    throw new Error('expected internal link node for wikilink block target')
  }

  if (!hasInternalLink(headingAnchor)) {
    throw new Error('expected internal link node for wikilink heading target')
  }

  await Promise.resolve()
}
