import { useGraphStore } from '@/hooks/useGraphStore'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildGraphMetaKeyIgnoringPending } from '@/lib/graph/graphMetaKey'
import type { GraphData } from '@/lib/graph/types'
import {
  buildWorkspaceGraphMutationBlockKey,
  buildWorkspaceGraphMutationTransitionState,
  isWorkspaceGraphMutationBlocked,
} from '@/features/workspace-table/workspaceTableSsot'
import { buildAutoFitToScreenSignature } from '@/lib/zoom/autoModeSignatures'

export function testWorkspaceGraphMutationTransitionUsesSemanticKeyAndExpiry() {
  const key = buildWorkspaceGraphMutationBlockKey({
    workspaceViewMode: 'canvas',
    workspaceCanvasPaneOpen: false,
    markdownWorkspaceIndexingInFlight: false,
  })
  if (!key) throw new Error('expected workspace graph mutation transition identity to use a semantic key')

  const transition = buildWorkspaceGraphMutationTransitionState({
    workspaceViewMode: 'canvas',
    workspaceCanvasPaneOpen: false,
    markdownWorkspaceIndexingInFlight: false,
    nowMs: 1000,
  })
  if (transition.workspaceGraphMutationBlockKey !== key) {
    throw new Error('expected transition state to reuse the shared semantic workspace graph mutation key')
  }
  const sourceSwitchTransition = buildWorkspaceGraphMutationTransitionState({
    workspaceViewMode: 'canvas',
    workspaceCanvasPaneOpen: false,
    markdownWorkspaceIndexingInFlight: false,
    transitionSemanticKey: 'source:/docs/a.md',
    nowMs: 1000,
  })
  if (sourceSwitchTransition.workspaceGraphMutationBlockKey === key) {
    throw new Error('expected Source Files document switches to key workspace graph mutation guards by source identity')
  }
  if (!isWorkspaceGraphMutationBlocked({
    workspaceViewMode: 'canvas',
    workspaceCanvasPaneOpen: false,
    markdownWorkspaceIndexingInFlight: false,
    workspaceGraphMutationBlockUntilMs: Date.now() + 1000,
    workspaceGraphMutationBlockKey: key,
  })) {
    throw new Error('expected active workspace graph mutation transition to block graph layout writes')
  }
  if (isWorkspaceGraphMutationBlocked({
    workspaceViewMode: 'canvas',
    workspaceCanvasPaneOpen: false,
    markdownWorkspaceIndexingInFlight: false,
    workspaceGraphMutationBlockUntilMs: 1,
    workspaceGraphMutationBlockKey: key,
  })) {
    throw new Error('expected expired workspace graph mutation transition to release graph layout writes')
  }
}

export function testWorkspaceGraphMutationTransitionKeysAutoFitVisibility() {
  const closedKey = buildWorkspaceGraphMutationBlockKey({
    workspaceViewMode: 'canvas',
    workspaceCanvasPaneOpen: false,
    markdownWorkspaceIndexingInFlight: false,
  })
  const openedKey = buildWorkspaceGraphMutationBlockKey({
    workspaceViewMode: 'editor',
    workspaceCanvasPaneOpen: true,
    markdownWorkspaceIndexingInFlight: false,
  })
  const base = {
    nodeCount: 4,
    viewportW: 1000,
    viewportH: 700,
    graphDataRevision: 12,
    schema: null,
    mediaPanelDensity: 'comfortable',
    renderMediaAsNodes: true,
  } as const
  const closedSig = buildAutoFitToScreenSignature({ ...base, visibilityFrameKey: closedKey })
  const openedSig = buildAutoFitToScreenSignature({ ...base, visibilityFrameKey: openedKey })
  if (closedSig === openedSig) {
    throw new Error('expected workspace open/close semantic keys to create distinct auto-fit visibility signatures')
  }

  const autoZoomPath = resolve(process.cwd(), 'src', 'features', 'zoom', 'useAutoZoomModes2d.ts')
  const autoZoomText = readFileSync(autoZoomPath, 'utf8')
  if (!autoZoomText.includes('visibilityFrameKey: state.workspaceGraphMutationBlockKey')) {
    throw new Error('expected 2D auto-fit signatures to include the shared workspace graph visibility key')
  }
  if (!autoZoomText.includes('workspaceGraphMutationBlockKey: s.workspaceGraphMutationBlockKey')) {
    throw new Error('expected 2D auto-fit scheduling to subscribe to workspace graph visibility key changes')
  }

  const threeControlsPath = resolve(process.cwd(), 'src', 'features', 'three', 'Controls.tsx')
  const threeControlsText = readFileSync(threeControlsPath, 'utf8')
  if (!threeControlsText.includes('visibilityFrameKey: workspaceGraphMutationBlockKey')) {
    throw new Error('expected 3D auto-fit signatures to include the shared workspace graph visibility key')
  }
}

