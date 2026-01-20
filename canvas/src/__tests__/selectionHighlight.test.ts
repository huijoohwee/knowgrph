import type { GraphData } from '@/lib/graph/types'
import { defaultSchema, type GraphSchema } from '@/lib/graph/schema'
import {
  computeNeighborIds,
  computeNodeVisual,
  computeLabelVisual,
  computeEdgeVisual,
  type SelectionHighlightParams,
} from '@/components/GraphCanvas/highlight'
import type { EdgeWithRuntime } from '@/components/GraphCanvas/utils'

const makeSchema = (): GraphSchema => ({
  ...defaultSchema,
  nodeStyles: {
    ...defaultSchema.nodeStyles,
    Entity: { color: '#007BFF' },
  },
})

const makeLinearGraph = (): GraphData => ({
  type: 'Graph',
  nodes: [
    { id: 'a', label: 'A', type: 'Entity', properties: {} },
    { id: 'b', label: 'B', type: 'Entity', properties: {} },
    { id: 'c', label: 'C', type: 'Entity', properties: {} },
  ],
  edges: [
    { id: 'e1', source: 'a', target: 'b', label: 'relatedTo', properties: {} },
    { id: 'e2', source: 'b', target: 'c', label: 'relatedTo', properties: {} },
  ],
})

export function testSelectionHighlightNeighborsFromNodeSelection() {
  const data = makeLinearGraph()
  const schema = makeSchema()
  const params: SelectionHighlightParams = {
    data,
    schema,
    selectedNodeId: 'b',
    selectedEdgeId: null,
    renderMediaAsNodes: true,
  }
  const neighborIds = computeNeighborIds(params)
  if (!neighborIds.has('a') || !neighborIds.has('c') || neighborIds.size !== 2) {
    throw new Error('node selection should highlight both neighbors')
  }
  const center = data.nodes[1]
  const left = data.nodes[0]
  const right = data.nodes[2]
  const centerVisual = computeNodeVisual(center, { ...params, neighborIds })
  const leftVisual = computeNodeVisual(left, { ...params, neighborIds })
  const rightVisual = computeNodeVisual(right, { ...params, neighborIds })
  if (centerVisual.fill !== '#007BFF' || centerVisual.opacity !== 1) {
    throw new Error('selected node should be blue and fully opaque')
  }
  if (leftVisual.opacity !== 1 || rightVisual.opacity !== 1) {
    throw new Error('neighbor nodes should be fully opaque')
  }
  if (leftVisual.fill === '#9CA3AF' || rightVisual.fill === '#9CA3AF') {
    throw new Error('neighbor nodes should use base fill, not dimmed gray')
  }
  const centerLabel = computeLabelVisual(center, { ...params, neighborIds })
  const leftLabel = computeLabelVisual(left, { ...params, neighborIds })
  const rightLabel = computeLabelVisual(right, { ...params, neighborIds })
  if (centerLabel.opacity !== 1) {
    throw new Error('selected node label should be fully opaque')
  }
  if (leftLabel.opacity !== 1 || rightLabel.opacity !== 1) {
    throw new Error('neighbor labels should be fully opaque')
  }
}

export function testSelectionHighlightEdgeSelectionEndpointsAndEdges() {
  const data = makeLinearGraph()
  const schema = makeSchema()
  const params: SelectionHighlightParams = {
    data,
    schema,
    selectedNodeId: null,
    selectedEdgeId: 'e1',
    renderMediaAsNodes: true,
  }
  const neighborIds = computeNeighborIds(params)
  if (neighborIds.size !== 0) {
    throw new Error('edge selection should not compute neighborIds')
  }
  const a = data.nodes[0]
  const b = data.nodes[1]
  const c = data.nodes[2]
  const aVisual = computeNodeVisual(a, { ...params, neighborIds })
  const bVisual = computeNodeVisual(b, { ...params, neighborIds })
  const cVisual = computeNodeVisual(c, { ...params, neighborIds })
  if (aVisual.opacity !== 1 || bVisual.opacity !== 1) {
    throw new Error('edge endpoints should remain fully opaque')
  }
  if (cVisual.opacity !== 0.2 || cVisual.fill !== '#9CA3AF') {
    throw new Error('non-endpoint nodes should be dimmed gray on edge selection')
  }
  const aLabel = computeLabelVisual(a, { ...params, neighborIds })
  const bLabel = computeLabelVisual(b, { ...params, neighborIds })
  const cLabel = computeLabelVisual(c, { ...params, neighborIds })
  if (aLabel.opacity !== 1 || bLabel.opacity !== 1) {
    throw new Error('labels at edge endpoints should be fully opaque')
  }
  if (cLabel.opacity !== 0.2) {
    throw new Error('non-endpoint labels should be dimmed on edge selection')
  }
  const e1: EdgeWithRuntime = data.edges[0]
  const e2: EdgeWithRuntime = data.edges[1]
  const e1Visual = computeEdgeVisual(e1, params)
  const e2Visual = computeEdgeVisual(e2, params)
  if (e1Visual.stroke !== '#007BFF' || e1Visual.opacity !== 0.9 || e1Visual.width <= e2Visual.width) {
    throw new Error('selected edge should be blue, more opaque, and thicker')
  }
  if (e2Visual.stroke !== '#9CA3AF' || e2Visual.opacity !== 0.2) {
    throw new Error('non-selected edges should be gray and dimmed')
  }
}
