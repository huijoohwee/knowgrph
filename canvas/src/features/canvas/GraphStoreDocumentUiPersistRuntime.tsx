import React from 'react'
import { mountGraphStoreDocumentUiPersistLifecycle } from '@/features/canvas/graphStoreDocumentUiPersistLifecycle'

export function GraphStoreDocumentUiPersistRuntime() {
  React.useEffect(() => {
    return mountGraphStoreDocumentUiPersistLifecycle()
  }, [])

  return null
}
