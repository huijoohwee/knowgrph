import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { applyCanvasViewSelection } from '@/components/toolbar/canvasViewActions'
import { applyComposedGraphFromSourceFiles } from '@/features/source-files/applyComposedGraphFromSourceFiles'
import { useGraphStore } from '@/hooks/useGraphStore'
import { isFrontmatterOnlyCanvas2dRenderer, isFrontmatterOnlyPolicyActive } from '@/lib/config.render'
import type { GraphData } from '@/lib/graph/types'

export function testFlowCanvasRemainsFrontmatterOnlyButFlowEditorIsStandalone() {
  const modeSelectPath = resolve(process.cwd(), 'src', 'components', 'toolbar', 'DocumentModeSelect.tsx')
  const uiSettingsModeActionsPath = resolve(process.cwd(), 'src', 'hooks', 'store', 'uiSettingsSliceModeActions.ts')
  const canvasSlicePath = resolve(process.cwd(), 'src', 'hooks', 'store', 'canvasSlice.ts')
  const canvasViewActionsPath = resolve(process.cwd(), 'src', 'components', 'toolbar', 'canvasViewActions.ts')
  const renderConfigPath = resolve(process.cwd(), 'src', 'lib', 'config.render.ts')

  const modeSelectText = readFileSync(modeSelectPath, 'utf8')
  const uiSettingsModeActionsText = readFileSync(uiSettingsModeActionsPath, 'utf8')
  const canvasSliceText = readFileSync(canvasSlicePath, 'utf8')
  const canvasViewActionsText = readFileSync(canvasViewActionsPath, 'utf8')
  const renderConfigText = readFileSync(renderConfigPath, 'utf8')

  if (!isFrontmatterOnlyCanvas2dRenderer('flow')) {
    throw new Error('expected Flow Canvas to remain the frontmatter-only renderer')
  }
  if (isFrontmatterOnlyCanvas2dRenderer('flowEditor')) {
    throw new Error('expected Flow Editor to stay standalone instead of inheriting Flow Canvas frontmatter-only policy')
  }
  if (!isFrontmatterOnlyPolicyActive({ canvasRenderMode: '2d', canvas2dRenderer: 'flow' })) {
    throw new Error('expected Flow Canvas to activate frontmatter-only policy')
  }
  if (isFrontmatterOnlyPolicyActive({ canvasRenderMode: '2d', canvas2dRenderer: 'flowEditor' })) {
    throw new Error('expected Flow Editor to reject Flow Canvas frontmatter-only policy seepage')
  }
  if (!renderConfigText.includes('isFrontmatterOnlyCanvas2dRenderer')) {
    throw new Error('expected shared renderer helper to identify frontmatter-only renderers')
  }
  if (!renderConfigText.includes("return id === 'flow'")) {
    throw new Error('expected Flow Canvas to be the only frontmatter-only renderer')
  }
  if (!modeSelectText.includes('isFrontmatterOnlyPolicyActive')) {
    throw new Error('expected document mode selector to use centralized frontmatter-only policy helper')
  }
  if (!modeSelectText.includes('disabled: frontmatterOnlyAllowed')) {
    throw new Error('expected only frontmatter-only renderer mode options to be disabled')
  }
  if (!uiSettingsModeActionsText.includes('isFrontmatterOnlyPolicyActive')) {
    throw new Error('expected mode-action setters to block keyword and table mode only for frontmatter-only renderer')
  }
  if (!canvasSliceText.includes('isFrontmatterOnlyPolicyActive')) {
    throw new Error('expected renderer switch logic to enforce frontmatter-only state only for the frontmatter-only renderer')
  }
  if (!canvasSliceText.includes('nextFrontmatterModeEnabled = enforceFrontmatterOnly ? true')) {
    throw new Error('expected frontmatter-only renderer switch to auto-enable frontmatter mode')
  }
  if (!canvasViewActionsText.includes('isFrontmatterOnlyCanvas2dRenderer(nextRenderer)')) {
    throw new Error('expected canvas view actions to use the shared frontmatter-only renderer helper for renderer switches')
  }
}

export function testFlowEditorStandaloneIgnoresDocumentModeAndYamlCoupling() {
  const flowEditorCanvasPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.tsx')
  const flowEditorCanvasText = readFileSync(flowEditorCanvasPath, 'utf8')

  if (!flowEditorCanvasText.includes('const flowEditorViewActive = active')) {
    throw new Error('expected FlowEditor view activation to stay standalone and renderer-scoped')
  }
  if (!flowEditorCanvasText.includes('const canEdit = active && !documentStructureBaselineLock')) {
    throw new Error('expected FlowEditor editability to be gated only by active state and View Lock')
  }
  if (flowEditorCanvasText.includes('extractYamlFrontmatterBlock')) {
    throw new Error('expected FlowEditor standalone path to avoid markdown YAML-frontmatter coupling')
  }
  if (flowEditorCanvasText.includes('flowEditorYamlFrontmatterRequiredToast')) {
    throw new Error('expected FlowEditor standalone path to avoid frontmatter requirement toasts')
  }
}

