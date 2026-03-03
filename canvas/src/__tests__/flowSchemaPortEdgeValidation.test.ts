import type { GraphData, GraphEdge } from '@/lib/graph/types'
import { defaultSchema } from '@/lib/graph/schema'
import { canAddEdge } from '@/features/schema/validation'
import { buildFlowEdgeDisplayLabelFromPorts } from '@/lib/graph/flowPorts'

export const testFlowSchemaPortsInfluenceEdgeValidation = () => {
  const schema = {
    ...defaultSchema,
    endpointMatrix: {
      ...(defaultSchema.endpointMatrix || {}),
      linksTo: { sources: ['Schema'], targets: ['Schema'] },
    },
  }

  const data: GraphData = {
    type: 'graph',
    nodes: [
      {
        id: 't1',
        type: 'Schema',
        label: 'T1',
        properties: {
          'schema:fields': [{ title: 'warehouse_id', type: 'uuid' }, { title: 'id', type: 'uuid' }],
        },
      },
      {
        id: 't2',
        type: 'Schema',
        label: 'T2',
        properties: {
          'schema:fields': [{ title: 'id', type: 'uuid' }, { title: 'name', type: 'text' }],
        },
      },
      {
        id: 'n1',
        type: 'Node',
        label: 'N1',
        properties: {},
      },
    ],
    edges: [],
    metadata: {},
  }

  const okEdge: GraphEdge = {
    id: 'e1',
    source: 't1',
    target: 't2',
    label: 'linksTo',
    properties: { 'flow:sourcePortKey': 'field:warehouse_id', 'flow:targetPortKey': 'field:id' },
  }
  if (!canAddEdge(schema, data, okEdge)) throw new Error('expected uuid→uuid schema-field edge to be allowed')

  const badType: GraphEdge = {
    ...okEdge,
    id: 'e2',
    properties: { 'flow:sourcePortKey': 'field:warehouse_id', 'flow:targetPortKey': 'field:name' },
  }
  if (canAddEdge(schema, data, badType)) throw new Error('expected uuid→text schema-field edge to be denied')

  const badPort: GraphEdge = {
    ...okEdge,
    id: 'e3',
    properties: { 'flow:sourcePortKey': 'field:missing', 'flow:targetPortKey': 'field:id' },
  }
  if (canAddEdge(schema, data, badPort)) throw new Error('expected missing schema-field port to be denied')

  const badEndpointMatrix: GraphEdge = {
    ...okEdge,
    id: 'e4',
    target: 'n1',
  }
  if (canAddEdge(schema, data, badEndpointMatrix)) throw new Error('expected endpointMatrix to deny Schema→Node for linksTo')
}

export const testFlowSchemaPortsBuildDisplayLabel = () => {
  const sourceNode = {
    properties: { 'schema:fields': [{ title: 'warehouse_id', type: 'uuid' }, { title: 'id', type: 'uuid' }] },
  }
  const targetNode = {
    properties: { 'schema:fields': [{ title: 'id', type: 'uuid' }] },
  }
  const label = buildFlowEdgeDisplayLabelFromPorts({
    sourceNode,
    targetNode,
    sourcePortKey: 'field:warehouse_id',
    targetPortKey: 'field:id',
  })
  if (label !== 'warehouse_id → id') throw new Error(`expected display label "warehouse_id → id", got ${String(label)}`)
}

export const testFlowTypedPortsInfluenceEdgeValidation = () => {
  const schema = {
    ...defaultSchema,
    endpointMatrix: {
      ...(defaultSchema.endpointMatrix || {}),
      linksTo: { sources: ['Node'], targets: ['Node'] },
    },
  }

  const data: GraphData = {
    type: 'graph',
    nodes: [
      {
        id: 'a',
        type: 'Node',
        label: 'A',
        properties: {
          'flow:portTypes': { out: { out_1: 'VIDEO_CLIP' }, in: {} },
        },
      },
      {
        id: 'b',
        type: 'Node',
        label: 'B',
        properties: {
          'flow:portTypes': { in: { in_1: 'VIDEO_SEQUENCE', in_2: 'VIDEO_CLIP' }, out: {} },
        },
      },
      {
        id: 'c',
        type: 'Node',
        label: 'C',
        properties: {
          'flow:portTypes': { in: { in_1: 'AUDIO_CLIP' }, out: {} },
        },
      },
    ],
    edges: [],
    metadata: {
      socketTypes: {
        VIDEO_CLIP: { accepts: ['VIDEO_CLIP'] },
        VIDEO_SEQUENCE: { accepts: ['VIDEO_SEQUENCE', 'VIDEO_CLIP'] },
        AUDIO_CLIP: { accepts: ['AUDIO_CLIP'] },
      },
    },
  }

  const okEdge: GraphEdge = {
    id: 'e1',
    source: 'a',
    target: 'b',
    label: 'linksTo',
    properties: { 'flow:sourcePortKey': 'out_1', 'flow:targetPortKey': 'in_2' },
  }
  if (!canAddEdge(schema, data, okEdge)) throw new Error('expected VIDEO_CLIP→VIDEO_CLIP edge to be allowed')

  const promoted: GraphEdge = {
    ...okEdge,
    id: 'e2',
    properties: { 'flow:sourcePortKey': 'out_1', 'flow:targetPortKey': 'in_1' },
  }
  if (!canAddEdge(schema, data, promoted)) throw new Error('expected VIDEO_CLIP→VIDEO_SEQUENCE edge to be allowed via accepts')

  const badEdge: GraphEdge = {
    ...okEdge,
    id: 'e3',
    target: 'c',
    properties: { 'flow:sourcePortKey': 'out_1', 'flow:targetPortKey': 'in_1' },
  }
  if (canAddEdge(schema, data, badEdge)) throw new Error('expected VIDEO_CLIP→AUDIO_CLIP edge to be denied')
}
