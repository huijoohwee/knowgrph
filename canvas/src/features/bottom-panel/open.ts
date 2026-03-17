export type BottomTab = 'stats' | 'render' | 'history'

export function openBottomPanel(tab: BottomTab) {
  try {
    window.dispatchEvent(
      new CustomEvent('kg:open-bottom-panel', {
        detail: { tab },
      }),
    )
  } catch {
    void 0
  }
}

