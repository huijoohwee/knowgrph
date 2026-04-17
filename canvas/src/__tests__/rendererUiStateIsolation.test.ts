import { useGraphStore } from '@/hooks/useGraphStore'

export function testRendererUiStateIsolationKeepsPointerModePerRenderer() {
  useGraphStore.getState().setDocumentStructureBaselineLock(false)
  useGraphStore.getState().setCanvas2dRenderer('d3')
  useGraphStore.getState().setCanvasPointerMode2d('pan')
  useGraphStore.getState().setCanvas2dRenderer('flow')
  const afterFlow = useGraphStore.getState()
  if (afterFlow.canvasPointerMode2d !== 'select') {
    throw new Error(`expected flow renderer to default to select pointer mode, got ${afterFlow.canvasPointerMode2d}`)
  }
  useGraphStore.getState().setCanvasPointerMode2d('pan')
  useGraphStore.getState().setCanvas2dRenderer('d3')
  const afterD3 = useGraphStore.getState()
  if (afterD3.canvasPointerMode2d !== 'pan') {
    throw new Error(`expected d3 renderer to restore pan pointer mode, got ${afterD3.canvasPointerMode2d}`)
  }
}

export function testRendererUiStateIsolationKeepsOpenQuickEditorsPerRenderer() {
  useGraphStore.getState().setDocumentStructureBaselineLock(false)
  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'test',
    nodes: [
      { id: 'a', type: 'Node', label: 'a', properties: {}, x: 0, y: 0, vx: 0, vy: 0 },
      { id: 'b', type: 'Node', label: 'b', properties: {}, x: 1, y: 0, vx: 0, vy: 0 },
    ],
    edges: [],
  } as never)
  useGraphStore.getState().setCanvas2dRenderer('d3')
  useGraphStore.getState().setOpenQuickEditorNodeIds(['a'])
  useGraphStore.getState().setCanvas2dRenderer('flow')
  const afterFlow = useGraphStore.getState()
  if ((afterFlow.openQuickEditorNodeIds || []).length !== 0) {
    throw new Error('expected flow renderer to start with no open quick editors')
  }
  useGraphStore.getState().setOpenQuickEditorNodeIds(['b'])
  useGraphStore.getState().setCanvas2dRenderer('d3')
  const ids = useGraphStore.getState().openQuickEditorNodeIds || []
  if (ids.length !== 1 || ids[0] !== 'a') {
    throw new Error(`expected d3 renderer to restore open quick editors, got ${JSON.stringify(ids)}`)
  }
}

export function testRendererUiStateIsolationFlowEditorDoesNotInheritQuickEditorsFromSourceRenderer() {
  useGraphStore.getState().setDocumentStructureBaselineLock(false)
  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'test-flow-editor-seed',
    nodes: [
      { id: 'a', type: 'Node', label: 'a', properties: {}, x: 0, y: 0, vx: 0, vy: 0 },
      { id: 'b', type: 'Node', label: 'b', properties: {}, x: 1, y: 0, vx: 0, vy: 0 },
    ],
    edges: [],
  } as never)
  useGraphStore.getState().setCanvas2dRenderer('d3')
  useGraphStore.getState().setOpenQuickEditorNodeIds(['a'])
  useGraphStore.getState().setCanvas2dRenderer('flowEditor')
  const afterFlowEditor = useGraphStore.getState()
  const seeded = afterFlowEditor.openQuickEditorNodeIds || []
  if (seeded.length !== 0) {
    throw new Error(`expected flowEditor quick editors to stay renderer-isolated, got ${JSON.stringify(seeded)}`)
  }
}
