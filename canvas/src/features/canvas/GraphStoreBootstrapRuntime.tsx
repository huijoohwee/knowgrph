import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { applyCanvasSliceStorageMigrations } from '@/hooks/store/canvasSliceStorageMigrations'
import { applyFlowEditorManagerDefaultRegistrySeed } from '@/hooks/store/flowEditorManagerRegistryPersistence'
import { applyGraphViewPinnedSemanticsMigration } from '@/hooks/store/graphViewPinnedSemanticsMigration'
import { ensureSessionTabId } from '@/hooks/store/uiSettingsSliceSession'

export function GraphStoreBootstrapRuntime() {
  React.useLayoutEffect(() => {
    const tabId = ensureSessionTabId()
    if (!tabId || tabId === 'tab-ssr') return
    if (useGraphStore.getState().tabId === tabId) return
    useGraphStore.setState({ tabId })
  }, [])

  React.useEffect(() => {
    applyCanvasSliceStorageMigrations()
    applyFlowEditorManagerDefaultRegistrySeed()
    applyGraphViewPinnedSemanticsMigration()
  }, [])

  return null
}