export function testWorkspaceCloseTransitionBlocksLayoutCacheMutation() {
  const previous = useGraphStore.getState()
  const previousWorkspaceViewMode = previous.workspaceViewMode
  const previousWorkspaceCanvasPaneOpen = previous.workspaceCanvasPaneOpen
  const previousIndexing = previous.markdownWorkspaceIndexingInFlight
  const previousBlockUntil = previous.workspaceGraphMutationBlockUntilMs
  const previousBlockKey = previous.workspaceGraphMutationBlockKey
  const previousLayoutCache = previous.layoutPositionCacheByMode
  const cacheKey = 'workspace-transition-layout-cache'

  try {
    useGraphStore.setState({
      workspaceViewMode: 'editor',
      workspaceCanvasPaneOpen: true,
      markdownWorkspaceIndexingInFlight: false,
      workspaceGraphMutationBlockUntilMs: 0,
      workspaceGraphMutationBlockKey: '',
      layoutPositionCacheByMode: {},
    } as never)
    useGraphStore.getState().setWorkspaceViewState({ mode: 'canvas', paneOpen: false })
    const afterClose = useGraphStore.getState()
    if (!afterClose.workspaceGraphMutationBlockKey || afterClose.workspaceGraphMutationBlockUntilMs <= Date.now()) {
      throw new Error('expected closing Editor Workspace to stamp a live graph mutation transition guard')
    }
    afterClose.setLayoutPositionsForMode(cacheKey as never, { n1: { x: 10, y: 20 } })
    if (useGraphStore.getState().layoutPositionCacheByMode[cacheKey]) {
      throw new Error('expected workspace close transition to block layout cache writes')
    }

    useGraphStore.setState({
      workspaceGraphMutationBlockUntilMs: 0,
      workspaceGraphMutationBlockKey: '',
    } as never)
    useGraphStore.getState().setLayoutPositionsForMode(cacheKey as never, { n1: { x: 10, y: 20 } })
    if (!useGraphStore.getState().layoutPositionCacheByMode[cacheKey]) {
      throw new Error('expected layout cache writes to resume after workspace transition guard expires')
    }
  } finally {
    useGraphStore.setState({
      workspaceViewMode: previousWorkspaceViewMode,
      workspaceCanvasPaneOpen: previousWorkspaceCanvasPaneOpen,
      markdownWorkspaceIndexingInFlight: previousIndexing,
      workspaceGraphMutationBlockUntilMs: previousBlockUntil,
      workspaceGraphMutationBlockKey: previousBlockKey,
      layoutPositionCacheByMode: previousLayoutCache,
    } as never)
  }
}

