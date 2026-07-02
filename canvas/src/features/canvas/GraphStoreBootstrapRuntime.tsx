import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import { applyCanvasSliceStorageMigrations } from '@/hooks/store/canvasSliceStorageMigrations'
import { applyStoryboardWidgetManagerDefaultRegistrySeed } from '@/hooks/store/storyboardWidgetManagerRegistryPersistence'
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
    applyStoryboardWidgetManagerDefaultRegistrySeed()
    applyGraphViewPinnedSemanticsMigration()
  }, [])

  return null
}
