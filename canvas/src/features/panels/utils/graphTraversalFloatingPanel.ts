export const GRAPH_TRAVERSAL_FLOATING_PANEL_EVENT = 'kg:floatingPanelOpen:graphTraversal' as const

export function emitGraphTraversalFloatingPanelOpen(): void {
  try {
    if (typeof window === 'undefined') return
    window.dispatchEvent(new CustomEvent(GRAPH_TRAVERSAL_FLOATING_PANEL_EVENT))
  } catch {
    void 0
  }
}

