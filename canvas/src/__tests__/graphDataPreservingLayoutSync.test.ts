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

export function testSetGraphDataPreservingLayoutScopesFrontmatterFlowQuickEditorsByNodeId() {
  const store = useGraphStore.getState()
  store.clearGraphData()
  store.setNodeQuickEditorRegistry([])

  store.setGraphDataPreservingLayout({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [
      { id: 'n-canvas', type: 'input', label: 'Canvas', properties: { 'flow:quickEditorFormId': 'fm:n-canvas' }, metadata: {} },
      { id: 'n-pack', type: 'default', label: 'Pack', properties: { 'flow:quickEditorFormId': 'fm:n-pack' }, metadata: {} },
      { id: 'n-ai', type: 'default', label: 'AI', properties: { 'flow:quickEditorFormId': 'fm:n-ai' }, metadata: {} },
      { id: 'n-validate', type: 'default', label: 'Validate', properties: { 'flow:quickEditorFormId': 'fm:n-validate' }, metadata: {} },
      { id: 'n-render', type: 'output', label: 'Render', properties: { 'flow:quickEditorFormId': 'fm:n-render' }, metadata: {} },
    ],
    edges: [],
    metadata: {
      kind: 'frontmatter-flow',
      [FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY]: [
        { id: 'qe-canvas', nodeTypeId: 'input', quickEditorTypeId: 'default', formId: 'fm:n-canvas', updatedAt: '1', isEnabled: true, fields: [{ fieldKey: 'signal', fieldType: 'text' }], ports: [] },
        { id: 'qe-pack', nodeTypeId: 'default', quickEditorTypeId: 'default', formId: 'fm:n-pack', updatedAt: '1', isEnabled: true, fields: [{ fieldKey: 'context', fieldType: 'text' }], ports: [] },
        { id: 'qe-ai', nodeTypeId: 'default', quickEditorTypeId: 'default', formId: 'fm:n-ai', updatedAt: '1', isEnabled: true, fields: [{ fieldKey: 'model', fieldType: 'text' }], ports: [] },
        { id: 'qe-validate', nodeTypeId: 'default', quickEditorTypeId: 'default', formId: 'fm:n-validate', updatedAt: '1', isEnabled: true, fields: [{ fieldKey: 'rules', fieldType: 'text' }], ports: [] },
        { id: 'qe-render', nodeTypeId: 'output', quickEditorTypeId: 'default', formId: 'fm:n-render', updatedAt: '1', isEnabled: true, fields: [{ fieldKey: 'store', fieldType: 'text' }], ports: [] },
        { id: 'qe-stale', nodeTypeId: 'default', quickEditorTypeId: 'default', formId: 'fm:n-stale', updatedAt: '1', isEnabled: true, fields: [{ fieldKey: 'stale', fieldType: 'text' }], ports: [] },
        { id: 'qe-dup-ai', nodeTypeId: 'default', quickEditorTypeId: 'default', formId: 'fm:n-ai', updatedAt: '2', isEnabled: true, fields: [{ fieldKey: 'noise', fieldType: 'text' }], ports: [] },
      ],
    },
  } as never)

  const reg = useGraphStore.getState().documentNodeQuickEditorRegistry || []
  const forms = reg.map(r => String(r?.formId || '')).filter(Boolean).sort()
  const expected = ['fm:n-ai', 'fm:n-canvas', 'fm:n-pack', 'fm:n-render', 'fm:n-validate'].sort()
  if (JSON.stringify(forms) !== JSON.stringify(expected)) {
    throw new Error(`expected frontmatter-flow quick-editor forms to be node-id-scoped, got ${JSON.stringify(forms)}`)
  }
}
