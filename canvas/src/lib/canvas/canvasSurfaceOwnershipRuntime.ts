import type { Canvas3dModeId } from '@/lib/config'

type CanvasSurfaceState = Readonly<{
  canvasRenderMode: '2d' | '3d'
  canvas3dMode: Canvas3dModeId
}>

let handleSharedXrDeparture: (() => void) | null = null
let handleSharedXrActivation: (() => boolean) | null = null
let transitionTransactionDepth = 0
let releaseSurfaceSource: (() => void) | null = null

export function registerSharedXrActivationHandler(handler: () => boolean): () => void {
  handleSharedXrActivation = handler
  return () => {
    if (handleSharedXrActivation === handler) handleSharedXrActivation = null
  }
}

export function requestSharedXrSurfaceActivation(): boolean {
  return handleSharedXrActivation?.() === true
}

export function interceptSharedXrSurfaceTransition(
  current: CanvasSurfaceState,
  requested: Partial<CanvasSurfaceState>,
): boolean {
  if (transitionTransactionDepth > 0) return false
  const canvasRenderMode = requested.canvasRenderMode ?? current.canvasRenderMode
  const canvas3dMode = requested.canvas3dMode ?? current.canvas3dMode
  if (canvasRenderMode !== '3d' || canvas3dMode !== 'xr') return false
  requestSharedXrSurfaceActivation()
  return true
}

export function registerSharedXrDepartureHandler(handler: () => void): () => void {
  handleSharedXrDeparture = handler
  return () => {
    if (handleSharedXrDeparture === handler) handleSharedXrDeparture = null
  }
}

export function notifyCanvasSurfaceStateChanged(state: CanvasSurfaceState): void {
  if (transitionTransactionDepth > 0) return
  if (state.canvasRenderMode === '3d' && state.canvas3dMode === 'xr') return
  handleSharedXrDeparture?.()
}

export function runCanvasSurfaceOwnershipTransaction<T>(operation: () => T): T {
  transitionTransactionDepth += 1
  try {
    return operation()
  } finally {
    transitionTransactionDepth -= 1
  }
}

export function bindCanvasSurfaceOwnershipSource(
  subscribe: (
    listener: (state: CanvasSurfaceState, previousState: CanvasSurfaceState) => void,
  ) => () => void,
): void {
  if (releaseSurfaceSource) return
  releaseSurfaceSource = subscribe((state, previousState) => {
    if (
      state.canvasRenderMode === previousState.canvasRenderMode
      && state.canvas3dMode === previousState.canvas3dMode
    ) return
    notifyCanvasSurfaceStateChanged(state)
  })
}
