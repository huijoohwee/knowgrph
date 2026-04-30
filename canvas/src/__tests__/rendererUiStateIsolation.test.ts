import { useGraphStore } from '@/hooks/useGraphStore'
import { readGlobalEdgeType } from '@/lib/graph/edgeTypes'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

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

export function testRendererUiStateIsolationPreservesGlobalEdgeTypeAcrossRendererSwitches() {
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
  if (readGlobalEdgeType(useGraphStore.getState().schema) !== 'bezier') {
    throw new Error('expected D3 renderer switch to preserve global bezier edge type in schema state')
  }
  useGraphStore.getState().setCanvas2dRenderer('flow')
  if (readGlobalEdgeType(useGraphStore.getState().schema) !== 'bezier') {
    throw new Error('expected renderer switches to preserve the shared global edge type instead of mutating schema state')
  }
}

export function testRendererUiStateIsolationFlowEditorWidgetRootsExposeExplicitRendererMode() {
  const editorPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditor.tsx')
  const panelPath = resolve(process.cwd(), 'src', 'components', 'FlowEditor', 'NodeOverlayEditorPanel.tsx')
  const collisionPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayCollision.ts')
  const overlayEdgesPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayEdges.ts')
  const flowEditorSurfacePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'FlowEditorCanvasSurface.tsx')
  const flowCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const flowCanvasRuntimePath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasRuntime.ts')
  const editorText = readFileSync(editorPath, 'utf8')
  const panelText = readFileSync(panelPath, 'utf8')
  const collisionText = readFileSync(collisionPath, 'utf8')
  const overlayEdgesText = readFileSync(overlayEdgesPath, 'utf8')
  const flowEditorSurfaceText = readFileSync(flowEditorSurfacePath, 'utf8')
  const flowCanvasText = readFileSync(flowCanvasPath, 'utf8')
  const flowCanvasRuntimeText = readFileSync(flowCanvasRuntimePath, 'utf8')
  if (!editorText.includes('data-kg-flow-editor-mode="1"')) {
    throw new Error('expected Flow Editor widget aside roots to expose explicit Flow Editor mode')
  }
  if (panelText.includes('data-kg-flow-editor-mode="1"') || panelText.includes('data-kg-widget={String(node.id || \'\')}')) {
    throw new Error('expected Flow Editor floating panels to avoid masquerading as canvas overlay roots')
  }
  if (!editorText.includes('data-kg-flow-editor-surface={flowEditorSurfaceId || undefined}')) {
    throw new Error('expected Flow Editor widget aside roots to expose explicit Flow Editor surface identity')
  }
  if (!flowEditorSurfaceText.includes('data-kg-flow-editor-surface-root={props.flowEditorSurfaceId}')) {
    throw new Error('expected Flow Editor surface root to expose explicit surface identity')
  }
  if (!flowCanvasText.includes('flowEditorSurfaceId,')) {
    throw new Error('expected FlowCanvas to thread Flow Editor surface identity into runtime children')
  }
  if (!flowCanvasRuntimeText.includes('flowEditorSurfaceId: args.flowEditorSurfaceId')) {
    throw new Error('expected FlowCanvas runtime to forward the active Flow Editor surface identity into interaction binding')
  }
  if (!collisionText.includes('readFlowEditorOverlaySurfaceId(el) === String(args.flowEditorSurfaceId || \'\').trim()')) {
    throw new Error('expected Flow Editor collision queries to stay scoped to the active surface identity')
  }
  if (!overlayEdgesText.includes('readFlowEditorOverlaySurfaceId(el) !== args.flowEditorSurfaceId')) {
    throw new Error('expected Flow Editor overlay edge queries to exclude overlays from other surfaces')
  }
}

export function testRendererUiStateIsolationPreservesDesignFrameLayoutAcrossSameSourceHashChanges() {
  const store = useGraphStore.getState()
  store.setDocumentStructureBaselineLock(false)
  store.setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [{ id: 'node-a', type: 'Node', label: 'A', x: 10, y: 20, properties: {} }],
    edges: [],
    metadata: { source: 'workspace:/typed.md', kind: 'frontmatter-flow', sourceLayerHash: 'h1' },
  } as never)
  store.setDesignFramePosMany({ 'node-a': { x: 120, y: 220 } })
  store.setDesignFrameSizeMany({ 'node-a': { w: 320, h: 240 } })

  store.setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [{ id: 'node-a', type: 'Node', label: 'A', x: 10, y: 20, properties: { prompt: 'changed' } }],
    edges: [],
    metadata: { source: 'workspace:/typed.md', kind: 'frontmatter-flow', sourceLayerHash: 'h2' },
  } as never)

  const after = useGraphStore.getState()
  if (after.designFramePosById['node-a']?.x !== 120 || after.designFramePosById['node-a']?.y !== 220) {
    throw new Error('expected design frame position to persist across same-source recomposition hash changes')
  }
  if (after.designFrameSizeById['node-a']?.w !== 320 || after.designFrameSizeById['node-a']?.h !== 240) {
    throw new Error('expected design frame size to persist across same-source recomposition hash changes')
  }
}

export function testRendererUiStateIsolationScopesDesignFrameLayoutByGraphMetaKey() {
  const store = useGraphStore.getState()
  store.setDocumentStructureBaselineLock(false)
  store.setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [{ id: 'node-a', type: 'Node', label: 'A', x: 0, y: 0, properties: {} }],
    edges: [],
    metadata: { source: 'workspace:/doc-a.md', kind: 'frontmatter-flow', sourceLayerHash: 'doc-a' },
  } as never)
  store.setDesignFramePosMany({ 'node-a': { x: 50, y: 60 } })

  store.setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [{ id: 'node-a', type: 'Node', label: 'A', x: 0, y: 0, properties: {} }],
    edges: [],
    metadata: { source: 'workspace:/doc-b.md', kind: 'frontmatter-flow', sourceLayerHash: 'doc-b' },
  } as never)
  store.setDesignFramePosMany({ 'node-a': { x: 500, y: 600 } })

  store.setGraphData({
    type: 'Graph',
    context: 'frontmatter-flow',
    nodes: [{ id: 'node-a', type: 'Node', label: 'A', x: 0, y: 0, properties: {} }],
    edges: [],
    metadata: { source: 'workspace:/doc-a.md', kind: 'frontmatter-flow', sourceLayerHash: 'doc-a' },
  } as never)
  const afterA = useGraphStore.getState()
  if (afterA.designFramePosById['node-a']?.x !== 50 || afterA.designFramePosById['node-a']?.y !== 60) {
    throw new Error('expected design frame layout for doc-a to remain isolated from other graph-meta keys')
  }
}
