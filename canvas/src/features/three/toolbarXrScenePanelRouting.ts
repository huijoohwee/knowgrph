import type { FloatingPanelView } from '@/hooks/store/store-types/graph-state-chat-import'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  activateXrSceneSurface,
  XR_SCENE_FLOATING_PANEL_VIEWS,
} from './xrSceneSurfaceRuntime'

export function routeToolbarXrScenePanel(input: Readonly<{
  view: FloatingPanelView
  canvasRenderMode: string
  canvas3dMode: string
}>): boolean {
  const panelView = XR_SCENE_FLOATING_PANEL_VIEWS.find(candidate => candidate === input.view)
  if (!panelView || input.canvasRenderMode !== '3d' || input.canvas3dMode !== 'xr') return false
  if (!activateXrSceneSurface({ panelView })) {
    useGraphStore.getState().pushUiToast({
      id: `xr-scene-panel:${panelView}:unavailable`,
      kind: 'error',
      message: 'The shared XR Mode surface is unavailable for this document.',
    })
  }
  return true
}
