export const MAIN_PANEL_OPEN_EVENT = 'kg:mainPanelOpen' as const
export const MAIN_PANEL_OPEN_READY_EVENT = 'kg:mainPanelOpenReady' as const
export { GRAPH_TRAVERSAL_FLOATING_PANEL_EVENT } from '@/features/panels/utils/graphTraversalFloatingPanel'

export function emitMainPanelOpen(detail: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  const CustomEventCtor = typeof window.CustomEvent === 'function' ? window.CustomEvent : CustomEvent
  window.dispatchEvent(new CustomEventCtor(MAIN_PANEL_OPEN_EVENT, { detail }))
}