export function testRunAllLayoutLockPreservesFlowEditorWidgetGeometryDuringGraphCommit() {
  const previous = useGraphStore.getState()
  const previousPatch = {
    workspaceViewMode: previous.workspaceViewMode,
    workspaceCanvasPaneOpen: previous.workspaceCanvasPaneOpen,
    markdownWorkspaceIndexingInFlight: previous.markdownWorkspaceIndexingInFlight,
    workspaceGraphMutationBlockUntilMs: previous.workspaceGraphMutationBlockUntilMs,
    workspaceGraphMutationBlockKey: previous.workspaceGraphMutationBlockKey,
    workspaceGraphMutationLayoutLockActive: previous.workspaceGraphMutationLayoutLockActive,
    canvas2dRenderer: previous.canvas2dRenderer,
    graphData: previous.graphData,
    graphDataRevision: previous.graphDataRevision,
    graphContentRevision: previous.graphContentRevision,
    docLocationRevision: previous.docLocationRevision,
    flowWidgetPinnedByNodeId: previous.flowWidgetPinnedByNodeId,
    flowWidgetPinnedByNodeIdByGraphMetaKey: previous.flowWidgetPinnedByNodeIdByGraphMetaKey,
    flowWidgetPosByNodeId: previous.flowWidgetPosByNodeId,
    flowWidgetPosByNodeIdByGraphMetaKey: previous.flowWidgetPosByNodeIdByGraphMetaKey,
    flowWidgetWorldPosByNodeId: previous.flowWidgetWorldPosByNodeId,
    flowWidgetWorldPosByNodeIdByGraphMetaKey: previous.flowWidgetWorldPosByNodeIdByGraphMetaKey,
  }
  const baseGraph: GraphData = {
    type: 'Graph',
    nodes: [
      { id: 'widgetA', label: 'Widget A', type: 'rich_media_panel', properties: { output: 'before' } },
      { id: 'widgetB', label: 'Widget B', type: 'ComputeWidget', properties: { output: 'before' } },
    ],
    edges: [{ id: 'edgeA', source: 'widgetB', target: 'widgetA' }],
    metadata: { kind: 'frontmatter-flow', source: 'run-all-layout-lock' },
  } as never
  const outputGraph: GraphData = {
    ...baseGraph,
    nodes: [
      { id: 'widgetA', label: 'Widget A', type: 'rich_media_panel', properties: { output: 'after' } },
      { id: 'widgetB', label: 'Widget B', type: 'ComputeWidget', properties: { output: 'after' } },
    ],
    metadata: { kind: 'frontmatter-flow', source: 'run-all-layout-lock', runOutputRevision: 'after' },
  } as never
  const outputGraphKey = buildGraphMetaKeyIgnoringPending(outputGraph)
  const preservedScreen = { widgetA: { top: 10, left: 20 }, widgetB: { top: 210, left: 320 } }
  const preservedWorld = { widgetA: { x: 100, y: 200 }, widgetB: { x: 300, y: 400 } }
  const staleReplayScreen = { widgetA: { top: 900, left: 920 }, widgetB: { top: 930, left: 940 } }
  const staleReplayWorld = { widgetA: { x: 900, y: 920 }, widgetB: { x: 930, y: 940 } }

  try {
    useGraphStore.setState({
      workspaceViewMode: 'canvas',
      workspaceCanvasPaneOpen: false,
      markdownWorkspaceIndexingInFlight: false,
      workspaceGraphMutationBlockUntilMs: 0,
      workspaceGraphMutationBlockKey: '',
      workspaceGraphMutationLayoutLockActive: true,
      canvas2dRenderer: 'flowEditor',
      graphData: baseGraph,
      flowWidgetPinnedByNodeId: { widgetA: true, widgetB: false },
      flowWidgetPinnedByNodeIdByGraphMetaKey: {
        [outputGraphKey]: { widgetA: false, widgetB: false },
      },
      flowWidgetPosByNodeId: preservedScreen,
      flowWidgetPosByNodeIdByGraphMetaKey: {
        [outputGraphKey]: staleReplayScreen,
      },
      flowWidgetWorldPosByNodeId: preservedWorld,
      flowWidgetWorldPosByNodeIdByGraphMetaKey: {
        [outputGraphKey]: staleReplayWorld,
      },
    } as never)

    useGraphStore.getState().setGraphData(outputGraph)
    const after = useGraphStore.getState()
    const committedOutput = String(after.graphData?.nodes?.[0]?.properties?.output || '')
    if (committedOutput !== 'after') {
      throw new Error(`expected Run all output graph commit to continue while layout lock is active, got ${committedOutput}`)
    }
    if (after.flowWidgetPinnedByNodeId.widgetA !== true) {
      throw new Error('expected Run all layout lock to preserve Flow Editor widget pin state during graph commit')
    }
    if (after.flowWidgetPosByNodeId.widgetA?.top !== 10 || after.flowWidgetPosByNodeId.widgetA?.left !== 20) {
      throw new Error('expected Run all layout lock to block graph-commit replay of Flow Editor screen positions')
    }
    if (after.flowWidgetWorldPosByNodeId.widgetB?.x !== 300 || after.flowWidgetWorldPosByNodeId.widgetB?.y !== 400) {
      throw new Error('expected Run all layout lock to block graph-commit replay of Flow Editor world positions')
    }
  } finally {
    useGraphStore.setState(previousPatch as never)
  }
}

