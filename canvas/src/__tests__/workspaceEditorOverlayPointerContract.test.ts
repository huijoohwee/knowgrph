import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolveWorkspacePreviewWidthFromPointerDrag } from '@/features/canvas/useCanvasWorkspacePaneRuntime'

function readMarkdownDesignOverlaySourceText(): string {
  const base = resolve(process.cwd(), 'src')
  const candidatePaths = [
    resolve(base, 'features', 'markdown-edgeless', 'MarkdownDesignOverlay.tsx'),
    resolve(base, 'lib', 'markdown-edgeless', 'MarkdownDesignOverlay.impl.tsx'),
  ]
  let latest = ''
  for (let i = 0; i < candidatePaths.length; i += 1) {
    const text = readFileSync(candidatePaths[i], 'utf8')
    latest = text
    if (text.includes('pointer-events-none') || text.includes("pointerEvents: 'none'")) {
      return text
    }
  }
  return latest
}

export function testWorkspaceEditorOverlayDoesNotInstallBlockingScrim() {
  const text = readMarkdownDesignOverlaySourceText()
  if (!text.includes('pointer-events-none')) {
    throw new Error('expected MarkdownDesignOverlay root to be pointer-events-none by default')
  }
  if (!text.includes("pointerEvents: 'none'")) {
    throw new Error('expected MarkdownDesignOverlay drag mask to be pointerEvents none')
  }
}

export function testGraphDataTableOverlayDoesNotUseFullscreenScrim() {
  const p = resolve(process.cwd(), 'src', 'features', 'graph-data-table', 'ui', 'GraphDataTablePanelOverlay.tsx')
  const text = readFileSync(p, 'utf8')
  if (text.includes('inset: 0') || text.includes('inset-0') || text.includes('fixed inset-0')) {
    throw new Error('expected GraphDataTablePanelOverlay not to render a fullscreen scrim')
  }
}

export function testWorkspaceEditorOverlayDoesNotMutateDesignCanvasLayout() {
  const p = resolve(process.cwd(), 'src', 'components', 'DesignCanvas.tsx')
  const text = readFileSync(p, 'utf8')
  const cleanupPath = resolve(process.cwd(), 'src', 'components', 'DesignCanvas', 'useGlobalInteractionCleanup.ts')
  const cleanupText = readFileSync(cleanupPath, 'utf8')
  if (!text.includes('const workspaceEditorOverlayOpen = isWorkspaceEditorOverlayOpen({ workspaceViewMode: snapshot.workspaceViewMode, workspaceCanvasPaneOpen: snapshot.workspaceCanvasPaneOpen })')) {
    throw new Error('expected DesignCanvas to derive explicit workspace editor overlay-open state from the canonical SSOT')
  }
  if (!text.includes('const interactionActive = active && !workspaceEditorOverlayOpen')) {
    throw new Error('expected DesignCanvas interactions to be gated only by actual workspace editor overlay-open state')
  }
  if (!text.includes('const workspaceEditorOverlayEnabled = workspaceEditorOverlayOpen && active && !!String(snapshot.markdownDocumentText || \'\').trim()')) {
    throw new Error('expected DesignCanvas markdown workspace overlay to enable only while the workspace editor overlay is open')
  }
  if (!text.includes('event.stopPropagation()')) {
    throw new Error('expected DesignCanvas workspace overlay events to stop propagation before reaching the canvas underneath')
  }
  if (!text.includes('const arrangeActionsActive = active && !workspaceEditorOverlayOpen')) {
    throw new Error('expected arrange actions to disable only while workspace editor overlay is actually open')
  }
  if (!text.includes('arrangeActionsActive={arrangeActionsActive}')) {
    throw new Error('expected DesignCanvas to forward overlay-gated arrange action state')
  }
  if (!text.includes('if (!interactionActive) return')) {
    throw new Error('expected DesignCanvas layout writes to short-circuit while workspace editor overlay is enabled')
  }
  const renderShellPath = resolve(process.cwd(), 'src', 'components', 'DesignCanvas', 'DesignCanvasRenderShell.tsx')
  const renderShellText = readFileSync(renderShellPath, 'utf8')
  if (!renderShellText.includes('if (!interactionActive) return\n                        if (isSpacePanHeld()) return')) {
    throw new Error('expected group selection pointerdown to stop reacting while workspace editor overlay is enabled')
  }
  if (!text.includes('useGlobalInteractionCleanup({\n    interactionActive,')) {
    throw new Error('expected DesignCanvas to forward interactionActive into shared global interaction cleanup')
  }
  if (!cleanupText.includes('if (interactionActive) return')) {
    throw new Error('expected global interaction cleanup to react when canvas interactivity is disabled')
  }
  if (!cleanupText.includes('cancelAll()')) {
    throw new Error('expected global interaction cleanup to cancel active interactions when editor overlay mode turns on')
  }
}

