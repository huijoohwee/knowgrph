import { CODEBASE_INDEX_PIPELINE_COMMAND, HELP_PIPELINE_COMMAND_TEXT } from '@/lib/config'
import { applyParser, builtInParsers, registerParser, resetParsers, toParserId } from '@/features/parsers'

export async function testHelpPipelineCopyMatchesCommandConstant() {
  if (!CODEBASE_INDEX_PIPELINE_COMMAND.includes('python -m knowgrph_parser markdown')) {
    throw new Error('pipeline command missing markdown CLI invocation')
  }
  if (!CODEBASE_INDEX_PIPELINE_COMMAND.includes('docs/knowgrph-pipeline-document.md')) {
    throw new Error('pipeline command missing default markdown input path')
  }
  if (HELP_PIPELINE_COMMAND_TEXT !== CODEBASE_INDEX_PIPELINE_COMMAND) {
    throw new Error('HelpView pipeline command text does not match CODEBASE_INDEX_PIPELINE_COMMAND')
  }
  await Promise.resolve()
}

export function testMarkdownParserMetadataAnchorsAreAgenticRagCompatible() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))
  const markdown = [
    '# Title',
    '',
    'Paragraph with a [link](https://example.com).',
    '',
    '## Section',
    '',
    '- a',
    '- b',
    '',
    '```ts',
    'console.log("x")',
    '```',
    '',
  ].join('\n')
  const res = applyParser(toParserId('markdown'), { name: 'doc.md', text: markdown })
  if (!res) throw new Error('markdown parse returned null')
  if (res.warnings && res.warnings.length > 0) throw new Error(`markdown parse warnings: ${res.warnings.join('; ')}`)
  const nodes = res.graphData.nodes || []
  if (nodes.length < 2) throw new Error(`expected markdown nodes, got ${nodes.length}`)
  const doc = nodes.find(n => n.type === 'Document')
  if (!doc) throw new Error('missing Document node')
  const meta = (doc.metadata || {}) as Record<string, unknown>
  if (meta.parsedAt) throw new Error('metadata.parsedAt should not be emitted')
  const documentPath = String(meta.documentPath || '')
  if (documentPath !== 'doc.md') throw new Error(`metadata.documentPath mismatch: ${documentPath}`)
  const ts = String(meta.timestamp || '')
  if (!ts || !Number.isFinite(Date.parse(ts))) throw new Error(`metadata.timestamp not ISO: ${ts}`)
  const lineStart = meta.lineStart
  const lineEnd = meta.lineEnd
  if (typeof lineStart !== 'number' || lineStart !== 1) throw new Error(`metadata.lineStart mismatch: ${String(lineStart)}`)
  if (typeof lineEnd !== 'number' || lineEnd < lineStart) throw new Error(`metadata.lineEnd mismatch: ${String(lineEnd)}`)
  const props = (doc.properties || {}) as Record<string, unknown>
  const docLabels = props.labels
  if (!Array.isArray(docLabels) || !docLabels.map(v => String(v)).includes('Document')) {
    throw new Error('Document node should include labels[] with Document')
  }
}
