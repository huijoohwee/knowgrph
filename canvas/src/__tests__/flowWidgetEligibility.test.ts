import { FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID, FLOW_TEXT_GENERATION_NODE_TYPE_ID } from '@/lib/config.flow-editor'
import type { GraphData } from '@/lib/graph/types'
import { filterGraphToFlowWidgetEligible } from '@/lib/graph/flowWidgetEligibility'

export function testFlowWidgetEligibilityKeepsDottedEndpointEdges() {
  const graph: GraphData = {
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [
      { id: 'n-a', type: 'input', label: 'A', properties: { 'flow:widgetFormId': 'fm:n-a' } },
      { id: 'n-b', type: 'default', label: 'B', properties: { 'flow:widgetFormId': 'fm:n-b' } },
      { id: 'n-x', type: 'Node', label: 'X', properties: {} },
    ],
    edges: [
      { id: 'e-1', source: 'n-a.out', target: 'n-b.in', properties: {} },
      { id: 'e-x', source: 'n-a.out', target: 'n-x.in', properties: {} },
    ],
    metadata: {},
  }

  const filtered = filterGraphToFlowWidgetEligible(graph)
  const nodeIds = (filtered.nodes || []).map(n => String(n.id || '')).sort()
  const edgeIds = (filtered.edges || []).map(e => String(e.id || '')).sort()
  if (nodeIds.join(',') !== 'n-a,n-b') {
    throw new Error(`expected filtered nodes n-a,n-b, got ${nodeIds.join(',')}`)
  }
  if (edgeIds.join(',') !== 'e-1') {
    throw new Error(`expected dotted endpoint edge e-1 to remain visible, got ${edgeIds.join(',')}`)
  }
}

export function testFlowWidgetEligibilityKeepsCanonicalWidgetTypesWithoutMetadata() {
  const graph: GraphData = {
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [
      { id: 'w-text', type: FLOW_TEXT_GENERATION_NODE_TYPE_ID, label: 'OpenAI Text Widget', properties: {} },
      { id: 'p-media', type: FLOW_RICH_MEDIA_PANEL_NODE_TYPE_ID, label: 'Rich Media Panel', properties: {} },
      { id: 'n-plain', type: 'Node', label: 'Plain node', properties: {} },
    ],
    edges: [
      { id: 'e-text', source: 'w-text', target: 'p-media', properties: {} },
      { id: 'e-plain', source: 'n-plain', target: 'p-media', properties: {} },
    ],
    metadata: {},
  }

  const filtered = filterGraphToFlowWidgetEligible(graph)
  const nodeIds = (filtered.nodes || []).map(n => String(n.id || '')).sort()
  const edgeIds = (filtered.edges || []).map(e => String(e.id || '')).sort()
  if (nodeIds.join(',') !== 'p-media,w-text') {
    throw new Error(`expected canonical flow widget nodes to remain eligible without metadata, got ${nodeIds.join(',')}`)
  }
  if (edgeIds.join(',') !== 'e-text') {
    throw new Error(`expected only canonical widget-to-panel edge to remain, got ${edgeIds.join(',')}`)
  }
}