export function testWorkspaceEditorOverlayDoesNotShrinkCanvasViewport() {
  const p = resolve(process.cwd(), 'src', 'pages', 'Canvas.tsx')
  const text = readFileSync(p, 'utf8')
  const separatorPath = resolve(process.cwd(), 'src', 'components', 'ui', 'VerticalResizeSeparatorHr.tsx')
  const separatorText = readFileSync(separatorPath, 'utf8')
  const viewportPath = resolve(process.cwd(), 'src', 'components', 'CanvasViewport.tsx')
  const viewportText = readFileSync(viewportPath, 'utf8')
  const workspaceSelectPath = resolve(process.cwd(), 'src', 'components', 'toolbar', 'EditorWorkspaceSelect.tsx')
  const workspaceSelectText = readFileSync(workspaceSelectPath, 'utf8')
  const workspaceSsotPath = resolve(process.cwd(), 'src', 'features', 'workspace-table', 'workspaceTableSsot.ts')
  const workspaceSsotText = readFileSync(workspaceSsotPath, 'utf8')
  const uiInitialStatePath = resolve(process.cwd(), 'src', 'hooks', 'store', 'uiSliceInitialState.ts')
  const uiInitialStateText = readFileSync(uiInitialStatePath, 'utf8')
  const workspaceToolbarPath = resolve(process.cwd(), 'src', 'features', 'markdown-workspace', 'MarkdownWorkspaceToolbar.tsx')
  const workspaceToolbarText = readFileSync(workspaceToolbarPath, 'utf8')
  if (!text.includes('const workspaceEditorOverlayOpen = isWorkspaceEditorOverlayOpen({ workspaceViewMode, workspaceCanvasPaneOpen })')) {
    throw new Error('expected Canvas page to derive overlay-open state from canonical store state only')
  }
  if (!text.includes('{!workspaceEditorOverlayOpen ? (')) {
    throw new Error('expected Canvas toolbar visibility to depend on overlay-open state, not workspace editor mode alone')
  }
  if (text.includes('effectiveWorkspaceViewMode')) {
    throw new Error('expected Canvas page not to keep stale effective workspace mode aliases after query bootstrap')
  }
  if (!text.includes('{workspaceEditorOverlayOpen ? (')) {
    throw new Error('expected Canvas page to mount the workspace editor overlay only while the pane is open')
  }
  if (!text.includes('aria-label="Workspace editor overlay shell"')) {
    throw new Error('expected Canvas page to render workspace editor in an absolute overlay shell')
  }
  if (!text.includes('layout="full"')) {
    throw new Error('expected Canvas viewport to remain in full layout while workspace editor overlay is active')
  }
  if (!viewportText.includes('data-kg-canvas-viewport-root="1"')) {
    throw new Error('expected Canvas viewport root to expose an explicit canonical viewport marker for downstream measurement')
  }
  if (text.includes("layout={effectiveWorkspaceViewMode === 'editor' ? 'pane' : 'full'}")) {
    throw new Error('expected Canvas page to avoid pane-layout shrinkage when workspace editor is enabled')
  }
  if (text.includes("style={effectiveWorkspaceViewMode === 'editor' ? (workspaceCanvasPaneOpen ? { width: `${workspacePreviewWidthPx}px` } : undefined) : undefined}")) {
    throw new Error('expected Canvas pane width not to be reduced by workspace editor mode')
  }
  if (!text.includes('visualStyle="centerGrip"')) {
    throw new Error('expected Workspace Editor overlay to use centered resize grip styling instead of a full-height line')
  }
  if (!separatorText.includes("visualStyle?: 'line' | 'centerGrip'")) {
    throw new Error('expected VerticalResizeSeparatorHr to expose a dedicated centered grip variant')
  }
  if (!separatorText.includes("backgroundSize: '1px 3.5rem'")) {
    throw new Error('expected centered grip variant to render a short centered separator instead of a full-height stroke')
  }
  if (text.includes("${workspaceEditorOverlayOpen ? '' : 'hidden'}")) {
    throw new Error('expected Canvas page not to keep a hidden workspace editor separator mounted while the pane is off')
  }
  if (!workspaceSsotText.includes('export function openWorkspaceEditorPane')) {
    throw new Error('expected workspace editor open flow to stay centralized in a shared helper')
  }
  if (!workspaceSsotText.includes("args.setWorkspaceViewState({ mode: 'editor', paneOpen: true })")) {
    throw new Error('expected shared workspace open helper to reopen the canvas pane atomically and clear stale OFF residue')
  }
  if (!uiInitialStateText.includes("const initialWorkspaceCanvasPaneOpen = initialWorkspaceViewMode === 'editor'")) {
    throw new Error('expected UI initial state to normalize persisted editor mode with pane-open state')
  }
  if (!workspaceSsotText.includes("args.setWorkspaceViewState({ mode: 'editor', paneOpen: true })")) {
    throw new Error('expected shared workspace open helper to prefer atomic editor/pane-open transition')
  }
  if (!workspaceSsotText.includes('export function closeWorkspaceView')) {
    throw new Error('expected workspace editor close flow to stay centralized in a shared helper')
  }
  if (!workspaceSelectText.includes('openWorkspaceEditorPane({')) {
    throw new Error('expected toolbar Workspace View editor selection to reuse the shared workspace open helper')
  }
  if (!workspaceSelectText.includes('const state = useGraphStore.getState()')) {
    throw new Error('expected toolbar Workspace View selection to read live store state at click time')
  }
  if (!workspaceSelectText.includes('liveWorkspaceCanvasPaneOpen')) {
    throw new Error('expected toolbar Workspace View selection to route live pane-open state through the shared helper')
  }
  if (!workspaceSelectText.includes('onTriggerClick={handleTriggerClick}')) {
    throw new Error('expected selected Workspace View trigger click to repair stale closed editor pane state directly')
  }
  if (!workspaceSelectText.includes("if (liveWorkspaceViewMode !== 'editor' || liveWorkspaceCanvasPaneOpen === true) return false")) {
    throw new Error('expected Workspace View trigger repair to run only for active editor mode with a closed pane')
  }
  if (workspaceSelectText.includes('closeWorkspaceView({')) {
    throw new Error('expected toolbar Workspace View selection to avoid redundant close-then-open churn when the shared open helper can normalize state directly')
  }
  if (!workspaceSsotText.includes("args.setWorkspaceViewState({ mode: 'canvas', paneOpen: false })")) {
    throw new Error('expected shared workspace close helper to clear mode and pane-open state atomically')
  }
  if (!workspaceToolbarText.includes('setWorkspaceViewState,')) {
    throw new Error('expected workspace close action to pass atomic workspace view transition setter')
  }
  if (!workspaceToolbarText.includes('closeWorkspaceView({')) {
    throw new Error('expected workspace close action to reuse the shared close helper for residue cleanup')
  }
  if (workspaceToolbarText.includes("setWorkspaceViewMode('canvas')")) {
    throw new Error('expected workspace close action to avoid manual canvas-mode fallback bypassing the shared close helper')
  }
}

