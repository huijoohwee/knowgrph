import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph'

export function testFrontmatterFlowConnectionWarningsUseFlowPortTypes(): void {
  const md = [
    '---',
    'socket_types:',
    '  cost_driver_signal: { color: "#f59e0b", accepts: [cost_driver_signal] }',
    'flow:',
    '  nodes:',
    '    - id: cost_drivers',
    '      type: CostDriverWidget',
    '      label: Cost Drivers',
    '      handles:',
    '        source: [monthly_requests]',
    '      "flow:portTypes":',
    '        out:',
    '          monthly_requests: cost_driver_signal',
    '    - id: cost_calculator',
    '      type: CostCalculatorWidget',
    '      label: Cost Calculator',
    '      handles:',
    '        target: [monthly_requests]',
    '        source: [monthly_cost_usd]',
    '      "flow:portTypes":',
    '        in:',
    '          monthly_requests: cost_driver_signal',
    '        out:',
    '          monthly_cost_usd: cost_driver_signal',
    '  edges:',
    '    - { id: e-cost, source: cost_drivers, sourceHandle: monthly_requests, target: cost_calculator, targetHandle: monthly_requests, type: cost_driver_signal }',
    '---',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('flow-block-port-types.md', md)
  if (!res) throw new Error('expected parse result')
  if (res.graphData.edges.length !== 1) throw new Error(`expected one edge, got ${res.graphData.edges.length}`)
  const warningBlob = res.warnings.join(' | ')
  if (warningBlob.includes('Connection source port missing type')) {
    throw new Error(`expected flow:portTypes to satisfy source port typing, got ${warningBlob}`)
  }
  if (warningBlob.includes('Connection target port missing type')) {
    throw new Error(`expected flow:portTypes to satisfy target port typing, got ${warningBlob}`)
  }
  if (warningBlob.includes('Connection not mirrored in node inputs')) {
    throw new Error(`expected flow.edges to remain the connection source, got ${warningBlob}`)
  }
}
