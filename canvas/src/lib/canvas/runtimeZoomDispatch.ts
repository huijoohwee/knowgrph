import { readGeospatialModeEnabled } from '@/features/geospatial/gympgrphBridge'
import { useGraphStore } from '@/hooks/useGraphStore'

type RuntimeZoomAction = 'in' | 'out' | 'reset' | 'selection'
type RuntimeFitIntent = 'fitToView' | 'fitToScreen'

export async function dispatchRuntimeZoomAction(type: RuntimeZoomAction): Promise<void> {
  const store = useGraphStore.getState()
  const geospatialEnabled = await readGeospatialModeEnabled().catch(() => false)
  if (geospatialEnabled) {
    store.requestZoom(type)
    return
  }
  if (store.canvasRenderMode === '2d') {
    store.requestZoom(type)
    return
  }
  store.requestThreeCamera(type)
}

export async function dispatchRuntimeFitToView(): Promise<void> {
  return dispatchRuntimeFitIntent('fitToView')
}

export async function dispatchRuntimeFitIntent(intent: RuntimeFitIntent): Promise<void> {
  const store = useGraphStore.getState()
  const geospatialEnabled = await readGeospatialModeEnabled().catch(() => false)
  if (geospatialEnabled) {
    store.requestZoom('fit', { intent })
    return
  }
  if (store.canvasRenderMode === '3d') {
    store.requestThreeCamera('fit')
    return
  }
  store.requestZoom('fit', { intent })
}

export function dispatchRuntimeZoomActionSoon(type: RuntimeZoomAction): void {
  void dispatchRuntimeZoomAction(type)
}

export function dispatchRuntimeFitToViewSoon(): void {
  void dispatchRuntimeFitToView()
}

export function dispatchRuntimeFitIntentSoon(intent: RuntimeFitIntent): void {
  void dispatchRuntimeFitIntent(intent)
}
