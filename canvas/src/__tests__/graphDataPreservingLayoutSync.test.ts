import { useGraphStore } from '@/hooks/useGraphStore'
import { FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY } from '@/lib/config'

export function testSetGraphDataPreservingLayoutSyncsGraphFields() {
  const store = useGraphStore.getState()
  store.clearGraphData()

  store.setGraphData({
    type: 'Graph',
    nodes: [{ id: 'n1', type: 'Node', label: 'N1', properties: {}, metadata: {} }],
    edges: [],
    metadata: {},
  } as never)

  const beforeOrder = useGraphStore.getState().graphDataTableColumnOrder || []
  if (beforeOrder.includes('prop:node:foo' as never)) throw new Error('expected prop:node:foo to be absent before adding properties')

  store.setGraphDataPreservingLayout({
    type: 'Graph',
    nodes: [{ id: 'n1', type: 'Node', label: 'N1', properties: { foo: 'bar' }, metadata: {} }],
    edges: [],
    metadata: {},
  } as never)

  const after = useGraphStore.getState()
  const afterOrder = after.graphDataTableColumnOrder || []
  if (!afterOrder.includes('prop:node:foo' as never)) throw new Error('expected prop:node:foo to be added after preserving-layout update')

  const vis = (after.graphDataTableVisibleColumns || {}) as Record<string, boolean | undefined>
  if (vis['prop:node:foo'] !== true) throw new Error(`expected prop:node:foo visible, got ${String(vis['prop:node:foo'])}`)
}

export function testSetGraphDataPreservingLayoutAppliesQuickEditorRegistryFromMetadata() {
  const store = useGraphStore.getState()
  store.clearGraphData()

  store.setNodeQuickEditorRegistry([])
  store.setGraphDataPreservingLayout({
    type: 'Graph',
    nodes: [],
    edges: [],
    metadata: {
      [FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY]: [
        {
          id: 'qe1',
          nodeTypeId: 'VideoGeneration',
          quickEditorTypeId: 'kg.flow',
          formId: 'kg.flow.form',
          updatedAt: '1',
          isEnabled: true,
          fields: [{ fieldKey: 'prompt', fieldType: 'text' }],
          ports: [],
        },
      ],
    },
  } as never)

  const reg = useGraphStore.getState().documentNodeQuickEditorRegistry || []
  if (reg.length !== 1) throw new Error(`expected 1 registry entry, got ${reg.length}`)
  if (String(reg[0]?.id || '') !== 'qe1') throw new Error(`expected registry id qe1, got ${String(reg[0]?.id || '')}`)

  const effective = useGraphStore.getState().effectiveNodeQuickEditorRegistry || []
  if (effective.length !== 1) throw new Error(`expected 1 effective registry entry, got ${effective.length}`)
  if (String(effective[0]?.id || '') !== 'qe1') throw new Error(`expected effective registry id qe1, got ${String(effective[0]?.id || '')}`)
}
