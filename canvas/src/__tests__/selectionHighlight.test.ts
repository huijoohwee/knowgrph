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
  if (centerVisual.fill !== 'var(--kg-canvas-accent)' || centerVisual.opacity !== 1) {
    throw new Error('selected node should use accent fill and be fully opaque')
  }
  if (leftVisual.opacity !== 1 || rightVisual.opacity !== 1) {
    throw new Error('neighbor nodes should be fully opaque')
  }
  if (leftVisual.fill === 'var(--kg-canvas-edge-stroke)' || rightVisual.fill === 'var(--kg-canvas-edge-stroke)') {
    throw new Error('neighbor nodes should use base fill, not dimmed edge stroke')
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
  if (cVisual.opacity !== 0.2 || cVisual.fill !== 'var(--kg-canvas-edge-stroke)') {
    throw new Error('non-endpoint nodes should be dimmed using edge stroke on edge selection')
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
  if (e1Visual.stroke !== 'var(--kg-canvas-accent)' || e1Visual.opacity !== 0.9 || e1Visual.width <= e2Visual.width) {
    throw new Error('selected edge should use accent stroke, be more opaque, and thicker')
  }
  if (e2Visual.stroke !== 'var(--kg-canvas-edge-stroke)' || e2Visual.opacity !== 0.2) {
    throw new Error('non-selected edges should use edge stroke and be dimmed')
  }
}

export function testSelectionHighlightMediaOpacityRespectsRenderToggleAndLayerOpacity() {
  const schema = makeSchema()
  const data: GraphData = {
    type: 'Graph',
    nodes: [
      {
        id: 'm',
        label: 'Media',
        type: 'Entity',
        properties: { media_kind: 'image', media_url: 'https://example.com/a.png', 'visual:layer': 3 },
      },
    ],
    edges: [],
  }

  const baseParams: SelectionHighlightParams = {
    data,
    schema,
    selectedNodeId: null,
    selectedEdgeId: null,
    renderMediaAsNodes: true,
    mediaNodeOpacity: 0.5,
  }
  const neighborIds = computeNeighborIds(baseParams)
  const v = computeNodeVisual(data.nodes[0], { ...baseParams, neighborIds })
  if (Math.abs(v.opacity - 0.4) > 1e-6) {
    throw new Error(`expected media opacity to respect layer opacity (got ${v.opacity})`)
  }

  const vOff = computeNodeVisual(data.nodes[0], { ...baseParams, renderMediaAsNodes: false, neighborIds })
  if (Math.abs(vOff.opacity - 0.8) > 1e-6) {
    throw new Error(`expected media node to use layer opacity when Rich Media is off (got ${vOff.opacity})`)
  }
}

export function testSelectionHighlightLabelOpacityDoesNotDisappearAtZeroLayerOpacity() {
  const schema = makeSchema()
  schema.three = { ...(schema.three || {}), layerOpacityByLayer: { '2': 0 } }
  const data: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'a', label: 'A', type: 'Entity', properties: { 'visual:layer': 2 } }],
    edges: [],
  }
  const params: SelectionHighlightParams = {
    data,
    schema,
    selectedNodeId: null,
    selectedEdgeId: null,
    renderMediaAsNodes: true,
  }
  const neighborIds = computeNeighborIds(params)
  const v = computeLabelVisual(data.nodes[0], { ...params, neighborIds })
  if (v.opacity < 0.65) {
    throw new Error(`expected label opacity to have a floor even when layer opacity is 0 (got ${v.opacity})`)
  }
}
