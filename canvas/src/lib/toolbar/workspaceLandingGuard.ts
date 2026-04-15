import { useGraphStore } from '@/hooks/useGraphStore'

export function ensureEditorCanvasLandingForDuration(durationMs: number = 1500): void {
  const ms = Number.isFinite(durationMs) ? Math.max(0, Math.min(10_000, Math.floor(durationMs))) : 1500

  const apply = () => {
    const state = useGraphStore.getState()
    if (state.workspaceViewMode !== 'editor') state.setWorkspaceViewMode('editor')
    if (state.editorWorkspacePane !== 'markdown') state.setEditorWorkspacePane('markdown')
    if (state.workspaceCanvasPaneOpen !== true) state.setWorkspaceCanvasPaneOpen(true)
  }

  try {
    apply()
  } catch {
    return
  }

  if (ms <= 0) return
  if (typeof window === 'undefined') return

  let stopping = false
  const startedAt = Date.now()

  const stop = () => {
    if (stopping) return
    stopping = true
    try {
      unsubscribe()
    } catch {
      void 0
    }
  }

  const unsubscribe = useGraphStore.subscribe(
    s => [s.workspaceViewMode, s.editorWorkspacePane, s.workspaceCanvasPaneOpen] as const,
    () => {
      if (stopping) return
      const elapsed = Date.now() - startedAt
      if (elapsed > ms) {
        stop()
        return
      }
      try {
        apply()
      } catch {
        stop()
      }
    },
  )

  try {
    window.setTimeout(stop, ms + 50)
  } catch {
    void 0
  }
}

