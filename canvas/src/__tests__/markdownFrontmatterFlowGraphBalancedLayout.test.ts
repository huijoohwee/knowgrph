import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph'
import { FLOW_EDGE_SOURCE_PORT_KEY, FLOW_EDGE_TARGET_PORT_KEY } from '@/lib/graph/flowPorts'

export function testMarkdownFrontmatterFlowGraphPreservesBalancedEdgeLayoutMetadata() {
  const md = [
    '---',
    'kgCanvas2dRenderer: "flowEditor"',
    'kgDocumentSemanticMode: "document"',
    'kgFrontmatterModeEnabled: true',
    'flow:',
    '  direction: LR',
    '  edgeType: smoothstep',
    '  nodes:',
    '    - id: {key: id, type: string, value: "w-text-plan"}',
    '      type: {key: type, type: string, value: "TextGeneration"}',
    '      label: {key: label, type: string, value: "Text"}',
    '      position: {key: position, type: object, value: {x: 160, y: 326}}',
    '      "visual:xIndex": {key: visual:xIndex, type: number, value: -1}',
    '      "visual:yIndex": {key: visual:yIndex, type: number, value: -1}',
    '      "visual:zIndex": {key: visual:zIndex, type: number, value: 0}',
    '      handles: {key: handles, type: object, value: {target: [prompt_in], source: [text_out]}}',
    '    - id: {key: id, type: string, value: "p-rich-media"}',
    '      type: {key: type, type: string, value: "RichMediaPanel"}',
    '      label: {key: label, type: string, value: "Panel"}',
    '      position: {key: position, type: object, value: {x: 700, y: 660}}',
    '      "visual:xIndex": {key: visual:xIndex, type: number, value: 0}',
    '      "visual:yIndex": {key: visual:yIndex, type: number, value: 1}',
    '      "visual:zIndex": {key: visual:zIndex, type: number, value: 1}',
    '      handles: {key: handles, type: object, value: {target: [output], source: []}}',
    '  edges:',
    '    - { id: e-text-panel, source: w-text-plan, sourceHandle: text_out, target: p-rich-media, targetHandle: output, animated: true, layoutRoute: "balanced-16x9:fan-in-readable", layoutLane: -1 }',
    '---',
  ].join('\n')

  const res = tryParseMarkdownFrontmatterFlowGraph('balanced-edge-layout.md', md)
  if (!res) throw new Error('expected frontmatter flow parse result')
  const edge = res.graphData.edges.find(edge => String(edge.id || '') === 'e-text-panel')
  if (!edge) throw new Error('expected balanced edge')
  const edgeProps = (edge.properties || {}) as Record<string, unknown>
  if (String(edgeProps.layoutRoute || '') !== 'balanced-16x9:fan-in-readable') throw new Error(`expected balanced edge layoutRoute, got ${String(edgeProps.layoutRoute || '')}`)
  if (Number(edgeProps.layoutLane) !== -1) throw new Error(`expected balanced edge layoutLane=-1, got ${String(edgeProps.layoutLane)}`)
  if (edgeProps[FLOW_EDGE_SOURCE_PORT_KEY] !== 'text_out') throw new Error('expected source port text_out')
  if (edgeProps[FLOW_EDGE_TARGET_PORT_KEY] !== 'output') throw new Error('expected target port output')

  const textProps = (res.graphData.nodes.find(node => String(node.id || '') === 'w-text-plan')?.properties || {}) as Record<string, unknown>
  if (Number(textProps['visual:xIndex']) !== -1) throw new Error('expected text widget visual:xIndex=-1')
  if (Number(textProps['visual:yIndex']) !== -1) throw new Error('expected text widget visual:yIndex=-1')
  if (Number(textProps['visual:zIndex']) !== 0) throw new Error('expected text widget visual:zIndex=0')

  const panelProps = (res.graphData.nodes.find(node => String(node.id || '') === 'p-rich-media')?.properties || {}) as Record<string, unknown>
  if (Number(panelProps['visual:xIndex']) !== 0) throw new Error('expected panel visual:xIndex=0')
  if (Number(panelProps['visual:yIndex']) !== 1) throw new Error('expected panel visual:yIndex=1')
  if (Number(panelProps['visual:zIndex']) !== 1) throw new Error('expected panel visual:zIndex=1')
}