export function testWorkspaceEditorOverlayResizeHandleDragDirection() {
  const widened = resolveWorkspacePreviewWidthFromPointerDrag({
    startWidthPx: 400,
    startClientX: 100,
    currentClientX: 160,
  })
  if (widened !== 460) {
    throw new Error(`expected rightward drag to widen overlay from 400 to 460, got ${widened}`)
  }

  const narrowed = resolveWorkspacePreviewWidthFromPointerDrag({
    startWidthPx: 400,
    startClientX: 100,
    currentClientX: 40,
  })
  if (narrowed !== 340) {
    throw new Error(`expected leftward drag to narrow overlay from 400 to 340, got ${narrowed}`)
  }

  const minClamped = resolveWorkspacePreviewWidthFromPointerDrag({
    startWidthPx: 330,
    startClientX: 100,
    currentClientX: -200,
  })
  if (minClamped !== 320) {
    throw new Error(`expected overlay width to clamp at 320, got ${minClamped}`)
  }
}

export function testFlowEditorUsesCanonicalCanvasViewportForMeasurement() {
  const runtimePath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas.runtime.tsx')
  const runtimeText = readFileSync(runtimePath, 'utf8')
  if (!runtimeText.includes('self.closest(\'[data-kg-canvas-viewport-root="1"]\')')) {
    throw new Error('expected Flow Editor runtime to resolve viewport dims from the canonical canvas viewport root')
  }
  if (!runtimeText.includes('useContainerDims(rootRef, {')) {
    throw new Error('expected Flow Editor runtime to route viewport measurement through the shared container-dims hook')
  }
}

