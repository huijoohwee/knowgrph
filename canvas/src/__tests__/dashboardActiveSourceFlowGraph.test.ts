import { buildDashboardCanvasModel } from '@/components/DashboardCanvas/dashboardModel'
import { parseWorkspaceFrontmatterFlowGraphDataCached } from '@/hooks/active-graph-data/workspaceStructuredGraph'
import { BLOCK_SCHEMA } from '@/__tests__/canvas3dMode.test'

export function testDashboardWorkspaceFrontmatterFlowUsesSelectedSourceContent() {
  const markdownName = 'docs/selected-dashboard-flow.md'
  const markdownText = [
    '---',
    'title: "Selected Dashboard Pipeline"',
    'doc_type: "Computing Flow Demo"',
    'kgCanvasSurfaceMode: "2d"',
    'kgCanvasRenderMode: "2d"',
    'kgCanvas2dRenderer: "storyboard"',
    'kgFrontmatterModeEnabled: true',
    'flow:',
    '  nodes:',
    '    - id: selected_input',
    '      type: DashboardInput',
    '      label: Selected Input',
    '      data:',
    '        score: 4',
    '        input_query: "selected source query"',
    '      handles:',
    '        source: [out]',
    '    - id: selected_compute',
    '      type: DashboardProcess',
    '      label: Selected Compute',
    '      data:',
    '        score: 8',
    '        compute_summary: "selected source compute"',
    '      handles:',
    '        target: [out]',
    '        source: [result]',
    '    - id: selected_output',
    '      type: DashboardOutput',
    '      label: Selected Output',
    '      data:',
    '        mediaUrl: "https://example.test/selected-output.png"',
    '      handles:',
    '        target: [result]',
    '  edges:',
    '    - id: selected_e1',
    '      source: selected_input',
    '      target: selected_compute',
    '    - id: selected_e2',
    '      source: selected_compute',
    '      target: selected_output',
    '---',
    '',
    '# Selected body',
  ].join('\n')

  const graph = parseWorkspaceFrontmatterFlowGraphDataCached({
    markdownName,
    markdownText,
  })
  if (!graph) throw new Error('expected selected frontmatter-flow workspace graph to parse')
  if (String(graph.context || '') !== 'frontmatter-flow') {
    throw new Error(`expected frontmatter-flow context, got ${String(graph.context || '')}`)
  }
  const metadata = (graph.metadata || {}) as Record<string, unknown>
  if (String(metadata.source || '') !== `markdown:${markdownName}`) {
    throw new Error(`expected selected markdown source metadata, got ${String(metadata.source || '')}`)
  }
  if ((graph.nodes || []).length !== 3 || (graph.edges || []).length !== 2) {
    throw new Error(`expected selected source graph counts, got ${graph.nodes?.length || 0}/${graph.edges?.length || 0}`)
  }

  const model = buildDashboardCanvasModel(graph, BLOCK_SCHEMA)
  if (model.title !== 'Selected Dashboard Pipeline') {
    throw new Error(`expected selected file title to drive dashboard title, got ${model.title}`)
  }
  const nodesMetric = model.metrics.find(metric => metric.id === 'nodes')
  const edgesMetric = model.metrics.find(metric => metric.id === 'edges')
  if (nodesMetric?.value !== '3' || edgesMetric?.value !== '2') {
    throw new Error(`expected dashboard metrics from selected source graph, got ${JSON.stringify({ nodesMetric, edgesMetric })}`)
  }
  const degreeLabels = model.sections
    .flatMap(section => section.cards)
    .flatMap(card => card.rows)
    .map(row => row.label)
  if (!degreeLabels.includes('Selected Input') || !degreeLabels.includes('Selected Output')) {
    throw new Error(`expected dashboard card rows from selected source labels, got ${JSON.stringify(degreeLabels)}`)
  }
  if (degreeLabels.some(label => /missalpha dashboard demo|stale/i.test(label))) {
    throw new Error(`expected dashboard card rows to avoid stale source labels, got ${JSON.stringify(degreeLabels)}`)
  }
}
