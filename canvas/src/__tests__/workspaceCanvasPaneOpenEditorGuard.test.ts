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
    state.setWorkspaceViewMode('editor')
    state.setWorkspaceCanvasPaneOpen(false)
    const after = useGraphStore.getState()
    if (after.workspaceCanvasPaneOpen !== true) {
      throw new Error('expected workspaceCanvasPaneOpen to remain true while workspaceViewMode is editor')
    }
  } finally {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    bootstrap.restore()
  }
}

