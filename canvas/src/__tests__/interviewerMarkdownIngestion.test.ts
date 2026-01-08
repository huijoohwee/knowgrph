import { applyParser, builtInParsers, registerParser, resetParsers, toParserId } from '@/features/parsers'
import { buildMarkdownJsonLd } from '@/features/parsers/default'

const INTERVIEWER_MARKDOWN = [
  '# Interviewer Markdown Fixture',
  '',
  'This is a minimal markdown fixture representing a slice of the',
  'interviewer assessment document. It is intentionally compact and',
  'domain-agnostic while still exercising the markdown ingestion pipeline.',
  '',
  '## Section A',
  '',
  '- Item one',
  '- Item two',
  '',
  '[External link](https://example.com)',
  '',
  '![Example image](https://example.com/example.png)',
].join('\n')

export async function testInterviewerMarkdownIngestionProducesGraph() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const markdown = String(INTERVIEWER_MARKDOWN || '')
  if (!markdown.trim()) {
    throw new Error('interviewer markdown fixture text is empty')
  }

  const jsonld = buildMarkdownJsonLd('file://interviewer.md', markdown)

  const res = applyParser(toParserId('jsonld'), {
    name: 'interviewer.jsonld',
    text: JSON.stringify(jsonld),
  })

  if (!res) throw new Error('jsonld parse returned null')
  if (res.warnings && res.warnings.length > 0) {
    throw new Error(`jsonld parse warnings: ${res.warnings.join('; ')}`)
  }

  const nodes = res.graphData.nodes || []
  if (nodes.length === 0) {
    throw new Error('interviewer markdown produced no nodes')
  }
  const edges = res.graphData.edges || []
  if (edges.length === 0) {
    throw new Error('interviewer markdown produced no edges')
  }

  await Promise.resolve()
}

