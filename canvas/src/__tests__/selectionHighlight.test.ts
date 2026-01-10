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
    Entity: { color: '#2563eb' },
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
  if (centerVisual.fill !== '#3B82F6' || centerVisual.opacity !== 1) {
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
  if (e1Visual.stroke !== '#3B82F6' || e1Visual.opacity !== 0.9 || e1Visual.width <= e2Visual.width) {
    throw new Error('selected edge should be blue, more opaque, and thicker')
  }
  if (e2Visual.stroke !== '#9CA3AF' || e2Visual.opacity !== 0.2) {
    throw new Error('non-selected edges should be gray and dimmed')
  }
}

const makeMermaidGraph = (): GraphData => ({
  type: 'Graph',
  nodes: [
    { id: 'Input', label: 'Input', type: 'MermaidNode', properties: {} },
    { id: 'Retrieval', label: 'Retrieval', type: 'MermaidNode', properties: {} },
    { id: 'Augmentation', label: 'Augmentation', type: 'MermaidNode', properties: {} },
    { id: 'Generation', label: 'Generation', type: 'MermaidNode', properties: {} },
    { id: 'Output', label: 'Output', type: 'MermaidNode', properties: {} },
  ],
  edges: [
    { id: 'pe1', source: 'Input', target: 'Retrieval', label: 'pointsTo', properties: {} },
    { id: 'pe2', source: 'Retrieval', target: 'Augmentation', label: 'pointsTo', properties: {} },
    { id: 'pe3', source: 'Augmentation', target: 'Generation', label: 'pointsTo', properties: {} },
    { id: 'pe4', source: 'Generation', target: 'Output', label: 'pointsTo', properties: {} },
  ],
})

export function testSelectionHighlightMermaidPointsToPath() {
  const data = makeMermaidGraph()
  const schema = makeSchema()
  const params: SelectionHighlightParams = {
    data,
    schema,
    selectedNodeId: 'Input',
    selectedEdgeId: null,
    renderMediaAsNodes: true,
  }
  const neighborIds = computeNeighborIds(params)
  const expected = ['Retrieval', 'Augmentation', 'Generation', 'Output']
  for (let i = 0; i < expected.length; i += 1) {
    if (!neighborIds.has(expected[i])) {
      throw new Error('Mermaid pipeline selection should highlight full pointsTo path nodes')
    }
  }
  if (neighborIds.size !== expected.length) {
    throw new Error('Mermaid pipeline neighborIds should only contain path nodes')
  }
  const pe1: EdgeWithRuntime = data.edges[0]
  const pe2: EdgeWithRuntime = data.edges[1]
  const pe3: EdgeWithRuntime = data.edges[2]
  const pe4: EdgeWithRuntime = data.edges[3]
  const edgeParams = { ...params, neighborIds }
  const v1 = computeEdgeVisual(pe1, edgeParams)
  const v2 = computeEdgeVisual(pe2, edgeParams)
  const v3 = computeEdgeVisual(pe3, edgeParams)
  const v4 = computeEdgeVisual(pe4, edgeParams)
  const all = [v1, v2, v3, v4]
  for (let i = 0; i < all.length; i += 1) {
    const v = all[i]
    if (v.stroke !== '#3B82F6' || v.opacity !== 0.9) {
      throw new Error('Mermaid pipeline edges should be highlighted along the pointsTo path')
    }
  }
}

export function testLayerBandDimmingUsesVisualLayerMetadata() {
  const data: GraphData = {
    type: 'Graph',
    nodes: [
      { id: 'n1', label: 'Layer1', type: 'Entity', properties: { 'visual:layer': 1 } },
      { id: 'n2', label: 'Layer2', type: 'Entity', properties: { 'visual:layer': 2 } },
    ],
    edges: [],
  }
  const schema = makeSchema()
  const params: SelectionHighlightParams = {
    data,
    schema,
    selectedNodeId: null,
    selectedEdgeId: null,
    renderMediaAsNodes: true,
    activeLayerBandIndex: 1,
  }
  const neighborIds = computeNeighborIds(params)
  const n1 = data.nodes[0]
  const n2 = data.nodes[1]
  const v1 = computeNodeVisual(n1, { ...params, neighborIds })
  const v2 = computeNodeVisual(n2, { ...params, neighborIds })
  if (!(v1.opacity > v2.opacity)) {
    throw new Error('nodes outside the active layer band should be dimmed')
  }
}
