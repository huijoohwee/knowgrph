import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph.core'
import {
  FLOW_EDGE_SOURCE_PORT_KEY,
  FLOW_EDGE_TARGET_PORT_KEY,
  buildImplicitFlowEdgePortKey,
} from '@/lib/graph/flowPorts'

export function testMarkdownFlowBlockTypedNodeToNodeEdgesUseSemanticImplicitPorts() {
  const md = [
    '---',
    'title: Typed edge demo',
    'kgCanvas2dRenderer: "storyboard"',
    'flow:',
    '  direction: {key: direction, type: string, value: "LR"}',
    '  nodes:',
    '    - id: {key: id, type: string, value: "source_ref"}',
    '      type: {key: type, type: string, value: "source"}',
    '      label: {key: label, type: string, value: "Source Ref"}',
    '    - id: {key: id, type: string, value: "candidate_claim"}',
    '      type: {key: type, type: string, value: "claim"}',
    '      label: {key: label, type: string, value: "Candidate Claim"}',
    '  edges:',
    '    - id: {key: id, type: string, value: "edge_source_to_claim"}',
    '      source: {key: source, type: string, value: "source_ref"}',
    '      target: {key: target, type: string, value: "candidate_claim"}',
    '      label: {key: label, type: string, value: "evidence"}',
    '      type: {key: type, type: string, value: "source_ref_signal"}',
    '---',
    '',
    '# Body',
  ].join('\n')
  const res = tryParseMarkdownFrontmatterFlowGraph('typed-node-edge-demo.md', md)
  if (!res) throw new Error('expected typed node-to-node edge frontmatter parse result')
  const edge = res.graphData.edges.find(e => String(e.id || '') === 'edge_source_to_claim')
  if (!edge) throw new Error('expected typed edge id to survive parsing')
  if (res.graphData.context !== 'frontmatter-flow') throw new Error('expected frontmatter-flow context')
  if (res.graphData.nodes.length !== 2 || res.graphData.edges.length !== 1) {
    throw new Error(`expected 2/1 flow graph, got ${res.graphData.nodes.length}/${res.graphData.edges.length}`)
  }
  if (String(edge.source || '') !== 'source_ref' || String(edge.target || '') !== 'candidate_claim') {
    throw new Error('expected typed edge endpoints to survive parsing')
  }
  const props = (edge.properties || {}) as Record<string, unknown>
  const expectedSourcePort = buildImplicitFlowEdgePortKey({ socketType: 'source_ref_signal', side: 'source' })
  const expectedTargetPort = buildImplicitFlowEdgePortKey({ socketType: 'source_ref_signal', side: 'target' })
  if (String(edge.type || '') !== 'source_ref_signal') throw new Error('expected typed edge socket type')
  if (String(props[FLOW_EDGE_SOURCE_PORT_KEY] || '') !== expectedSourcePort) throw new Error(`expected implicit source port ${expectedSourcePort}`)
  if (String(props[FLOW_EDGE_TARGET_PORT_KEY] || '') !== expectedTargetPort) throw new Error(`expected implicit target port ${expectedTargetPort}`)
}
