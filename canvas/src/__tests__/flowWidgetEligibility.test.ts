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
