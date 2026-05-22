import React from 'react'
import { mountGraphStoreDocumentUiRestoreLifecycle } from '@/features/canvas/graphStoreDocumentUiRestoreLifecycle'

export function GraphStoreDocumentUiRestoreRuntime() {
  React.useEffect(() => {
    return mountGraphStoreDocumentUiRestoreLifecycle()
  }, [])

  return null
}
