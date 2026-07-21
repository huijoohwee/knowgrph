import { setMediaCatalogMode } from '@/features/command-menu/mediaCatalogModeRuntime'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  activateCanvasGraphSurfaceMode,
  isCanvasSurfaceModeSelectable,
} from '@/lib/canvas/canvas3dMode'
import {
  bindCanvasSurfaceOwnershipSource,
  registerSharedXrActivationHandler,
  registerSharedXrDepartureHandler,
  runCanvasSurfaceOwnershipTransaction,
} from '@/lib/canvas/canvasSurfaceOwnershipRuntime'

export const XR_SCENE_FLOATING_PANEL_VIEWS = [
  'media',
  'animation',
  'motionControl',
  'gameMode',
  'camera',
] as const

export type XrSceneFloatingPanelView = (typeof XR_SCENE_FLOATING_PANEL_VIEWS)[number]

export type XrSceneSurfaceActivation = Readonly<{
  panelView?: XrSceneFloatingPanelView
  openPanel?: boolean
  timeline?: boolean
  beforePanelCommit?: () => void
}>

let exitActiveGameMode: (() => void) | null = null

registerSharedXrDepartureHandler(() => exitActiveGameMode?.())

export function registerXrSceneGameModeExitHandler(handler: () => void): () => void {
  bindCanvasSurfaceOwnershipSource(listener => useGraphStore.subscribe(listener))
  exitActiveGameMode = handler
  return () => {
    if (exitActiveGameMode === handler) exitActiveGameMode = null
  }
}

export function activateXrSceneSurface(
  activation: XrSceneSurfaceActivation = {},
): boolean {
  const state = useGraphStore.getState()
  const alreadyXr = state.canvasRenderMode === '3d' && state.canvas3dMode === 'xr'
  if (!alreadyXr && !isCanvasSurfaceModeSelectable({
    canvas2dRenderer: state.canvas2dRenderer,
    documentSemanticMode: state.documentSemanticMode,
    frontmatterModeEnabled: state.frontmatterModeEnabled === true,
    multiDimTableModeEnabled: state.multiDimTableModeEnabled === true,
    layoutMode: state.schema?.layout?.mode,
    schema: state.schema,
  }, 'xr')) return false
  const previousSurface = Object.freeze({
    canvasRenderMode: state.canvasRenderMode,
    canvas3dMode: state.canvas3dMode,
    canvasRenderModeLastFree: state.canvasRenderModeLastFree,
    canvasRenderModeIsAuto: state.canvasRenderModeIsAuto,
  })
  const activeState = runCanvasSurfaceOwnershipTransaction(() => {
    activateCanvasGraphSurfaceMode({
      mode: 'xr',
      setCanvas3dMode: state.setCanvas3dMode,
      setCanvasRenderMode: state.setCanvasRenderMode,
    })
    const nextState = useGraphStore.getState()
    if (nextState.canvasRenderMode === '3d' && nextState.canvas3dMode === 'xr') return nextState
    nextState.setCanvas3dMode(previousSurface.canvas3dMode)
    useGraphStore.setState(previousSurface)
    return null
  })
  if (!activeState) return false

  try {
    activation.beforePanelCommit?.()
  } catch (error) {
    runCanvasSurfaceOwnershipTransaction(() => {
      activeState.setCanvas3dMode(previousSurface.canvas3dMode)
      useGraphStore.setState(previousSurface)
    })
    throw error
  }

  if (activation.panelView && activation.panelView !== 'gameMode') exitActiveGameMode?.()
  if (activation.panelView === 'media') setMediaCatalogMode('xr-3d')
  if (activation.panelView) activeState.setFloatingPanelView(activation.panelView)
  if (activation.openPanel) activeState.setFloatingPanelOpen(true)
  if (activation.timeline) {
    activeState.setBottomSurfaceTab('timeline')
    activeState.setBottomSurfaceCollapsed(false)
  }
  return true
}

registerSharedXrActivationHandler(() => activateXrSceneSurface())
