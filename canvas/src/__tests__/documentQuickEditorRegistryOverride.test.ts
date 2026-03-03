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

