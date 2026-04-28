import { useGraphStore } from '@/hooks/useGraphStore'
import { readGlobalEdgeType } from '@/lib/graph/edgeTypes'

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

export function testRendererUiStateIsolationKeepsOpenWidgetsPerRenderer() {
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
  useGraphStore.getState().setOpenWidgetNodeIds(['a'])
  useGraphStore.getState().setCanvas2dRenderer('flow')
  const afterFlow = useGraphStore.getState()
  if ((afterFlow.openWidgetNodeIds || []).length !== 0) {
    throw new Error('expected flow renderer to start with no open widgets')
  }
  useGraphStore.getState().setOpenWidgetNodeIds(['b'])
  useGraphStore.getState().setCanvas2dRenderer('d3')
  const ids = useGraphStore.getState().openWidgetNodeIds || []
  if (ids.length !== 1 || ids[0] !== 'a') {
    throw new Error(`expected d3 renderer to restore open widgets, got ${JSON.stringify(ids)}`)
  }
}

export function testRendererUiStateIsolationFlowEditorDoesNotInheritWidgetsFromSourceRenderer() {
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
  useGraphStore.getState().setOpenWidgetNodeIds(['a'])
  useGraphStore.getState().setCanvas2dRenderer('flowEditor')
  const afterFlowEditor = useGraphStore.getState()
  const seeded = afterFlowEditor.openWidgetNodeIds || []
  if (seeded.length !== 0) {
    throw new Error(`expected flowEditor widgets to stay renderer-isolated, got ${JSON.stringify(seeded)}`)
  }
}

export function testRendererUiStateIsolationPreservesOpenWidgetAppendOrder() {
  useGraphStore.getState().setDocumentStructureBaselineLock(false)
  useGraphStore.getState().setCanvas2dRenderer('flowEditor')
  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'test-open-widget-order',
    nodes: [
      { id: 'n2', type: 'Node', label: 'n2', properties: {}, x: 0, y: 0, vx: 0, vy: 0 },
      { id: 'n10', type: 'Node', label: 'n10', properties: {}, x: 1, y: 0, vx: 0, vy: 0 },
    ],
    edges: [],
  } as never)
  useGraphStore.getState().setOpenWidgetNodeIds(['n2'])
  useGraphStore.getState().updateOpenWidgetNodeIds(prev => [...prev, 'n10'])
  const ids = useGraphStore.getState().openWidgetNodeIds || []
  if (ids.length !== 2 || ids[0] !== 'n2' || ids[1] !== 'n10') {
    throw new Error(`expected open widget append order to stay stable, got ${JSON.stringify(ids)}`)
  }
}

export function testRendererUiStateIsolationGraphDataSideEffectsDoNotOverrideFlowEditorRenderer() {
  useGraphStore.getState().setDocumentStructureBaselineLock(false)
  useGraphStore.getState().setCanvas2dRenderer('flowEditor')
  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'test-flow-editor-no-override',
    nodes: [
      { id: 'a', type: 'Node', label: 'a', properties: {}, x: 0, y: 0, vx: 0, vy: 0 },
    ],
    edges: [],
    metadata: { kind: 'frontmatter-flow' },
  } as never)
  const state = useGraphStore.getState()
  if (state.canvas2dRenderer !== 'flowEditor') {
    throw new Error(`expected flowEditor renderer to remain active, got ${String(state.canvas2dRenderer)}`)
  }
}

export function testRendererUiStateIsolationRestoresLastNonD3EdgeTypeAfterLeavingD3() {
  useGraphStore.getState().setDocumentStructureBaselineLock(false)
  useGraphStore.getState().setSchema({
    ...useGraphStore.getState().schema,
    layout: {
      ...(useGraphStore.getState().schema.layout || {}),
      edges: {
        ...((useGraphStore.getState().schema.layout || {}).edges || {}),
        type: 'bezier',
      },
    },
  })
  useGraphStore.getState().setCanvas2dRenderer('flowEditor')
  if (readGlobalEdgeType(useGraphStore.getState().schema) !== 'bezier') {
    throw new Error('expected non-D3 baseline edge type to start at bezier')
  }
  useGraphStore.getState().setCanvas2dRenderer('d3')
  if (readGlobalEdgeType(useGraphStore.getState().schema) !== 'straight') {
    throw new Error('expected D3 renderer switch to persist straight-only edge type applicability into schema state')
  }
  useGraphStore.getState().setCanvas2dRenderer('flow')
  if (readGlobalEdgeType(useGraphStore.getState().schema) !== 'bezier') {
    throw new Error('expected leaving D3 to restore the last non-D3 edge type instead of staying stale straight')
  }
}
