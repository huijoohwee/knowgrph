import { useGraphStore } from '@/hooks/useGraphStore'

export const testSemanticModeSwitchDoesNotToastWhenNoSelection = () => {
  const api = useGraphStore.getState()
  api.resetAll()
  useGraphStore.setState({
    uiToasts: [],
    documentStructureBaselineLock: false,
    graphData: { type: 'Graph', context: '', nodes: [{ id: 'n1', label: 'A', type: 'Node', properties: {} }], edges: [] },
  })

  api.setDocumentSemanticMode('keyword')

  const toasts = useGraphStore.getState().uiToasts || []
  if (toasts.some(t => t.id === 'selection-cleared-mode')) {
    throw new Error('expected no selection-cleared toast when switching modes with no selection')
  }
}

export const testSemanticModeSwitchToKeywordToastsWhenSelectionCleared = () => {
  const api = useGraphStore.getState()
  api.resetAll()
  useGraphStore.setState({
    uiToasts: [],
    documentStructureBaselineLock: false,
    graphData: { type: 'Graph', context: '', nodes: [{ id: 'n1', label: 'A', type: 'Node', properties: {} }], edges: [] },
    selectedNodeId: 'n1',
  })

  api.setDocumentSemanticMode('keyword')

  const st = useGraphStore.getState()
  const toasts = st.uiToasts || []
  if (!toasts.some(t => t.id === 'selection-cleared-mode')) {
    const ids = toasts.map(t => String(t.id)).join(',')
    throw new Error(`expected selection-cleared toast when switching to keyword clears selection; got toasts=[${ids}] mode=${String(st.documentSemanticMode)}`)
  }
  if (st.selectedNodeId != null) {
    throw new Error('expected selected node to be cleared when switching to keyword without media-like props')
  }
}
