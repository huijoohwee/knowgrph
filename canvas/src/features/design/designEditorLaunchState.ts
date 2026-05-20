import { useGraphStore } from '@/hooks/useGraphStore'

export function activateDesignEditorSurface(opts?: {
  openFloatingPanel?: boolean
  pointerMode?: 'select' | 'pan'
}) {
  try {
    const store = useGraphStore.getState()
    store.setCanvasRenderMode('2d')
    store.setCanvas2dRenderer('design')
    store.setCanvasPointerMode2d(opts?.pointerMode === 'pan' ? 'pan' : 'select')
    store.setWorkspaceViewMode('canvas')
    if (opts?.openFloatingPanel !== false) {
      store.setFloatingPanelOpen(true)
      store.setFloatingPanelView('design')
    }
  } catch {
    void 0
  }

  void import('@/features/geospatial/gympgrphBridge')
    .then(mod => mod.setGeospatialModeEnabled(false))
    .catch(() => void 0)
}
