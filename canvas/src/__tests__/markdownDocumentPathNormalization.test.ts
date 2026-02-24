import { buildMarkdownJsonLd } from '@/features/parsers/markdownJsonLd'
import { parseJsonLd } from '@/lib/graph/jsonld'

const getAnyDocumentPath = (graph: ReturnType<typeof parseJsonLd>): string => {
  const nodes = graph?.nodes || []
  for (const n of nodes) {
    const meta = (n as { metadata?: Record<string, unknown> }).metadata || {}
    const value = typeof meta.documentPath === 'string' ? meta.documentPath.trim() : ''
    if (value) return value
  }
  return ''
}

export const testMarkdownDocumentPathNormalization = () => {
  const markdown = ['---', 'mermaid: |', '  graph LR', '    A --> B', '---', '', '# Title', ''].join('\n')

  const rel = buildMarkdownJsonLd('docs/example.md', markdown)
  const relGraph = parseJsonLd(rel)
  const relDocPath = getAnyDocumentPath(relGraph)
  if (relDocPath !== 'docs/example.md') {
    throw new Error(`expected relative documentPath to be preserved, got ${JSON.stringify(relDocPath)}`)
  }

  const abs = buildMarkdownJsonLd('/tmp/someone/docs/example.md', markdown)
  const absGraph = parseJsonLd(abs)
  const absDocPath = getAnyDocumentPath(absGraph)
  if (absDocPath !== 'example.md') {
    throw new Error(`expected absolute documentPath to be reduced to basename, got ${JSON.stringify(absDocPath)}`)
  }
  if (absDocPath.includes('/')) {
    throw new Error(`expected absolute documentPath to not contain '/', got ${JSON.stringify(absDocPath)}`)
  }

  const url = 'https://example.invalid/docs/example.md'
  const web = buildMarkdownJsonLd(url, markdown)
  const webGraph = parseJsonLd(web)
  const webDocPath = getAnyDocumentPath(webGraph)
  if (webDocPath !== url) {
    throw new Error(`expected url documentPath to match url, got ${JSON.stringify(webDocPath)}`)
  }
}
