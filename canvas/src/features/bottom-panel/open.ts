import { useGraphStore } from '@/hooks/useGraphStore'
import { BOTTOM_PANEL_OPEN_EVENT, COLLAPSE_STORAGE_KEY, COLLAPSE_STORAGE_LEGACY_KEYS, DEFAULT_BOTTOM_PANEL_HEIGHT_RATIO } from '@/features/bottom-panel/constants'
import { getLocalStorage, readBoolFromStorage, writeBoolToStorage } from '@/lib/persistence'
import { emitRendererPanelOpen } from '@/features/canvas/utils'

export type BottomTab =
  | 'curation'
  | 'stats'
  | 'data'
  | 'nodes'
  | 'edges'
  | 'parser'
  | 'schema'
  | 'orchestrator'
  | 'render'
  | 'settings'
  | 'history'
  | 'code'

export type BottomTabId = BottomTab

function tryMigrateLegacyKeys(storage: Storage | null, key: string, legacyKeys?: string[]) {
  if (!storage) return
  if (!Array.isArray(legacyKeys) || legacyKeys.length === 0) return
  try {
    const existing = storage.getItem(key)
    if (existing !== null) return
    for (const legacyKey of legacyKeys) {
      const raw = storage.getItem(legacyKey)
      if (raw === null) continue
      try {
        storage.setItem(key, raw)
        storage.removeItem(legacyKey)
      } catch {
        void 0
      }
      return
    }
  } catch {
    void 0
  }
}

function readBottomPanelCollapsed(storage: Storage | null): boolean {
  tryMigrateLegacyKeys(storage, COLLAPSE_STORAGE_KEY, COLLAPSE_STORAGE_LEGACY_KEYS)
  return readBoolFromStorage(storage, COLLAPSE_STORAGE_KEY, false)
}

function clearBottomPanelCollapsed(storage: Storage | null): void {
  writeBoolToStorage(storage, COLLAPSE_STORAGE_KEY, false)
}

export function openBottomPanel(tab: BottomTab = 'curation') {
  try {
    const normalizedTab: BottomTab = tab === 'code' ? 'data' : tab
    if (normalizedTab === 'render') {
      emitRendererPanelOpen()
      return
    }
    const s = useGraphStore.getState()
    if (normalizedTab) s.setBottomPanelTab(normalizedTab)
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
