import { useGraphStore } from '@/hooks/useGraphStore'
import { FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY } from '@/lib/config'

export function testDocumentQuickEditorRegistryOverrideDoesNotOverwriteGlobal() {
  const store = useGraphStore.getState()
  store.clearGraphData()

  store.setNodeQuickEditorRegistry([
    {
      id: 'global1',
      nodeTypeId: 'VideoGeneration',
      quickEditorTypeId: 'default',
      formId: 'videoGeneration',
      updatedAt: '1',
      isEnabled: true,
      fields: [],
      ports: [{ portKey: 'reference_image', direction: 'input' }],
    },
  ] as never)

  store.setGraphDataPreservingLayout({
    type: 'Graph',
    nodes: [],
    edges: [],
    metadata: {
      [FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY]: [
        {
          id: 'doc1',
          nodeTypeId: 'VideoGeneration',
          quickEditorTypeId: 'default',
          formId: 'videoGeneration',
          updatedAt: '2',
          isEnabled: true,
          fields: [],
          ports: [{ portKey: 'videoUrl', direction: 'output' }],
        },
      ],
    },
  } as never)

  const afterDoc = useGraphStore.getState()
  if ((afterDoc.nodeQuickEditorRegistry || []).length !== 1) throw new Error('expected global registry to remain unchanged')
  if (String(afterDoc.nodeQuickEditorRegistry?.[0]?.id || '') !== 'global1') throw new Error('expected global registry id global1')
  if ((afterDoc.documentNodeQuickEditorRegistry || []).length !== 1) throw new Error('expected document registry to be set')
  if (String(afterDoc.documentNodeQuickEditorRegistry?.[0]?.id || '') !== 'doc1') throw new Error('expected document registry id doc1')
  if ((afterDoc.effectiveNodeQuickEditorRegistry || []).length !== 1) throw new Error('expected effective registry to prefer document registry')
  if (String(afterDoc.effectiveNodeQuickEditorRegistry?.[0]?.id || '') !== 'doc1') throw new Error('expected effective registry id doc1')

  store.setGraphDataPreservingLayout({
    type: 'Graph',
    nodes: [],
    edges: [],
    metadata: {},
  } as never)

  const afterClear = useGraphStore.getState()
  if ((afterClear.documentNodeQuickEditorRegistry || []).length !== 0) throw new Error('expected document registry to clear')
  if ((afterClear.effectiveNodeQuickEditorRegistry || []).length !== 1) throw new Error('expected effective registry to fall back to global')
  if (String(afterClear.effectiveNodeQuickEditorRegistry?.[0]?.id || '') !== 'global1') throw new Error('expected effective registry id global1')
}

export function testFrontmatterFlowEffectiveRegistryDoesNotMergeGlobalQuickEditors() {
  const store = useGraphStore.getState()
  store.clearGraphData()
  store.setNodeQuickEditorRegistry([
    {
      id: 'global-unrelated',
      nodeTypeId: 'default',
      quickEditorTypeId: 'default',
      formId: 'global:default',
      updatedAt: '1',
      isEnabled: true,
      fields: [{ fieldKey: 'global', fieldType: 'text' }],
      ports: [],
    },
  ] as never)

  store.setGraphDataPreservingLayout({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [{ id: 'n-pack', type: 'default', label: 'Pack', properties: { 'flow:quickEditorFormId': 'fm:n-pack' }, metadata: {} }],
    edges: [],
    metadata: {
      kind: 'frontmatter-flow',
      [FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY]: [
        {
          id: 'doc-pack',
          nodeTypeId: 'default',
          quickEditorTypeId: 'default',
          formId: 'fm:n-pack',
          updatedAt: '2',
          isEnabled: true,
          fields: [{ fieldKey: 'context', fieldType: 'text' }],
          ports: [],
        },
      ],
    },
  } as never)

  const current = useGraphStore.getState()
  const effective = current.effectiveNodeQuickEditorRegistry || []
  if (effective.length !== 1) throw new Error(`expected frontmatter-flow effective registry to avoid global merge, got ${effective.length}`)
  if (String(effective[0]?.id || '') !== 'doc-pack') throw new Error(`expected frontmatter-flow effective registry id doc-pack, got ${String(effective[0]?.id || '')}`)
}

