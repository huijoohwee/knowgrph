export const WORKSPACE_TABLE_PREFS_EVENT = 'kg:workspace-table-prefs:changed' as const

export function emitWorkspaceTablePreferencesChanged(): void {
  if (typeof window === 'undefined') return
  try {
    const EventCtor = typeof window.Event === 'function' ? window.Event : Event
    window.dispatchEvent(new EventCtor(WORKSPACE_TABLE_PREFS_EVENT))
  } catch {
    void 0
  }
}

export function subscribeWorkspaceTablePreferencesChanged(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => void 0
  const handle = () => {
    listener()
  }
  window.addEventListener(WORKSPACE_TABLE_PREFS_EVENT, handle as EventListener)
  return () => {
    window.removeEventListener(WORKSPACE_TABLE_PREFS_EVENT, handle as EventListener)
  }
}