export function testRunAllLayoutLockSuppressesAutoZoomUntilMutationGuardReleases() {
  const autoZoomPath = resolve(process.cwd(), 'src', 'features', 'zoom', 'useAutoZoomModes2d.ts')
  const autoZoomText = readFileSync(autoZoomPath, 'utf8')
  if (!autoZoomText.includes("import { isWorkspaceGraphMutationBlocked } from '@/features/workspace-table/workspaceTableSsot'")) {
    throw new Error('expected auto-zoom scheduler to import the shared workspace graph mutation guard')
  }
  if (!autoZoomText.includes('if (isWorkspaceGraphMutationBlocked(state)) return')) {
    throw new Error('expected auto-fit and selection zoom dispatch to stop while Run all holds the shared graph mutation guard')
  }
  if (!autoZoomText.includes("import { buildOverlayTopologyLayoutSignature } from '@/lib/flowEditor/overlayTopologyLayoutSignature'")) {
    throw new Error('expected Flow Editor auto-fit signatures to reuse the shared topology/layout signature')
  }
  if (!autoZoomText.includes('const graphLayoutSignature = isFlowEditorCanvas2dRenderer(state.canvas2dRenderer)')) {
    throw new Error('expected Flow Editor auto-fit to ignore output-only graph revisions and key by semantic layout topology')
  }
  const signaturePath = resolve(process.cwd(), 'src', 'lib', 'zoom', 'autoModeSignatures.ts')
  const signatureText = readFileSync(signaturePath, 'utf8')
  if (!signatureText.includes('graphLayoutSignature?: string | null')) {
    throw new Error('expected shared auto-fit signatures to accept a semantic graph layout signature')
  }
  if (!signatureText.includes('graphLayoutSignature || graphDataRevision')) {
    throw new Error('expected shared auto-fit signatures to prefer semantic layout signatures over raw graph revisions')
  }
  const runtimeScenePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorRuntimeScene.ts')
  const runtimeSceneText = readFileSync(runtimeScenePath, 'utf8')
  if (!runtimeSceneText.includes("reason: 'workspace-blocked-using-last-usable-transform'")) {
    throw new Error('expected Flow Editor runtime widgets to keep the last usable zoom transform while Run all blocks graph mutation')
  }
  if (!runtimeSceneText.includes("reason: 'workspace-blocked-rejecting-live-runtime-transform'")) {
    throw new Error('expected Flow Editor runtime widgets to reject transient live zoom transforms while Run all blocks graph mutation')
  }
}