export function testFlowCanvasSkipsComposedSourceMutationButFlowEditorAppliesIt() {
  const previous = useGraphStore.getState()
  const previousGraphData = previous.graphData
  const previousCanvasRenderMode = previous.canvasRenderMode
  const previousCanvas2dRenderer = previous.canvas2dRenderer
  const previousSourceFiles = previous.sourceFiles
  const sourceGraph: GraphData = {
    type: 'Graph',
    nodes: [{ id: 'node-a', label: 'A', type: 'Thing', properties: {} }],
    edges: [],
    metadata: {},
  }

  try {
    previous.clearSourceFiles()
    previous.setGraphData({ type: 'Graph', nodes: [], edges: [], metadata: {} } as GraphData)
    previous.setCanvasRenderMode('2d')
    previous.setCanvas2dRenderer('flow')
    previous.addSourceFile({
      id: 'source-a',
      name: 'source-a.md',
      text: '# Source A',
      enabled: true,
      status: 'parsed',
      parsedGraphData: sourceGraph,
      parsedTextHash: 'flow-canvas-skip-source-a',
      parsedGraphRevision: 0,
      source: { kind: 'local', path: 'source-a.md' },
    })

    applyComposedGraphFromSourceFiles()
    const flowCanvasGraph = useGraphStore.getState().graphData
    if (flowCanvasGraph?.nodes?.some(node => String(node.id || '').includes('node-a'))) {
      throw new Error('expected Flow Canvas frontmatter-only policy to skip composed source graph mutation')
    }

    useGraphStore.getState().setCanvas2dRenderer('flowEditor')
    applyComposedGraphFromSourceFiles()
    const flowEditorGraph = useGraphStore.getState().graphData
    if (!flowEditorGraph?.nodes?.some(node => node.id === 'source-a::node-a')) {
      throw new Error('expected Flow Editor to apply composed source graph without inheriting Flow Canvas policy')
    }
  } finally {
    useGraphStore.setState({
      graphData: previousGraphData,
      canvasRenderMode: previousCanvasRenderMode,
      canvas2dRenderer: previousCanvas2dRenderer,
      sourceFiles: previousSourceFiles,
    })
  }
}

export function testCanvasViewRendererSwitchToFlowEditorDoesNotForceDocumentModes() {
  const calls: string[] = []
  const params = {
    id: 'renderer:flowEditor' as const,
    ensureBaselineUnlocked: () => true,
    geospatialEnabled: false,
    onOpenGeospatialMode: () => calls.push('geospatial'),
    canvas2dRenderer: 'flow' as const,
    canvas3dMode: '3d',
    canvasRenderMode: '2d' as const,
    documentSemanticMode: 'keyword',
    frontmatterModeEnabled: false,
    multiDimTableModeEnabled: true,
    renderMediaAsNodes: false,
    timelineEnabled: false,
    bottomSurfaceCollapsed: true,
    bottomSurfaceTab: 'stats' as const,
    schema: {} as never,
    setCanvas2dRenderer: id => calls.push(`renderer:${id}`),
    setCanvasRenderMode: mode => calls.push(`surface:${mode}`),
    setCanvas3dMode: mode => calls.push(`3d:${mode}`),
    setSchema: () => calls.push('schema'),
    setRenderMediaAsNodes: enabled => calls.push(`media:${enabled}`),
    setTimelineEnabled: enabled => calls.push(`timeline:${enabled}`),
    setBottomSurfaceCollapsed: collapsed => calls.push(`bottomCollapsed:${collapsed}`),
    setBottomSurfaceTab: tab => calls.push(`bottomTab:${tab}`),
    setDocumentSemanticMode: mode => calls.push(`document:${mode}`),
    setFrontmatterModeEnabled: enabled => calls.push(`frontmatter:${enabled}`),
    setMultiDimTableModeEnabled: enabled => calls.push(`table:${enabled}`),
  }

  applyCanvasViewSelection(params)

  if (!calls.includes('renderer:flowEditor')) {
    throw new Error(`expected renderer switch to Flow Editor, got ${calls.join(',')}`)
  }
  if (calls.some(call => call.startsWith('document:') || call.startsWith('frontmatter:') || call.startsWith('table:'))) {
    throw new Error(`expected Flow Editor switch to avoid Flow Canvas document-mode mutations, got ${calls.join(',')}`)
  }
}

export function testCanvasViewRendererSwitchToFlowCanvasKeepsFrontmatterOnlyPolicy() {
  const calls: string[] = []
  applyCanvasViewSelection({
    id: 'renderer:flow',
    ensureBaselineUnlocked: () => true,
    geospatialEnabled: false,
    onOpenGeospatialMode: () => calls.push('geospatial'),
    canvas2dRenderer: 'd3',
    canvas3dMode: '3d',
    canvasRenderMode: '2d',
    documentSemanticMode: 'keyword',
    frontmatterModeEnabled: false,
    multiDimTableModeEnabled: true,
    renderMediaAsNodes: false,
    timelineEnabled: false,
    bottomSurfaceCollapsed: true,
    bottomSurfaceTab: 'stats',
    schema: {} as never,
    setCanvas2dRenderer: id => calls.push(`renderer:${id}`),
    setCanvasRenderMode: mode => calls.push(`surface:${mode}`),
    setCanvas3dMode: mode => calls.push(`3d:${mode}`),
    setSchema: () => calls.push('schema'),
    setRenderMediaAsNodes: enabled => calls.push(`media:${enabled}`),
    setTimelineEnabled: enabled => calls.push(`timeline:${enabled}`),
    setBottomSurfaceCollapsed: collapsed => calls.push(`bottomCollapsed:${collapsed}`),
    setBottomSurfaceTab: tab => calls.push(`bottomTab:${tab}`),
    setDocumentSemanticMode: mode => calls.push(`document:${mode}`),
    setFrontmatterModeEnabled: enabled => calls.push(`frontmatter:${enabled}`),
    setMultiDimTableModeEnabled: enabled => calls.push(`table:${enabled}`),
  })

  for (const expected of ['renderer:flow', 'table:false', 'frontmatter:true', 'document:document']) {
    if (!calls.includes(expected)) {
      throw new Error(`expected Flow Canvas frontmatter-only renderer switch to call ${expected}, got ${calls.join(',')}`)
    }
  }
}
