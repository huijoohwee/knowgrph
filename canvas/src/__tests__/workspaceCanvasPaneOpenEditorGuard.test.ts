import { useGraphStore } from '@/hooks/useGraphStore'
import {
  isWorkspaceEditorOverlayOpen,
  isWorkspaceGraphMutationBlocked,
} from '@/features/workspace-table/workspaceTableSsot'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

export async function testWorkspaceCanvasPaneOpenCanCloseWhileEditorMode() {
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
    if (after.workspaceCanvasPaneOpen !== false) {
      throw new Error('expected workspaceCanvasPaneOpen to follow explicit close while workspaceViewMode is editor')
    }
    if (isWorkspaceEditorOverlayOpen(after)) {
      throw new Error('expected workspace editor overlay-open SSOT to release when the editor pane is explicitly closed')
    }
    if (isWorkspaceGraphMutationBlocked({
      workspaceViewMode: after.workspaceViewMode,
      workspaceCanvasPaneOpen: after.workspaceCanvasPaneOpen,
      markdownWorkspaceIndexingInFlight: false,
      workspaceGraphMutationBlockUntilMs: 0,
      workspaceGraphMutationBlockKey: '',
    })) {
      throw new Error('expected editor mode with a closed workspace pane not to keep Flow Editor mutation blocked')
    }
    after.setWorkspaceViewState({ mode: 'canvas', paneOpen: false })
    const atomicClose = useGraphStore.getState()
    if (atomicClose.workspaceViewMode !== 'canvas' || atomicClose.workspaceCanvasPaneOpen !== false) {
      throw new Error('expected atomic workspace close to clear mode and pane-open state together')
    }
    useGraphStore.getState().toggleWorkspaceViewMode()
    const toggledOpen = useGraphStore.getState()
    if (toggledOpen.workspaceViewMode !== 'editor' || toggledOpen.workspaceCanvasPaneOpen !== true) {
      throw new Error('expected toggleWorkspaceViewMode to share editor pane-open normalization')
    }
    const transitions: string[] = []
    const unsubscribe = useGraphStore.subscribe(s => [s.workspaceViewMode, s.workspaceCanvasPaneOpen] as const, next => {
      transitions.push(`${next[0]}:${next[1] ? 'open' : 'closed'}`)
    })
    try {
      useGraphStore.getState().setWorkspaceViewState({ mode: 'canvas', paneOpen: false })
    } finally {
      unsubscribe()
    }
    if (transitions.includes('canvas:open')) {
      throw new Error('expected workspace close not to publish intermediate canvas/open state')
    }
  } finally {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
    bootstrap.restore()
  }
}