export function testRendererSwitchTransitionBlocksFlowEditorWidgetLayoutMutation() {
  const previous = useGraphStore.getState()
  const previousPatch = {
    canvas2dRenderer: previous.canvas2dRenderer,
    workspaceViewMode: previous.workspaceViewMode,
    workspaceCanvasPaneOpen: previous.workspaceCanvasPaneOpen,
    markdownWorkspaceIndexingInFlight: previous.markdownWorkspaceIndexingInFlight,
    workspaceGraphMutationBlockUntilMs: previous.workspaceGraphMutationBlockUntilMs,
    workspaceGraphMutationBlockKey: previous.workspaceGraphMutationBlockKey,
    flowWidgetPinnedByNodeId: previous.flowWidgetPinnedByNodeId,
    flowWidgetPosByNodeId: previous.flowWidgetPosByNodeId,
    flowWidgetWorldPosByNodeId: previous.flowWidgetWorldPosByNodeId,
    graphData: previous.graphData,
  }

  try {
    useGraphStore.setState({
      canvas2dRenderer: 'flowEditor',
      workspaceViewMode: 'canvas',
      workspaceCanvasPaneOpen: false,
      markdownWorkspaceIndexingInFlight: false,
      workspaceGraphMutationBlockUntilMs: 0,
      workspaceGraphMutationBlockKey: '',
      flowWidgetPinnedByNodeId: { widgetA: true },
      flowWidgetPosByNodeId: { widgetA: { top: 10, left: 20 } },
      flowWidgetWorldPosByNodeId: { widgetA: { x: 30, y: 40 } },
      graphData: {
        type: 'Graph',
        nodes: [{ id: 'widgetA', label: 'Widget A', type: 'rich_media_panel' }],
        edges: [],
        metadata: { title: 'Flow Editor renderer transition guard' },
      },
    } as never)
    useGraphStore.getState().setCanvas2dRenderer('d3')
    const afterSwitch = useGraphStore.getState()
    if (!afterSwitch.workspaceGraphMutationBlockKey || afterSwitch.workspaceGraphMutationBlockUntilMs <= Date.now()) {
      throw new Error('expected 2D renderer switch to stamp a transient graph mutation guard')
    }
    afterSwitch.setFlowWidgetPinnedByNodeId({ widgetA: false })
    afterSwitch.setFlowWidgetPosByNodeId({ widgetA: { top: 300, left: 400 } })
    afterSwitch.setFlowWidgetWorldPosByNodeId({ widgetA: { x: 500, y: 600 } })
    const blocked = useGraphStore.getState()
    if (blocked.flowWidgetPinnedByNodeId.widgetA !== true) {
      throw new Error('expected renderer transition guard to block Flow Editor widget pin mutation')
    }
    if (blocked.flowWidgetPosByNodeId.widgetA?.top !== 10 || blocked.flowWidgetPosByNodeId.widgetA?.left !== 20) {
      throw new Error('expected renderer transition guard to block Flow Editor widget screen-position mutation')
    }
    if (blocked.flowWidgetWorldPosByNodeId.widgetA?.x !== 30 || blocked.flowWidgetWorldPosByNodeId.widgetA?.y !== 40) {
      throw new Error('expected renderer transition guard to block Flow Editor widget world-position mutation')
    }
  } finally {
    useGraphStore.setState(previousPatch as never)
  }
}

export function testFlowEditorOverlayPositionBypassesHonorWorkspaceMutationGuard() {
  const collisionPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayCollision.ts')
  const collisionText = readFileSync(collisionPath, 'utf8')
  if (!collisionText.includes("import { isWorkspaceEditorOverlayOpen, isWorkspaceGraphMutationBlocked } from '@/features/workspace-table/workspaceTableSsot'")) {
    throw new Error('expected Flow Editor overlay collision to import the shared workspace graph mutation guard')
  }
  if (!collisionText.includes('if (isWorkspaceGraphMutationBlocked(useGraphStore.getState())) return')) {
    throw new Error('expected Flow Editor overlay collision scheduling to stop during workspace and renderer transitions')
  }
  if (!collisionText.includes('if (isWorkspaceGraphMutationBlocked(st)) return')) {
    throw new Error('expected Flow Editor overlay collision direct position commits to honor the workspace mutation guard')
  }
  if (!collisionText.includes('if (isWorkspaceGraphMutationBlocked(prev)) return {}')) {
    throw new Error('expected graph-scoped Flow Editor overlay position writes to honor the workspace mutation guard')
  }

  const recenterPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'flowEditorOverlayRecenter.ts')
  const recenterText = readFileSync(recenterPath, 'utf8')
  if (!recenterText.includes("import { isWorkspaceEditorOverlayOpen, isWorkspaceGraphMutationBlocked } from '@/features/workspace-table/workspaceTableSsot'")) {
    throw new Error('expected Flow Editor overlay recenter to import the shared workspace graph mutation guard')
  }
  if (!recenterText.includes('if (isWorkspaceGraphMutationBlocked(st as never)) return')) {
    throw new Error('expected Flow Editor overlay recenter to skip lifecycle mutation windows')
  }
  if (!recenterText.includes('if (isWorkspaceGraphMutationBlocked(prev as never)) return {}')) {
    throw new Error('expected graph-scoped overlay recenter writes to honor the workspace mutation guard')
  }
}

