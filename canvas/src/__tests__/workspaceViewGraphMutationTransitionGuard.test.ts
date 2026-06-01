import { useGraphStore } from '@/hooks/useGraphStore'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
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
