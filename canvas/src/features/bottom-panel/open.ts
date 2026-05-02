export type BottomTab = 'stats' | 'render' | 'history'

export const BOTTOM_PANEL_OPEN_EVENT = 'kg:open-bottom-panel' as const

export function openBottomPanel(tab: BottomTab) {
  if (typeof window === 'undefined') return
  try {
    const CustomEventCtor = typeof window.CustomEvent === 'function' ? window.CustomEvent : CustomEvent
    window.dispatchEvent(
      new CustomEventCtor(BOTTOM_PANEL_OPEN_EVENT, {
        detail: { tab },
      }),
    )
  } catch {
    void 0
  }
}