export async function testWorkspaceGraphMutationTransitionExpiresStoreState() {
  const previous = useGraphStore.getState()
  const previousPatch = {
    workspaceViewMode: previous.workspaceViewMode,
    workspaceCanvasPaneOpen: previous.workspaceCanvasPaneOpen,
    markdownWorkspaceIndexingInFlight: previous.markdownWorkspaceIndexingInFlight,
    workspaceGraphMutationBlockUntilMs: previous.workspaceGraphMutationBlockUntilMs,
    workspaceGraphMutationBlockKey: previous.workspaceGraphMutationBlockKey,
  }

  try {
    useGraphStore.setState({
      workspaceViewMode: 'canvas',
      workspaceCanvasPaneOpen: false,
      markdownWorkspaceIndexingInFlight: false,
      workspaceGraphMutationBlockUntilMs: Date.now() + 24,
      workspaceGraphMutationBlockKey: 'workspace-transition-expiry-test',
    } as never)
    await new Promise(resolve => setTimeout(resolve, 80))
    const after = useGraphStore.getState()
    if (after.workspaceGraphMutationBlockUntilMs !== 0 || after.workspaceGraphMutationBlockKey !== '') {
      throw new Error('expected expired workspace graph mutation transition state to clear itself so selectors and refs release interaction passthrough')
    }
  } finally {
    useGraphStore.setState(previousPatch as never)
  }
}

export async function testActiveMarkdownDocumentSwitchStampsMutationGuardWithoutPresetReplay() {
  const previous = useGraphStore.getState()
  const previousPatch = {
    workspaceViewMode: previous.workspaceViewMode,
    workspaceCanvasPaneOpen: previous.workspaceCanvasPaneOpen,
    markdownWorkspaceIndexingInFlight: previous.markdownWorkspaceIndexingInFlight,
    workspaceGraphMutationBlockUntilMs: previous.workspaceGraphMutationBlockUntilMs,
    workspaceGraphMutationBlockKey: previous.workspaceGraphMutationBlockKey,
    canvasRenderMode: previous.canvasRenderMode,
    canvas2dRenderer: previous.canvas2dRenderer,
    frontmatterModeEnabled: previous.frontmatterModeEnabled,
    documentSemanticMode: previous.documentSemanticMode,
    markdownDocumentName: previous.markdownDocumentName,
    markdownDocumentText: previous.markdownDocumentText,
    markdownDocumentApplyViewPreset: previous.markdownDocumentApplyViewPreset,
  }

  try {
    useGraphStore.setState({
      workspaceViewMode: 'canvas',
      workspaceCanvasPaneOpen: false,
      markdownWorkspaceIndexingInFlight: false,
      workspaceGraphMutationBlockUntilMs: 0,
      workspaceGraphMutationBlockKey: '',
      canvasRenderMode: '2d',
      canvas2dRenderer: 'd3',
      frontmatterModeEnabled: false,
      documentSemanticMode: 'keyword',
      markdownDocumentName: null,
      markdownDocumentText: null,
      markdownDocumentApplyViewPreset: true,
    } as never)
    const text = [
      '---',
      'kgCanvasSurfaceMode: "2d"',
      'kgCanvas2dRenderer: "flowEditor"',
      'kgDocumentSemanticMode: "document"',
      'kgFrontmatterModeEnabled: true',
      '---',
      '',
      '# Passive Source File',
    ].join('\n')

    const ok = await useGraphStore.getState().setActiveMarkdownDocument({
      name: 'passive-source-file.md',
      text,
      autoEnableFrontmatter: false,
      applyViewPreset: false,
      applyToGraph: false,
    })
    const st = useGraphStore.getState()
    if (ok !== true) throw new Error('expected passive active markdown document switch to complete')
    if (!st.workspaceGraphMutationBlockKey || st.workspaceGraphMutationBlockUntilMs <= Date.now()) {
      throw new Error('expected active Source Files document switch to stamp a live graph mutation guard')
    }
    if (st.canvas2dRenderer !== 'd3' || st.documentSemanticMode !== 'keyword' || st.frontmatterModeEnabled !== false) {
      throw new Error('expected passive active Source Files document switch not to replay YAML frontmatter view presets')
    }
  } finally {
    useGraphStore.setState(previousPatch as never)
  }
}
