import { useGraphStore } from '@/hooks/useGraphStore'

export function testFlowWidgetUiStateIsScopedByGraphMetaKey() {
  useGraphStore.getState().setDocumentStructureBaselineLock(false)

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [{ id: 'NODE_SVO', type: 'Node', label: 'SVO', properties: {} }],
    edges: [],
    metadata: { kind: 'frontmatter-flow', sourceLayerHash: 'graph-a' },
  } as never)

  useGraphStore.getState().setFlowWidgetPinnedByNodeId({ NODE_SVO: false })
  useGraphStore.getState().setFlowWidgetPosByNodeId({ NODE_SVO: { top: 10, left: 20 } })
  useGraphStore.getState().setFlowWidgetWorldPosByNodeId({ NODE_SVO: { x: 1, y: 2 } })

  const afterA = useGraphStore.getState()
  if (afterA.flowWidgetPinnedByNodeId.NODE_SVO !== false) throw new Error('expected pinned state for graph A')
  if (afterA.flowWidgetPosByNodeId.NODE_SVO?.top !== 10) throw new Error('expected pos for graph A')
  if (afterA.flowWidgetWorldPosByNodeId.NODE_SVO?.x !== 1) throw new Error('expected world pos for graph A')

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [{ id: 'NODE_SVO', type: 'Node', label: 'SVO', properties: {} }],
    edges: [],
    metadata: { kind: 'frontmatter-flow', sourceLayerHash: 'graph-b' },
  } as never)

  const afterB = useGraphStore.getState()
  if (Object.keys(afterB.flowWidgetPinnedByNodeId || {}).length !== 0) throw new Error('expected no pinned state for graph B')
  if (Object.keys(afterB.flowWidgetPosByNodeId || {}).length !== 0) throw new Error('expected no pos state for graph B')
  if (Object.keys(afterB.flowWidgetWorldPosByNodeId || {}).length !== 0) throw new Error('expected no world pos state for graph B')

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [{ id: 'NODE_SVO', type: 'Node', label: 'SVO', properties: {} }],
    edges: [],
    metadata: { kind: 'frontmatter-flow', sourceLayerHash: 'graph-a' },
  } as never)

  const afterARestore = useGraphStore.getState()
  if (afterARestore.flowWidgetPinnedByNodeId.NODE_SVO !== false) throw new Error('expected pinned restored for graph A')
  if (afterARestore.flowWidgetPosByNodeId.NODE_SVO?.left !== 20) throw new Error('expected pos restored for graph A')
  if (afterARestore.flowWidgetWorldPosByNodeId.NODE_SVO?.y !== 2) throw new Error('expected world pos restored for graph A')
}

export function testFlowWidgetUiStateCarriesAcrossSameSourceRecomposeHashChanges() {
  useGraphStore.getState().setDocumentStructureBaselineLock(false)

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [{ id: 'NODE_TEXT', type: 'TextGeneration', label: 'Text Widget', properties: {} }],
    edges: [{ id: 'EDGE_A', source: 'NODE_TEXT', target: 'NODE_TEXT' }],
    metadata: {
      kind: 'frontmatter-flow',
      source: 'workspace:/typed.md',
      sourceLayerHash: 'typed-hash-a',
    },
  } as never)

  useGraphStore.getState().setFlowWidgetPinnedByNodeId({ NODE_TEXT: true })
  useGraphStore.getState().setFlowWidgetPosByNodeId({ NODE_TEXT: { top: 120, left: 240 } })
  useGraphStore.getState().setFlowWidgetWorldPosByNodeId({ NODE_TEXT: { x: 12, y: 24 } })

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [{ id: 'NODE_TEXT', type: 'TextGeneration', label: 'Text Widget', properties: { prompt: 'updated' } }],
    edges: [{ id: 'EDGE_A', source: 'NODE_TEXT', target: 'NODE_TEXT' }],
    metadata: {
      kind: 'frontmatter-flow',
      source: 'workspace:/typed.md',
      sourceLayerHash: 'typed-hash-b',
    },
  } as never)

  const after = useGraphStore.getState()
  if (after.flowWidgetPinnedByNodeId.NODE_TEXT !== true) {
    throw new Error('expected same-source recomposition to preserve pinned widget state across sourceLayerHash changes')
  }
  if (after.flowWidgetPosByNodeId.NODE_TEXT?.top !== 120 || after.flowWidgetPosByNodeId.NODE_TEXT?.left !== 240) {
    throw new Error('expected same-source recomposition to preserve widget viewport position across sourceLayerHash changes')
  }
  if (after.flowWidgetWorldPosByNodeId.NODE_TEXT?.x !== 12 || after.flowWidgetWorldPosByNodeId.NODE_TEXT?.y !== 24) {
    throw new Error('expected same-source recomposition to preserve widget world position across sourceLayerHash changes')
  }
}

export function testFlowWidgetOverlayStateDoesNotCarryAcrossSameSourceLayoutChanges() {
  useGraphStore.getState().setDocumentStructureBaselineLock(false)

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [{ id: 'NODE_TEXT', type: 'TextGeneration', label: 'Text Widget', x: 0, y: 0, properties: {} }],
    edges: [],
    metadata: {
      kind: 'frontmatter-flow',
      source: 'workspace:/typed.md',
      sourceLayerHash: 'layout-hash-a',
    },
  } as never)

  useGraphStore.getState().setFlowWidgetPinnedByNodeId({ NODE_TEXT: true })
  useGraphStore.getState().setFlowWidgetPosByNodeId({ NODE_TEXT: { top: 120, left: 240 } })
  useGraphStore.getState().setFlowWidgetWorldPosByNodeId({ NODE_TEXT: { x: 12, y: 24 } })

  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [{ id: 'NODE_TEXT', type: 'TextGeneration', label: 'Text Widget', x: 640, y: 320, properties: {} }],
    edges: [],
    metadata: {
      kind: 'frontmatter-flow',
      source: 'workspace:/typed.md',
      sourceLayerHash: 'layout-hash-b',
    },
  } as never)

  const after = useGraphStore.getState()
  if (after.flowWidgetPinnedByNodeId.NODE_TEXT !== undefined) {
    throw new Error('expected layout-changing same-source recomposition to reset pinned widget state')
  }
  if (after.flowWidgetPosByNodeId.NODE_TEXT !== undefined) {
    throw new Error('expected layout-changing same-source recomposition to reset widget viewport position')
  }
  if (after.flowWidgetWorldPosByNodeId.NODE_TEXT !== undefined) {
    throw new Error('expected layout-changing same-source recomposition to reset widget world position')
  }
}
