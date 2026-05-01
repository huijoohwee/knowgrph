import type { GraphData, GraphNode } from '@/lib/graph/types'
import { getCachedGraphLookup } from '@/lib/graph/lookupCache'

export function testGraphLookupCachePrefersCurrentGraphDataReferencesForMutableConsumers() {
  const firstNode = { id: 'n1', type: 'Node', properties: {}, x: 10, y: 20 } as unknown as GraphNode
  const secondNode = { id: 'n1', type: 'Node', properties: {}, x: 30, y: 40 } as unknown as GraphNode

  const firstGraph = { type: 'application/json', nodes: [firstNode], edges: [] } as unknown as GraphData
  const secondGraph = { type: 'application/json', nodes: [secondNode], edges: [] } as unknown as GraphData

  const firstLookup = getCachedGraphLookup({
    cacheScope: 'graph-lookup-ref-safety',
    graphData: firstGraph,
    graphSemanticKey: 'same-semantic-graph',
    preferCurrentGraphDataRefs: true,
  })
  const secondLookup = getCachedGraphLookup({
    cacheScope: 'graph-lookup-ref-safety',
    graphData: secondGraph,
    graphSemanticKey: 'same-semantic-graph',
    preferCurrentGraphDataRefs: true,
  })

  if (!firstLookup || !secondLookup) {
    throw new Error('expected graph lookups to be created')
  }
  if (firstLookup.nodeById.get('n1') !== firstNode) {
    throw new Error('expected the first lookup to expose the first graph node reference')
  }
  if (secondLookup.nodeById.get('n1') !== secondNode) {
    throw new Error('expected the mutable-consumer lookup to rebind to the current graph node reference')
  }
  if (secondLookup.graphData !== secondGraph) {
    throw new Error('expected the mutable-consumer lookup to retain the current graph object reference')
  }
}
