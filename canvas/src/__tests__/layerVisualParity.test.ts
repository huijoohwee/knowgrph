import type { GraphData, GraphNode } from '@/lib/graph/types'
import { defaultSchema, MVP_COLOR_PALETTE, type GraphSchema } from '@/lib/graph/schema'
import { computeNodeVisual, type SelectionHighlightParams } from '@/components/GraphCanvas/highlight'
import { getLayerOpacity, getNodeBaseFill } from '@/components/GraphCanvas/helpers'
import { deriveGraphDataForLayers } from '@/lib/graph/layerDerivation'
import { getGraphLayerStyleForGroup, type NodeGroup } from '@/components/GraphCanvas/graphLayers'

const makeBaseSchema = (): GraphSchema => ({
  ...defaultSchema,
  layers: {
    mode: 'semantic',
    documentStructure: {
      minGroupSize: 2,
    },
  },
})

const makeNode = (overrides: Partial<GraphNode>): GraphNode => ({
  id: 'n1',
  type: 'Entity',
  label: 'Node',
  properties: {},
  ...overrides,
})

const makeGraph = (node: GraphNode): GraphData => ({
  type: 'Graph',
  nodes: [node],
  edges: [],
})

export function testSemanticLayerVisualFillParity2dVs3d() {
  const schema = makeBaseSchema()
  const node = makeNode({
    properties: {
      'visual:fill': '#ff8800',
    },
  })
  const data = makeGraph(node)
  const params: SelectionHighlightParams = {
    data,
    schema,
    selectedNodeId: null,
    selectedEdgeId: null,
    renderMediaAsNodes: true,
  }
  const neighborIds = new Set<string>()
  const visual = computeNodeVisual(node, { ...params, neighborIds })
  const baseFill2d = visual.fill
  const baseFill3d = getNodeBaseFill(node, schema)
  if (baseFill2d !== '#ff8800') {
    throw new Error(`expected 2D base fill to use visual:fill, got ${baseFill2d}`)
  }
  if (baseFill3d !== '#ff8800') {
    throw new Error(`expected 3D base fill to use visual:fill, got ${baseFill3d}`)
  }
}

export function testDocumentStructureLayerOpacityParity2dVs3d() {
  const schema: GraphSchema = {
    ...makeBaseSchema(),
    layers: {
      mode: 'document-structure',
      documentStructure: {
        minGroupSize: 2,
      },
    },
    three: {
      ...defaultSchema.three,
      layerOpacityByLayer: {
        '1': 1,
        '2': 0.5,
      },
    },
  }
  const node = makeNode({
    type: 'Document',
    properties: {
      'visual:layer': 2,
    },
  })
  const data = makeGraph(node)
  const params: SelectionHighlightParams = {
    data,
    schema,
    selectedNodeId: null,
    selectedEdgeId: null,
    renderMediaAsNodes: true,
  }
  const neighborIds = new Set<string>()
  const visual = computeNodeVisual(node, { ...params, neighborIds })
  const baseOpacity2d = visual.opacity
  const baseOpacity3d = getLayerOpacity(node, schema)
  if (baseOpacity2d !== baseOpacity3d) {
    throw new Error(`expected 2D and 3D opacity to match, got 2D=${baseOpacity2d} 3D=${baseOpacity3d}`)
  }
}

export function testLayerModeNodeBaseFillConsistentAcrossModes() {
  const baseNode = makeNode({
    type: 'Entity',
  })
  const baseGraph = makeGraph(baseNode)

  const schemaProperty: GraphSchema = {
    ...defaultSchema,
    nodeStyles: {
      ...defaultSchema.nodeStyles,
      Entity: {
        ...(defaultSchema.nodeStyles.Entity || {}),
        color: '#3366ff',
      },
    },
    layers: {
      mode: 'property',
    },
  }

  const schemaDocument: GraphSchema = {
    ...schemaProperty,
    layers: {
      mode: 'document-structure',
      documentStructure: {
        minGroupSize: 2,
      },
    },
  }

  const schemaSemantic: GraphSchema = {
    ...schemaProperty,
    layers: {
      mode: 'semantic',
      documentStructure: {
        minGroupSize: 2,
      },
      semantic: {
        ...(defaultSchema.layers?.semantic || {}),
        similarityEdgeLabel: 'relatedTo',
        textKeys: [],
        topKEdgesPerNode: 0,
        minSimilarity: 0,
      },
    },
  }

  const graphProperty = deriveGraphDataForLayers(baseGraph, schemaProperty)
  const graphDocument = deriveGraphDataForLayers(baseGraph, schemaDocument)
  const graphSemantic = deriveGraphDataForLayers(baseGraph, schemaSemantic)

  if (!graphProperty || !graphDocument || !graphSemantic) {
    throw new Error('expected all layer derivations to produce graph data')
  }

  const nodeProperty = graphProperty.nodes[0]
  const nodeDocument = graphDocument.nodes[0]
  const nodeSemantic = graphSemantic.nodes[0]

  const neighborIds = new Set<string>()

  const visualProperty = computeNodeVisual(nodeProperty, {
    data: graphProperty,
    schema: schemaProperty,
    selectedNodeId: null,
    selectedEdgeId: null,
    renderMediaAsNodes: true,
    neighborIds,
  })

  const visualDocument = computeNodeVisual(nodeDocument, {
    data: graphDocument,
    schema: schemaDocument,
    selectedNodeId: null,
    selectedEdgeId: null,
    renderMediaAsNodes: true,
    neighborIds,
  })

  const visualSemantic = computeNodeVisual(nodeSemantic, {
    data: graphSemantic,
    schema: schemaSemantic,
    selectedNodeId: null,
    selectedEdgeId: null,
    renderMediaAsNodes: true,
    neighborIds,
  })

  const fillProperty = visualProperty.fill
  const fillDocument = visualDocument.fill
  const fillSemantic = visualSemantic.fill

  if (fillProperty !== '#3366ff') {
    throw new Error(`expected property mode base fill to use schema nodeStyles color, got ${fillProperty}`)
  }
  if (fillDocument !== fillProperty) {
    throw new Error(`expected document-structure mode base fill to match property mode, got property=${fillProperty} document=${fillDocument}`)
  }
  if (fillSemantic !== fillProperty) {
    throw new Error(`expected semantic mode base fill to match property mode, got property=${fillProperty} semantic=${fillSemantic}`)
  }
}

export function testGraphLayerUsesRendererPaletteTagColors() {
  const schema: GraphSchema = {
    ...defaultSchema,
  }

  const owner: GraphNode = {
    id: 'owner-1',
    type: 'Entity',
    label: 'Owner',
    properties: {
      tags: ['alert'],
    },
  }

  const member: GraphNode = {
    id: 'member-1',
    type: 'Entity',
    label: 'Member',
    properties: {},
  }

  const data: GraphData = {
    type: 'Graph',
    nodes: [owner, member],
    edges: [],
  }

  const group: NodeGroup = {
    id: 'owner-1::items',
    memberIds: ['member-1'],
    meta: {
      groupBy: 'property',
      ownerId: 'owner-1',
      ownerType: 'Entity',
      propertyKey: 'items',
    },
  }

  const style = getGraphLayerStyleForGroup({
    group,
    graphData: data,
    schema,
  })

  const expected = MVP_COLOR_PALETTE.nodes.alert
  if (style.fill !== expected || style.stroke !== expected) {
    throw new Error(`expected graph layer style to use renderer:palette alert color ${expected}, got fill=${style.fill} stroke=${style.stroke}`)
  }
}
