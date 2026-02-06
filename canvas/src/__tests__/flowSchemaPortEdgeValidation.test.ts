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
