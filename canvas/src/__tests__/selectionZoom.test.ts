import type { GraphData } from '@/lib/graph/types'
import { computeZoomTargetNodeIds, computeZoomSubset } from '@/components/GraphCanvas/selectionZoom'
import { fitAllTransform } from '@/components/GraphCanvas/fit'
import { createCanvasSlice } from '@/hooks/store/canvasSlice'
import type { GraphState } from '@/hooks/store/types'
import type { StoreApi } from 'zustand'

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

const makeCanvasSliceState = (): GraphState => {
  let state = {} as GraphState
  const get = () => state
  const set: StoreApi<GraphState>['setState'] = (partial, replace) => {
    if (typeof partial === 'function') {
      const next = partial(state)
      state = (replace ? next : { ...state, ...next }) as GraphState
    } else {
      state = (replace ? partial : { ...state, ...partial }) as GraphState
    }
  }
  const slice = createCanvasSlice(set, get)
  state = { ...state, ...slice }
  return state
}

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

export function testFitToScreenModeDefaultsOnAndFitsFullGraph() {
  const state = makeCanvasSliceState()
  if (state.fitToScreenMode !== true) {
    throw new Error('fitToScreenMode should default to true on canvas initialization')
  }
  const graphData = makeZoomGraph()
  const width = 800
  const height = 600
  const t = fitAllTransform(graphData.nodes, width, height)
  const xs = graphData.nodes.map(n => n.x || 0)
  const ys = graphData.nodes.map(n => n.y || 0)
  const minX = Math.min(...xs, 0)
  const maxX = Math.max(...xs, 0)
  const minY = Math.min(...ys, 0)
  const maxY = Math.max(...ys, 0)
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const screenCx = t.k * cx + t.x
  const screenCy = t.k * cy + t.y
  const targetCx = width / 2
  const targetCy = height / 2
  if (Math.abs(screenCx - targetCx) > 1e-6 || Math.abs(screenCy - targetCy) > 1e-6) {
    throw new Error('fitAllTransform should center the full graph in the viewport when Fit to Screen is active')
  }
}

export function testFitToScreenCentersSingleNodeGraph() {
  const width = 800
  const height = 600
  const graphData: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'n1', label: 'N1', type: 'Entity', properties: {}, x: 120, y: -40 }],
    edges: [],
  }
  const t = fitAllTransform(graphData.nodes, width, height)
  const node = graphData.nodes[0]
  const screenX = t.k * (node.x || 0) + t.x
  const screenY = t.k * (node.y || 0) + t.y
  const targetX = width / 2
  const targetY = height / 2
  if (Math.abs(screenX - targetX) > 1e-6 || Math.abs(screenY - targetY) > 1e-6) {
    throw new Error('fitAllTransform should center a single node graph in the viewport')
  }
}
