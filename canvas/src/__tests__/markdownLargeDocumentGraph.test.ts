import { loadGraphDataFromTextViaParser } from '@/features/parsers/loader'

export async function testDenseLargeMarkdownUsesSummaryGraphBeforeFullParse() {
  const transcriptLikeMarkdown = [
    '# Dense Transcript',
    '',
    ...Array.from({ length: 9000 }, (_, i) => `Segment ${i}: this line preserves imported transcript text for editor fidelity.`),
  ].join('\n')
  const result = await loadGraphDataFromTextViaParser('dense-transcript.md', transcriptLikeMarkdown, {
    applyToStore: false,
    syncMarkdownDocument: false,
  })
  if (!result?.graphData) throw new Error('expected parser result')
  const graph = result.graphData
  if (graph.context !== 'markdown-large') throw new Error(`expected markdown-large context, got ${String(graph.context || '')}`)
  if (!Array.isArray(graph.nodes) || graph.nodes.length !== 1) throw new Error('expected summary-only graph node')
  if (Array.isArray(graph.edges) && graph.edges.length !== 0) throw new Error('expected no edges for summary graph')
  const meta = (graph.metadata || {}) as Record<string, unknown>
  if (meta.kind !== 'markdown-large') throw new Error('expected markdown-large metadata kind')
  if (typeof meta.sourceLayerHash !== 'string' || !meta.sourceLayerHash.startsWith('md-large:v2:')) {
    throw new Error('expected sourceLayerHash for stale-free large markdown layout keys')
  }
  const nodeProps = ((graph.nodes[0] || {}).properties || {}) as Record<string, unknown>
  if (nodeProps.length !== transcriptLikeMarkdown.length) throw new Error('expected original markdown length metadata')
  if (typeof nodeProps.preview !== 'string' || nodeProps.preview.length > 32000) {
    throw new Error('expected bounded markdown preview')
  }
  const warnings = Array.isArray(result.warnings) ? result.warnings.join('\n') : ''
  if (!warnings.includes('summary-only graph')) throw new Error('expected summary graph warning')
}
