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

export function testRendererUiStateIsolationStoryboardDoesNotInheritWidgetsFromSourceRenderer() {
  useGraphStore.getState().setDocumentStructureBaselineLock(false)
  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'test-storyboard-seed',
    nodes: [
      { id: 'a', type: 'Node', label: 'a', properties: {}, x: 0, y: 0, vx: 0, vy: 0 },
      { id: 'b', type: 'Node', label: 'b', properties: {}, x: 1, y: 0, vx: 0, vy: 0 },
    ],
    edges: [],
  } as never)
  useGraphStore.getState().setCanvas2dRenderer('d3')
  useGraphStore.getState().setOpenWidgetNodeIds(['a'])
  useGraphStore.getState().setCanvas2dRenderer('storyboard')
  const afterStoryboard = useGraphStore.getState()
  const seeded = afterStoryboard.openWidgetNodeIds || []
  if (seeded.length !== 0) {
    throw new Error(`expected Storyboard widgets to stay renderer-isolated, got ${JSON.stringify(seeded)}`)
  }
}

export function testRendererUiStateIsolationPreservesOpenWidgetAppendOrder() {
  useGraphStore.getState().setDocumentStructureBaselineLock(false)
  useGraphStore.getState().setCanvas2dRenderer('storyboard')
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

export function testRendererUiStateIsolationGraphDataSideEffectsDoNotOverrideStoryboardRenderer() {
  useGraphStore.getState().setDocumentStructureBaselineLock(false)
  useGraphStore.getState().setCanvas2dRenderer('storyboard')
  useGraphStore.getState().setGraphData({
    type: 'Graph',
    context: 'test-storyboard-no-override',
    nodes: [
      { id: 'a', type: 'Node', label: 'a', properties: {}, x: 0, y: 0, vx: 0, vy: 0 },
    ],
    edges: [],
    metadata: { kind: 'frontmatter-flow' },
  } as never)
  const state = useGraphStore.getState()
  if (state.canvas2dRenderer !== 'storyboard') {
    throw new Error(`expected storyboard renderer to remain active, got ${String(state.canvas2dRenderer)}`)
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
  useGraphStore.getState().setCanvas2dRenderer('storyboard')
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

export function testRendererUiStateIsolationStoryboardWidgetRootsExposeExplicitSurfaceMode() {
  const editorViewPath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidget', 'WidgetEditorView.tsx')
  const panelPath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidget', 'WidgetEditorPanel.tsx')
  const collisionPath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas', 'runtime', 'useStoryboardWidgetOverlayCollision.ts')
  const overlayEdgesPath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas', 'runtime', 'useStoryboardWidgetOverlayEdges.ts')
  const storyboardWidgetSurfacePath = resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas', 'runtime', 'StoryboardWidgetCanvasSurface.tsx')
  const flowCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const flowCanvasRuntimePath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'useFlowCanvasRuntime.ts')
  const richMediaSurfaceStatePath = resolve(process.cwd(), 'src', 'components', 'useRichMediaPanelSurfaceState.ts')
  const editorViewText = readFileSync(editorViewPath, 'utf8')
  const panelText = readFileSync(panelPath, 'utf8')
  const collisionText = readFileSync(collisionPath, 'utf8')
  const overlayEdgesText = readFileSync(overlayEdgesPath, 'utf8')
  const storyboardWidgetSurfaceText = readFileSync(storyboardWidgetSurfacePath, 'utf8')
  const flowCanvasText = readFileSync(flowCanvasPath, 'utf8')
  const flowCanvasRuntimeText = readFileSync(flowCanvasRuntimePath, 'utf8')
  const richMediaSurfaceStateText = readFileSync(richMediaSurfaceStatePath, 'utf8')
  if (!editorViewText.includes('data-kg-storyboard-widget-mode="1"')) {
    throw new Error('expected Storyboard Widget aside roots to expose explicit Storyboard Widget mode')
  }
  if (panelText.includes('data-kg-storyboard-widget-mode="1"') || panelText.includes('data-kg-widget={String(node.id || \'\')}')) {
    throw new Error('expected Storyboard Widget floating panels to avoid masquerading as canvas overlay roots')
  }
  if (!editorViewText.includes('data-kg-storyboard-widget-surface={storyboardWidgetSurfaceId || undefined}')) {
    throw new Error('expected Storyboard Widget aside roots to expose explicit Storyboard Widget surface identity')
  }
  if (!storyboardWidgetSurfaceText.includes('data-kg-storyboard-widget-surface-root={props.storyboardWidgetSurfaceId}')) {
    throw new Error('expected Storyboard Widget surface root to expose explicit surface identity')
  }
  if (!richMediaSurfaceStateText.includes('const storyboardWidgetOverlayProxyMode = props.storyboardWidgetInteractionMode === true')) {
    throw new Error('expected RichMediaPanel Storyboard Widget overlay identity to preserve parent-provided Storyboard Widget interaction mode')
  }
  if (!richMediaSurfaceStateText.includes('const storyboardWidgetInteractionMode = storyboardWidgetOverlayProxyMode || storyboardWidgetFrontmatterDocumentMode')) {
    throw new Error('expected RichMediaPanel Storyboard Widget overlay identity to include frontmatter document mode for renderer-scoped Rich Media edges')
  }
  if (!richMediaSurfaceStateText.includes("'data-kg-storyboard-widget-mode': storyboardWidgetInteractionMode ? '1' : undefined")) {
    throw new Error('expected RichMediaPanel to expose Storyboard Widget mode whenever it participates in Storyboard Widget overlay edge discovery')
  }
  if (!flowCanvasText.includes('storyboardWidgetSurfaceId,')) {
    throw new Error('expected FlowCanvas to thread Storyboard Widget surface identity into runtime children')
  }
  if (!flowCanvasRuntimeText.includes('storyboardWidgetSurfaceId: args.storyboardWidgetSurfaceId')) {
    throw new Error('expected FlowCanvas runtime to forward the active Storyboard Widget surface identity into interaction binding')
  }
  if (!collisionText.includes('queryStoryboardWidgetOverlayRootsForSurface')) {
    throw new Error('expected Storyboard Widget collision queries to be bounded by the active surface root')
  }
  if (!collisionText.includes('surfaceId: storyboardWidgetSurfaceId')) {
    throw new Error('expected Storyboard Widget collision queries to pass active surface identity into the shared overlay query helper')
  }
  if (!collisionText.includes('queryActiveSurfaceOverlays(STORYBOARD_WIDGET_OVERLAY_ROOT_SELECTOR)')) {
    throw new Error('expected Storyboard Widget collision queries to stay scoped to the active surface identity')
  }
  if (!overlayEdgesText.includes('STORYBOARD_WIDGET_OVERLAY_SURFACE_ROOT_ATTR')) {
    throw new Error('expected Storyboard Widget overlay edge queries to be bounded by the active surface root')
  }
  if (!overlayEdgesText.includes('const queryRoot: ParentNode = typeof document !== \'undefined\' ? document : root')) {
    throw new Error('expected Storyboard Widget overlay edge queries to account for portal-mounted overlay roots')
  }
  if (!overlayEdgesText.includes('readStoryboardWidgetOverlaySurfaceId(el) !== surfaceId')) {
    throw new Error('expected Storyboard Widget overlay edge queries to exclude overlays from other surfaces')
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
