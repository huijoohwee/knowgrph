import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testWorkspaceViewUpdateSchedulesFlowEditorCollectiveCollisionRefresh() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayCollision.ts')
  const text = readFileSync(p, 'utf8')
  if (text.includes('workspaceViewSig')) {
    throw new Error('expected Flow Editor collective collision key to avoid workspace view signature coupling')
  }
  if (text.includes('workspaceCanvasPaneOpen === true ? 1 : 0')) {
    throw new Error('expected Flow Editor collective collision refresh to avoid workspace pane open state coupling')
  }
  if (!text.includes('const workspaceOverlayOpenRef = React.useRef(false)')) {
    throw new Error('expected Flow Editor collective collision to track workspace overlay open state without key coupling')
  }
  if (!text.includes("return state.workspaceViewMode === 'editor' && state.workspaceCanvasPaneOpen === true")) {
    throw new Error('expected Flow Editor collective collision to derive workspace overlay open state from store')
  }
  if (!text.includes('if (workspaceOverlayOpenRef.current) return')) {
    throw new Error('expected workspace overlay open state to block persisted Flow Editor widget position mutation')
  }
  const mutationGuardIndex = text.indexOf('if (workspaceOverlayOpenRef.current) return')
  const writebackIndex = text.indexOf('st.setFlowWidgetPosByNodeId(next)')
  if (mutationGuardIndex < 0 || writebackIndex < 0 || mutationGuardIndex > writebackIndex) {
    throw new Error('expected workspace overlay mutation guard before Flow Editor position writeback')
  }
  if (!text.includes('const unsubOpenWidgets = useGraphStore.subscribe(')) {
    throw new Error('expected Flow Editor collective collision to subscribe to open widget ids')
  }
  if (!text.includes('s.openWidgetNodeIds')) {
    throw new Error('expected Flow Editor collective collision refresh subscription to use openWidgetNodeIds')
  }
  if (text.includes('workspaceViewLayoutRefreshNonce')) {
    throw new Error('expected Flow Editor collective collision signature to avoid workspace layout refresh nonce coupling')
  }
}

export function testWorkspaceViewUpdateSchedulesFrontmatterMediaOverlayLayoutRefresh() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx')
  const text = readFileSync(p, 'utf8')
  if (text.includes('const workspaceViewSig =')) {
    throw new Error('expected FlowCanvas media overlays to avoid deriving workspace view signature')
  }
  if (!text.includes('mediaOverlayLayoutScheduleRef.current?.()')) {
    throw new Error('expected FlowCanvas media overlays to schedule layout updates')
  }
  if (!text.includes('plannedOverlayNodeIdsKey')) {
    throw new Error('expected FlowCanvas media overlay layout scheduling to track planned overlay ids')
  }
  if (!text.includes('mediaLayoutItemIdsKey')) {
    throw new Error('expected FlowCanvas media overlay layout scheduling to track media overlay item ids')
  }
  if (!text.includes('flowEditorFrontmatterDocumentModeRequested')) {
    throw new Error('expected FlowCanvas media overlay loop dependencies to include frontmatter document mode')
  }
  if (text.includes('workspaceViewLayoutRefreshNonce')) {
    throw new Error('expected FlowCanvas media overlay scheduling to avoid workspace layout refresh nonce coupling')
  }
}

export function testWorkspaceViewSelectRefreshesCollectiveLayoutWithoutCloseReopen() {
  const p = resolve(process.cwd(), 'src', 'components', 'toolbar', 'EditorWorkspaceSelect.tsx')
  const text = readFileSync(p, 'utf8')
  if (text.includes('bumpWorkspaceViewLayoutRefreshNonce')) {
    throw new Error('expected Workspace View toolbar selection to avoid layout refresh nonce bump side-effects')
  }
}

export function testCollectiveInitializationIndexingAndWorkspaceToggleDoNotMutateBalancedLayoutContracts() {
  const flowEditorPath = resolve(process.cwd(), 'src', 'components', 'FlowEditorCanvas', 'runtime', 'useFlowEditorOverlayCollision.ts')
  const flowEditorText = readFileSync(flowEditorPath, 'utf8')
  if (!flowEditorText.includes('const canDeferUntilMeasuredCollectiveLayout =')) {
    throw new Error('expected Flow Editor collective layout to defer rebalance until the full measured collective is ready')
  }
  if (!flowEditorText.includes('overlayMeasurementWarmupStartedAtMsRef')) {
    throw new Error('expected Flow Editor collective layout to keep an explicit init-warmup guard against partial overlay measurements')
  }
  if (flowEditorText.includes('workspaceViewSig') || flowEditorText.includes('workspaceViewLayoutRefreshNonce')) {
    throw new Error('expected Flow Editor collective layout to stay decoupled from workspace view refresh signatures')
  }
  if (!flowEditorText.includes('flowEditorSurfaceId,')) {
    throw new Error('expected Flow Editor collective layout runtime to key collision resolution off the active overlay surface identity')
  }
  if (!flowEditorText.includes('}, [editorRuntimeActive, flowEditorSurfaceId])')) {
    throw new Error('expected Flow Editor collective layout subscriptions to rebind when the active overlay surface identity changes')
  }

  const mediaLoopPath = resolve(process.cwd(), 'src', 'lib', 'render', 'mediaOverlayLayoutLoop2d.ts')
  const mediaLoopText = readFileSync(mediaLoopPath, 'utf8')
  if (!mediaLoopText.includes('const canDeferUntilCollectiveCentersStabilize =')) {
    throw new Error('expected frontmatter Rich Media collective layout to defer rebalance until collective centers are ready')
  }
  if (!mediaLoopText.includes('collectiveCenterWarmupStartedAtMs')) {
    throw new Error('expected Rich Media collective layout loop to keep an explicit center warmup guard')
  }

  const flowCanvasMediaPath = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'FlowCanvasMediaOverlays.tsx')
  const flowCanvasMediaText = readFileSync(flowCanvasMediaPath, 'utf8')
  if (!flowCanvasMediaText.includes('plannedOverlayNodeIdsKey')) {
    throw new Error('expected frontmatter collective scheduling to key off planned overlay ids instead of workspace view toggles')
  }
  if (!flowCanvasMediaText.includes('mediaLayoutItemIdsKey')) {
    throw new Error('expected frontmatter collective scheduling to key off active media layout items instead of workspace view toggles')
  }
  if (flowCanvasMediaText.includes('workspaceViewSig') || flowCanvasMediaText.includes('workspaceViewLayoutRefreshNonce')) {
    throw new Error('expected frontmatter collective scheduling to stay decoupled from workspace view refresh signatures')
  }

  const graphDataSlicePath = resolve(process.cwd(), 'src', 'hooks', 'store', 'graph-data-slice', 'graphDataCommitActions.ts')
  const graphDataSliceText = readFileSync(graphDataSlicePath, 'utf8')
  if (!graphDataSliceText.includes('preserveStableSameSourceOverlayState')) {
    throw new Error('expected graph commit path to preserve stable same-source collective overlay state during indexing recomposition')
  }
  if (!graphDataSliceText.includes('resolveCommittedFlowWidgetScreenPositions')) {
    throw new Error('expected graph commit path to centralize collective screen-position carry/cleanup decisions')
  }
}
