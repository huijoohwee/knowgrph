import { useGraphStore } from '@/hooks/useGraphStore'
import { BOTTOM_PANEL_OPEN_EVENT, COLLAPSE_STORAGE_KEY, DEFAULT_BOTTOM_PANEL_HEIGHT_RATIO } from '@/features/bottom-panel/constants'
import { getLocalStorage, readBoolFromStorage, writeBoolToStorage } from '@/lib/persistence'
import { emitRendererPanelOpen } from '@/features/canvas/utils'

export type BottomTab =
  | 'stats'
  | 'parser'
  | 'schema'
  | 'orchestrator'
  | 'render'
  | 'settings'
  | 'history'

export type BottomTabId = BottomTab

function readBottomPanelCollapsed(storage: Storage | null): boolean {
  return readBoolFromStorage(storage, COLLAPSE_STORAGE_KEY, false)
}

function clearBottomPanelCollapsed(storage: Storage | null): void {
  writeBoolToStorage(storage, COLLAPSE_STORAGE_KEY, false)
}

export function openBottomPanel(tab: BottomTab = 'stats') {
  try {
    if (tab === 'render') {
      emitRendererPanelOpen()
      return
    }
    const s = useGraphStore.getState()
    if (tab) s.setBottomPanelTab(tab)
    const storage = getLocalStorage()
    const isCollapsed = readBottomPanelCollapsed(storage)
    if (isCollapsed) {
      clearBottomPanelCollapsed(storage)
      const ratio = s.bottomPanelHeightRatio
      if (!ratio || ratio < 0.1) s.setBottomPanelHeightRatio(DEFAULT_BOTTOM_PANEL_HEIGHT_RATIO)
    }
    try { window.dispatchEvent(new CustomEvent(BOTTOM_PANEL_OPEN_EVENT)) } catch { void 0 }
  } catch { void 0 }
}
