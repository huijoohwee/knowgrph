import { computeFlowHandlesByNode } from '@/components/FlowCanvas/handles'

export const testFlowSchemaFieldPortKeysCreateStableHandlesForSchemaFields = () => {
  const nodes = [
    {
      id: 't1',
      properties: {
        'schema:fields': ['id', { title: 'warehouse_id', type: 'uuid' }],
      },
    },
    { id: 't2', properties: {} },
  ]

  const edges = [
    {
      id: 'e1',
      source: 't1',
      target: 't2',
      properties: { 'flow:sourcePortKey': 'field:warehouse_id', 'flow:targetPortKey': 'field:id' },
    },
  ]

  const byNode = computeFlowHandlesByNode({ nodes, edges })
  const t1 = byNode['t1']
  const t2 = byNode['t2']
  if (!t1) throw new Error('expected handles for t1')
  if (!t2) throw new Error('expected handles for t2')

  const t1OutIds = new Set((t1.out || []).map(h => h.id))
  if (!t1OutIds.has('out:field:id')) throw new Error('expected schema field out handle out:field:id')
  if (!t1OutIds.has('out:field:warehouse_id')) throw new Error('expected schema field out handle out:field:warehouse_id')

  const t2InIds = new Set((t2.in || []).map(h => h.id))
  if (!t2InIds.has('in:field:id')) throw new Error('expected target port handle in:field:id')
}

