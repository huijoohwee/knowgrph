import type { FloatingPanelView } from '@/hooks/store/store-types/graph-state-chat-import'
import { useGraphStore } from '@/hooks/useGraphStore'
import { activateCanvasGraphSurfaceMode } from '@/lib/canvas/canvas3dMode'
import {
  setMediaCatalogMode,
  type MediaCatalogMode,
} from '@/features/command-menu/mediaCatalogModeRuntime'

export type MotionControlSurfaceTarget = 'motion-control' | 'xr-3d' | 'animation'
export type MotionControlCompanionTarget = Exclude<MotionControlSurfaceTarget, 'motion-control'>
export const MOTION_CONTROL_XR_UNAVAILABLE_MESSAGE = 'Motion Control requires XR Mode, but this document currently prevents XR activation.'

type MotionControlSurfaceSpec = Readonly<{
  label: string
  view: FloatingPanelView
}>

export const MOTION_CONTROL_SURFACE_CATALOG = Object.freeze({
  'motion-control': Object.freeze({ label: 'Motion Control', view: 'motionControl' }),
  'xr-3d': Object.freeze({ label: '3D for XR', view: 'media' }),
  animation: Object.freeze({ label: 'Animation', view: 'animation' }),
} satisfies Record<MotionControlSurfaceTarget, MotionControlSurfaceSpec>)

const MOTION_CONTROL_DIRECT_CAPTURE_VIEWS = new Set<FloatingPanelView>(['motionControl', 'animation'])

export function motionControlCaptureSurfaceIsOpen(input: Readonly<{
  canvas3dMode: string
  canvasRenderMode: string
  floatingPanelOpen: boolean
  floatingPanelView: FloatingPanelView
  mediaCatalogMode: MediaCatalogMode
}>): boolean {
  if (input.canvasRenderMode !== '3d' || input.canvas3dMode !== 'xr' || !input.floatingPanelOpen) return false
  return MOTION_CONTROL_DIRECT_CAPTURE_VIEWS.has(input.floatingPanelView)
    || (input.floatingPanelView === 'media' && input.mediaCatalogMode === 'xr-3d')
}

export function openMotionControlSurface(target: MotionControlSurfaceTarget): boolean {
  const state = useGraphStore.getState()
  activateCanvasGraphSurfaceMode({
    mode: 'xr',
    setCanvas3dMode: state.setCanvas3dMode,
    setCanvasRenderMode: state.setCanvasRenderMode,
  })
  const activeState = useGraphStore.getState()
  if (activeState.canvasRenderMode !== '3d' || activeState.canvas3dMode !== 'xr') return false
  if (target === 'xr-3d') setMediaCatalogMode('xr-3d')
  activeState.setFloatingPanelView(MOTION_CONTROL_SURFACE_CATALOG[target].view)
  activeState.setFloatingPanelOpen(true)
  activeState.setBottomSurfaceTab('timeline')
  activeState.setBottomSurfaceCollapsed(false)
  return true
}