export function testDocumentEffectiveRegistryStaysAuthoritativeAfterGlobalRegistryRefresh() {
  const store = useGraphStore.getState()
  store.clearGraphData()
  store.setNodeQuickEditorRegistry([
    {
      id: 'global-1',
      nodeTypeId: 'default',
      quickEditorTypeId: 'default',
      formId: 'global:default',
      updatedAt: '1',
      isEnabled: true,
      fields: [{ fieldKey: 'globalA', fieldType: 'text' }],
      ports: [],
    },
  ] as never)
  store.setDocumentNodeQuickEditorRegistry([
    {
      id: 'doc-1',
      nodeTypeId: 'default',
      quickEditorTypeId: 'default',
      formId: 'fm:n-pack',
      updatedAt: '2',
      isEnabled: true,
      fields: [{ fieldKey: 'docA', fieldType: 'text' }],
      ports: [],
    },
  ] as never)

  // Simulate delayed global registry refresh after document registry has already been set.
  store.setNodeQuickEditorRegistry([
    {
      id: 'global-1',
      nodeTypeId: 'default',
      quickEditorTypeId: 'default',
      formId: 'global:default',
      updatedAt: '3',
      isEnabled: true,
      fields: [{ fieldKey: 'globalA', fieldType: 'text' }],
      ports: [],
    },
    {
      id: 'global-2',
      nodeTypeId: 'default',
      quickEditorTypeId: 'default',
      formId: 'global:extra',
      updatedAt: '3',
      isEnabled: true,
      fields: [{ fieldKey: 'globalB', fieldType: 'text' }],
      ports: [],
    },
  ] as never)

  const state = useGraphStore.getState()
  const effective = state.effectiveNodeQuickEditorRegistry || []
  if (effective.length !== 1) throw new Error(`expected effective registry to remain document-only after global refresh, got ${effective.length}`)
  if (String(effective[0]?.id || '') !== 'doc-1') throw new Error(`expected effective registry id doc-1 after global refresh, got ${String(effective[0]?.id || '')}`)
}

export function testFrontmatterFlowWithoutDocumentRegistryDoesNotFallbackToGlobalRegistry() {
  const store = useGraphStore.getState()
  store.clearGraphData()
  store.setNodeQuickEditorRegistry([
    {
      id: 'global-default',
      nodeTypeId: 'default',
      quickEditorTypeId: 'default',
      formId: 'global:default',
      updatedAt: '1',
      isEnabled: true,
      fields: [{ fieldKey: 'global', fieldType: 'text' }],
      ports: [],
    },
  ] as never)

  store.setGraphDataPreservingLayout({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [{ id: 'n-pack', type: 'default', label: 'Pack', properties: {}, metadata: {} }],
    edges: [],
    metadata: { kind: 'frontmatter-flow' },
  } as never)

  const state = useGraphStore.getState()
  const effective = state.effectiveNodeQuickEditorRegistry || []
  if (effective.length !== 0) {
    throw new Error(`expected no effective quick-editors before frontmatter document registry hydration, got ${effective.length}`)
  }
}

export function testFrontmatterFlowOpenQuickEditorIdsAreScopedByRegistryForms() {
  const store = useGraphStore.getState()
  store.clearGraphData()
  store.setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [
      { id: 'n-pack', type: 'default', label: 'Pack', properties: {}, metadata: {} },
      { id: 'n-other', type: 'default', label: 'Other', properties: {}, metadata: {} },
    ],
    edges: [],
    metadata: {
      kind: 'frontmatter-flow',
      [FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY]: [
        {
          id: 'doc-pack',
          nodeTypeId: 'default',
          quickEditorTypeId: 'default',
          formId: 'fm:n-pack',
          updatedAt: '2',
          isEnabled: true,
          fields: [{ fieldKey: 'context', fieldType: 'text' }],
          ports: [],
        },
      ],
    },
  } as never)

  store.setOpenQuickEditorNodeIds(['n-pack', 'n-other'])
  const ids = useGraphStore.getState().openQuickEditorNodeIds || []
  if (ids.length !== 1 || ids[0] !== 'n-pack') {
    throw new Error(`expected frontmatter-flow open quick-editor ids to stay registry-scoped, got ${JSON.stringify(ids)}`)
  }
}
