import { upsertFrontmatterFlowMarkdownText } from '@/hooks/store/graph-data-slice/graphDataFrontmatterFlowSync'
import type { GraphData } from '@/lib/graph/types'

export function testFrontmatterFlowWritebackDoesNotReplaceNonEmptyFlowWithEmptyGraph() {
  const text = [
    '---',
    'title: "Demo"',
    'flow:',
    '  nodes:',
    '    - id: {key: id, type: string, value: "source_input"}',
    '      type: {key: type, type: string, value: "InputWidget"}',
    '      label: {key: label, type: string, value: "Source Input"}',
    '  edges:',
    '    - {"id":"edge_a","source":"source_input","target":"compute_summary"}',
    '---',
    '## Body',
    '',
  ].join('\n')
  const emptyGraph: GraphData = {
    type: 'flow',
    nodes: [],
    edges: [],
    metadata: { frontmatterFlow: true },
  }
  const nextText = upsertFrontmatterFlowMarkdownText(text, emptyGraph)
  if (nextText !== text) {
    throw new Error('expected frontmatter flow writeback to preserve existing non-empty flow when the candidate graph is empty')
  }
}
