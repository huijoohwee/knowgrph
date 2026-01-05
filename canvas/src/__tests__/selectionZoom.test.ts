import type { GraphData } from '@/lib/graph/types'
import { computeZoomTargetNodeIds, computeZoomSubset } from '@/components/GraphCanvas/selectionZoom'

const makeZoomGraph = (): GraphData => ({
  type: 'Graph',
  nodes: [
    { id: 'a', label: 'A', type: 'Entity', properties: {}, x: 0, y: 0 },
    { id: 'b', label: 'B', type: 'Entity', properties: {}, x: 10, y: 0 },
    { id: 'c', label: 'C', type: 'Entity', properties: {}, x: 20, y: 0 },
    { id: 'd', label: 'D', type: 'Entity', properties: {}, x: 100, y: 100 },
  ],
  edges: [
    { id: 'e1', source: 'a', target: 'b', label: 'relatedTo', properties: {} },
    { id: 'e2', source: 'b', target: 'c', label: 'relatedTo', properties: {} },
  ],
})

export function testSelectionZoomNodeSelectionUsesNodeAndNeighbors() {
  const graphData = makeZoomGraph()
  const ids = computeZoomTargetNodeIds({
    graphData,
    selectedNodeId: 'b',
    selectedEdgeId: null,
  })
  if (!ids.has('a') || !ids.has('b') || !ids.has('c') || ids.size !== 3) {
    throw new Error('zoom node selection should include selected node and its neighbors')
  }
  const subset = computeZoomSubset({
    graphData,
    selectedNodeId: 'b',
    selectedEdgeId: null,
  })
  const subsetIds = new Set(subset.map(n => n.id))
  if (!subsetIds.has('a') || !subsetIds.has('b') || !subsetIds.has('c') || subsetIds.has('d')) {
    throw new Error('zoom subset for node selection should only include node and neighbors')
  }
}

export function testSelectionZoomEdgeSelectionUsesEndpointsAndNeighbors() {
  const graphData = makeZoomGraph()
  const ids = computeZoomTargetNodeIds({
    graphData,
    selectedNodeId: null,
    selectedEdgeId: 'e1',
  })
  if (!ids.has('a') || !ids.has('b') || !ids.has('c') || ids.size !== 3) {
    throw new Error('zoom edge selection should include endpoints and their neighbors')
  }
  const subset = computeZoomSubset({
    graphData,
    selectedNodeId: null,
    selectedEdgeId: 'e1',
  })
  const subsetIds = new Set(subset.map(n => n.id))
  if (!subsetIds.has('a') || !subsetIds.has('b') || !subsetIds.has('c') || subsetIds.has('d')) {
    throw new Error('zoom subset for edge selection should only include endpoints and neighbors')
  }
}

export function testSelectionZoomNoSelectionReturnsEmptySubset() {
  const graphData = makeZoomGraph()
  const ids = computeZoomTargetNodeIds({
    graphData,
    selectedNodeId: null,
    selectedEdgeId: null,
  })
  if (ids.size !== 0) {
    throw new Error('zoom target ids should be empty when nothing is selected')
  }
  const subset = computeZoomSubset({
    graphData,
    selectedNodeId: null,
    selectedEdgeId: null,
  })
  if (subset.length !== 0) {
    throw new Error('zoom subset should be empty when nothing is selected')
  }
}

