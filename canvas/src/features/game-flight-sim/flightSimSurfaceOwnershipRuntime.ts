import { useGraphStore } from '@/hooks/useGraphStore'
import { runCanvasSurfaceOwnershipTransaction } from '@/lib/canvas/canvasSurfaceOwnershipRuntime'
import {
  pauseXrPhysicsRuntime,
  playXrPhysicsRuntime,
  readXrPhysicsRuntime,
} from '@/features/three/xrPhysicsRuntime'
import { isXrGameplaySurfaceView } from '@/features/three/xrSceneSurfaceRuntime'

type GraphStoreState = ReturnType<typeof useGraphStore.getState>

export type FlightSimPreviousCanvasSurface = Readonly<Pick<
  GraphStoreState,
  | 'canvasRenderMode'
  | 'canvas3dMode'
  | 'canvasRenderModeLastFree'
  | 'canvasRenderModeIsAuto'
  | 'floatingPanelOpen'
  | 'floatingPanelView'
>>

export type FlightSimAuthoredRuntimeOwnership = Readonly<{
  physicsWasPlaying: boolean
  timelineWasPlaying: boolean
}>

export function captureFlightSimPreviousCanvasSurface(): FlightSimPreviousCanvasSurface {
  const state = useGraphStore.getState()
  return Object.freeze({
    canvasRenderMode: state.canvasRenderMode,
    canvas3dMode: state.canvas3dMode,
    canvasRenderModeLastFree: state.canvasRenderModeLastFree,
    canvasRenderModeIsAuto: state.canvasRenderModeIsAuto,
    floatingPanelOpen: state.floatingPanelOpen,
    floatingPanelView: isXrGameplaySurfaceView(state.floatingPanelView)
      ? 'motionControl'
      : state.floatingPanelView,
  })
}

export function captureFlightSimAuthoredRuntimeOwnership(): FlightSimAuthoredRuntimeOwnership {
  return Object.freeze({
    physicsWasPlaying: readXrPhysicsRuntime().phase === 'playing',
    timelineWasPlaying: useGraphStore.getState().timelineTransportPlaying === true,
  })
}

export function suspendFlightSimAuthoredRuntime(): void {
  pauseXrPhysicsRuntime()
  useGraphStore.getState().setTimelineTransportState({ playing: false })
}

export function restoreFlightSimAuthoredRuntime(
  ownership: FlightSimAuthoredRuntimeOwnership | null,
): void {
  if (!ownership) return
  if (ownership.physicsWasPlaying) playXrPhysicsRuntime()
  else pauseXrPhysicsRuntime()
  useGraphStore.getState().setTimelineTransportState({
    playing: ownership.timelineWasPlaying,
  })
}

export function restoreFlightSimPreviousCanvasSurface(
  previous: FlightSimPreviousCanvasSurface,
): void {
  runCanvasSurfaceOwnershipTransaction(() => {
    const state = useGraphStore.getState()
    state.setCanvas3dMode(previous.canvas3dMode)
    state.setCanvasRenderMode(previous.canvasRenderMode)
    state.setFloatingPanelView(previous.floatingPanelView)
    state.setFloatingPanelOpen(previous.floatingPanelOpen)
    useGraphStore.setState({
      canvasRenderModeLastFree: previous.canvasRenderModeLastFree,
      canvasRenderModeIsAuto: previous.canvasRenderModeIsAuto,
    })
  })
}
