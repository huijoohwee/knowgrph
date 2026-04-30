import { useGraphStore } from '@/hooks/useGraphStore'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testWorkspaceCanvasPaneOpenCannotCloseWhileEditorMode() {
  const bootstrap = initJsdomHarness('<!doctype html><html><body></body></html>')
  try {
    try {
      window.localStorage.clear()
    } catch {
      void 0
    }
    const state = useGraphStore.getState()
    state.setWorkspaceViewMode('canvas')
    state.setWorkspaceCanvasPaneOpen(false)
    state.setWorkspaceViewMode('editor')
    const opened = useGraphStore.getState()
    if (opened.workspaceCanvasPaneOpen !== true) {
      throw new Error('expected direct editor mode open to clear stale closed workspace pane residue')
    }
    opened.setWorkspaceCanvasPaneOpen(false)
    const after = useGraphStore.getState()
    if (after.workspaceCanvasPaneOpen !== true) {
      throw new Error('expected workspaceCanvasPaneOpen to remain true while workspaceViewMode is editor')
    }
    after.setWorkspaceViewMode('canvas')
    after.setWorkspaceCanvasPaneOpen(false)
    useGraphStore.getState().toggleWorkspaceViewMode()
    const toggledOpen = useGraphStore.getState()
    if (toggledOpen.workspaceViewMode !== 'editor' || toggledOpen.workspaceCanvasPaneOpen !== true) {
      throw new Error('expected toggleWorkspaceViewMode to share editor pane-open normalization')
    }
  } finally {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    bootstrap.restore()
  }
}

