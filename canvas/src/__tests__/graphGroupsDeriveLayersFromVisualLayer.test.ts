import type { GraphData } from '@/lib/graph/types'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'

export function testDeriveGraphGroupsCreatesLayerGroupsFromVisualLayer() {
  const data: GraphData = {
    type: 'Graph',
    context: 't',
    metadata: { kind: 'doc', source: 't' },
    nodes: [
      { id: 'a', type: 'Node', label: 'A', properties: { 'visual:layer': 'source' } },
      { id: 'b', type: 'Node', label: 'B', properties: { 'visual:layer': 'source' } },
    ],
    edges: [],
  }

  const groups = deriveGraphGroups(data)
  const g = groups.find(x => String(x.id) === 'layer:source') || null
  if (!g) throw new Error('expected layer:source group')
  if (String(g.label || '') !== 'source') throw new Error(`expected label 'source', got ${String(g.label || '')}`)
}

