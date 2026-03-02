import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph'
import { FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY } from '@/lib/config'
import { FLOW_EDGE_SOURCE_PORT_KEY, FLOW_EDGE_TARGET_PORT_KEY } from '@/lib/graph/flowPorts'
import { KG_SUBGRAPHS_KEY } from '@/lib/graph/subgraphs'

export function testMarkdownFrontmatterFlowGraphImportsNodesEdgesAndRegistry() {
  const md = [
    '---',
    'meta:',
    '  id: demo-flow-001',
    'nodes:',
    '  - id: NODE_A',
    '    type: Source',
    '    label: "A"',
    '    category: source',
    '    pos: { x: 40, y: 80 }',
    '    inputs: []',
    '    outputs:',
    '      - port: out_1',
    '        type: STRING',
    '  - id: NODE_B',
    '    type: Sink',
    '    label: "B"',
    '    category: output',
    '    pos: { x: 240, y: 80 }',
    '    visual: { zIndex: 9, opacity: 0.5, width: 420, height: 180 }',
    '    inputs:',
    '      - port: in_1',
    '        type: STRING',
    '        from: NODE_A.out_1',
    '    outputs: []',
    'connections:',
    '  - { id: e01, from_node: NODE_A, from_port: out_1, to_node: NODE_B, to_port: in_1, type: STRING }',
    '---',
    '',
    '# Demo',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('demo.md', md)
  if (!res) throw new Error('expected a frontmatter flow graph parse result')
  const g = res.graphData
  if (g.context !== 'frontmatter-flow') throw new Error('expected frontmatter-flow context')
  if (g.nodes.length !== 2) throw new Error(`expected 2 nodes, got ${g.nodes.length}`)
  if (g.edges.length !== 1) throw new Error(`expected 1 edge, got ${g.edges.length}`)

  const a = g.nodes.find(n => n.id === 'NODE_A')
  const b = g.nodes.find(n => n.id === 'NODE_B')
  if (!a || !b) throw new Error('expected NODE_A and NODE_B')
  if (a.x !== 40 || a.y !== 80) throw new Error('expected NODE_A x/y from pos')
  if (b.x !== 240 || b.y !== 80) throw new Error('expected NODE_B x/y from pos')
  if ((a.properties as Record<string, unknown>)['visual:layer'] !== 0) throw new Error('expected source visual:layer=0')
  if ((b.properties as Record<string, unknown>)['visual:layer'] !== 7) throw new Error('expected output visual:layer=7')
  if ((b.properties as Record<string, unknown>)['visual:zIndex'] !== 9) throw new Error('expected visual:zIndex override')
  if ((b.properties as Record<string, unknown>)['visual:opacity'] !== 0.5) throw new Error('expected visual:opacity override')
  if ((b.properties as Record<string, unknown>)['visual:width'] !== 420) throw new Error('expected visual:width override')
  if ((b.properties as Record<string, unknown>)['visual:height'] !== 180) throw new Error('expected visual:height override')
  const portTypes = (b.properties as Record<string, unknown>)['flow:portTypes'] as unknown
  if (!portTypes || typeof portTypes !== 'object') throw new Error('expected flow:portTypes on node')

  const e = g.edges[0]
  const props = (e.properties || {}) as Record<string, unknown>
  if (props[FLOW_EDGE_SOURCE_PORT_KEY] !== 'out_1') throw new Error('expected flow:sourcePortKey=out_1')
  if (props[FLOW_EDGE_TARGET_PORT_KEY] !== 'in_1') throw new Error('expected flow:targetPortKey=in_1')

  const meta = (g.metadata || {}) as Record<string, unknown>
  const registry = meta[FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY]
  if (!Array.isArray(registry) || registry.length < 2) throw new Error('expected quick editor registry entries')

  const subgraphs = meta[KG_SUBGRAPHS_KEY]
  if (!Array.isArray(subgraphs) || subgraphs.length < 2) throw new Error('expected derived subgraphs')
}
