import { applyParser, builtInParsers, registerParser, resetParsers, toParserId } from '@/features/parsers'
import { filterGraphToFrontmatterFlow } from '@/lib/graph/layerDerivation'

export async function testMarkdownFrontmatterFlowMergeKeepsDocGraphAndFlowGraph() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const markdown = [
    '---',
    'nodes:',
    '  - id: A',
    '    label: Node A',
    '  - id: B',
    '    label: Node B',
    'connections:',
    '  - from: A.out',
    '    to: B.in',
    '---',
    '',
    '# Title',
    '',
    '<iframe title="Inline" srcdoc="<div><h1>Hello</h1><p>Inline iframe</p></div>"></iframe>',
    '',
  ].join('\n')

  const res = applyParser(toParserId('markdown'), { name: 'doc.md', text: markdown })
  if (!res) throw new Error('expected markdown parse result')
  if (!res.graphData) throw new Error('expected graphData from markdown parse')

  const nodes = res.graphData.nodes || []
  const edges = res.graphData.edges || []
  if (nodes.length === 0) throw new Error('expected non-empty nodes from merged markdown graph')
  if (edges.length === 0) throw new Error('expected non-empty edges from merged markdown graph')

  const flowNodeA = nodes.find(n => String(n.id || '') === 'A')
  if (!flowNodeA) throw new Error('expected frontmatter flow node A to be present in merged graph')
  const propsA = (flowNodeA.properties || {}) as Record<string, unknown>
  const formId = String(propsA['flow:widgetFormId'] || '').trim()
  if (!formId) throw new Error('expected flow node A to have a flow:widgetFormId')

  const context = String((res.graphData as { context?: unknown }).context || '').trim()
  if (context !== 'frontmatter-flow') {
    throw new Error(`expected frontmatter-flow context, got ${context || '(empty)'}`)
  }

  const hasIframeSrcdocNode = nodes.some(n => {
    const props = (n.properties || {}) as Record<string, unknown>
    return String(props['dom:attrs:srcdoc'] || '').includes('<h1>Hello</h1>')
  })
  if (hasIframeSrcdocNode) {
    throw new Error('expected frontmatter-flow import contract to exclude inline iframe srcdoc doc nodes from flow graph')
  }
}

export async function testMarkdownFrontmatterFlowFilterKeepsOnlyFlowNodesAndEdges() {
  resetParsers()
  builtInParsers.forEach(p => registerParser(p))

  const markdown = [
    '---',
    'nodes:',
    '  - id: A',
    '    label: Node A',
    '  - id: B',
    '    label: Node B',
    'connections:',
    '  - from: A.out',
    '    to: B.in',
    '---',
    '',
    '# Title',
    '',
    '<iframe title="Inline" srcdoc="<div><h1>Hello</h1><p>Inline iframe</p></div>"></iframe>',
    '',
  ].join('\n')

  const res = applyParser(toParserId('markdown'), { name: 'doc.md', text: markdown })
  if (!res) throw new Error('expected markdown parse result')
  const base = res.graphData
  if (!base) throw new Error('expected graphData from markdown parse')

  const filtered = filterGraphToFrontmatterFlow(base)
  const nodes = filtered.nodes || []
  const edges = filtered.edges || []

  const ids = new Set(nodes.map(n => String(n.id || '')).filter(Boolean))
  if (!ids.has('A') || !ids.has('B')) throw new Error('expected flow nodes A and B after flow filter')

  const hasNonFlowDocNode = nodes.some(n => {
    const props = (n.properties || {}) as Record<string, unknown>
    return String(props['dom:tag'] || '').toUpperCase() === 'IFRAME' || typeof props['dom:attrs:srcdoc'] === 'string'
  })
  if (hasNonFlowDocNode) throw new Error('expected flow filter to exclude doc-graph media nodes')

  const hasFlowEdge = edges.some(e => String(e.source || '') === 'A' && String(e.target || '') === 'B')
  if (!hasFlowEdge) throw new Error('expected flow edge A->B after flow filter')
}
