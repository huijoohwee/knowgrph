import { applyCanonicalNodePropertyAuthority } from '@/lib/graph/applyCanonicalNodePropertyAuthority'
import type { GraphData } from '@/lib/graph/types'

export function testCanonicalNodePropertyAuthorityPreservesScopedLayout() {
  const scoped: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'document::panel', label: 'Scoped panel', type: 'RichMediaPanel', x: 48, y: 96, properties: { 'visual:width': 360 } }],
    edges: [],
  }
  const authority: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'panel', label: 'Canonical panel', type: 'RichMediaPanel', x: 0, y: 0, properties: { 'visual:width': 480, 'visual:height': 270 } }],
    edges: [],
  }
  const resolved = applyCanonicalNodePropertyAuthority({ graphData: scoped, propertyAuthorityGraphData: authority })
  const node = resolved?.nodes?.[0]
  if (node?.x !== 48 || node?.y !== 96 || node?.label !== 'Scoped panel') {
    throw new Error('expected canonical property projection to preserve scoped node identity and layout')
  }
  if (node?.properties?.['visual:width'] !== 480 || node?.properties?.['visual:height'] !== 270) {
    throw new Error('expected canonical property projection to apply authoritative node properties')
  }
}