export function testWorkspaceEditorOverlayGatesD3SceneLayoutWrites() {
  const scenePath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useD3GraphScene2d.ts')
  const sceneText = readFileSync(scenePath, 'utf8')
  const presentationPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'hooks', 'useD3PresentationUpdates2d.ts')
  const presentationText = readFileSync(presentationPath, 'utf8')
  const actionsPath = resolve(process.cwd(), 'src', 'components', 'GraphCanvasRoot', 'utils', 'graphStoreActionAdapters.ts')
  const actionsText = readFileSync(actionsPath, 'utf8')
  if (!sceneText.includes("import { isWorkspaceEditorOverlayOpen } from '@/features/workspace-table/workspaceTableSsot'")) {
    throw new Error('expected D3 scene hook to reuse workspace overlay-open SSOT')
  }
  if (!sceneText.includes('const workspaceOverlayOpen = isWorkspaceEditorOverlayOpen({ workspaceViewMode, workspaceCanvasPaneOpen })')) {
    throw new Error('expected D3 scene hook to derive workspace overlay-open state via SSOT helper')
  }
  if (!sceneText.includes('workspaceOverlayOpenRef.current = workspaceOverlayOpen')) {
    throw new Error('expected D3 scene hook to keep overlay-open state as a latest-value guard')
  }
  if (!actionsText.includes('if (args.workspaceOverlayOpenRef?.current) return')) {
    throw new Error('expected shared GraphCanvasRoot store action adapter to block guarded writes while workspace overlay is open')
  }
  if (!sceneText.includes("import { buildGraphCanvasStoreActionAdapters } from '@/components/GraphCanvasRoot/utils/graphStoreActionAdapters'")) {
    throw new Error('expected D3 scene hook to reuse the shared GraphCanvasRoot store action adapter helper')
  }
  if (!sceneText.includes('addNode: graphStoreActions.addNode') || !sceneText.includes('updateEdge: graphStoreActions.updateEdge')) {
    throw new Error('expected D3 scene hook to route guarded canvas writes through the shared store action adapter')
  }
  if (!sceneText.includes("import { persistPrevLayoutSnapshot } from '@/components/GraphCanvasRoot/utils/persistPrevLayoutSnapshot'")) {
    throw new Error('expected D3 scene hook to reuse the shared previous-layout snapshot persistence helper')
  }
  const sceneSnapshotGuardIndex = sceneText.indexOf('Object.keys(prevPositions).length > 0 && !workspaceOverlayOpenRef.current')
  const sceneSnapshotWriteIndex = sceneText.indexOf('persistPrevLayoutSnapshot({')
  if (sceneSnapshotGuardIndex < 0 || sceneSnapshotWriteIndex < 0 || sceneSnapshotGuardIndex > sceneSnapshotWriteIndex) {
    throw new Error('expected D3 scene hook to block teardown layout snapshots while workspace overlay is open')
  }
  if (sceneText.includes('    workspaceOverlayOpen,\n    zoomToSelectionMode,')) {
    throw new Error('expected D3 scene hook not to rebuild from workspace overlay-open dependency churn')
  }
  if (!presentationText.includes("import { isWorkspaceEditorOverlayOpen } from '@/features/workspace-table/workspaceTableSsot'")) {
    throw new Error('expected D3 presentation hook to reuse workspace overlay-open SSOT')
  }
  if (!presentationText.includes('const workspaceOverlayOpen = isWorkspaceEditorOverlayOpen({ workspaceViewMode, workspaceCanvasPaneOpen })')) {
    throw new Error('expected D3 presentation hook to derive workspace overlay-open state via SSOT helper')
  }
  if (!presentationText.includes('workspaceOverlayOpenRef.current = workspaceOverlayOpen')) {
    throw new Error('expected D3 presentation hook to keep overlay-open state as a latest-value guard')
  }
  if (!presentationText.includes("import { buildGraphCanvasStoreActionAdapters } from '@/components/GraphCanvasRoot/utils/graphStoreActionAdapters'")) {
    throw new Error('expected D3 presentation hook to reuse the shared GraphCanvasRoot store action adapter helper')
  }
  if (!presentationText.includes('addEdge: graphStoreActions.addEdge') || !presentationText.includes('toggleGroupCollapsed: graphStoreActions.toggleGroupCollapsed')) {
    throw new Error('expected D3 presentation hook to route guarded writes and shared selection actions through the shared store action adapter')
  }
  if (presentationText.includes('    workspaceOverlayOpen,\n    workspaceViewMode,')) {
    throw new Error('expected D3 presentation hook not to rerun from workspace overlay-open dependency churn')
  }
}
