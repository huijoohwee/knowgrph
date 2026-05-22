import React from 'react'
import { GraphStoreDocumentUiRestoreRuntime } from '@/features/canvas/GraphStoreDocumentUiRestoreRuntime'

const GraphStoreDocumentUiPersistRuntimeLazy = React.lazy(() =>
  import('@/features/canvas/GraphStoreDocumentUiPersistRuntime').then(mod => ({ default: mod.GraphStoreDocumentUiPersistRuntime })),
)

export function GraphStoreDocumentUiRuntime() {
  return (
    <>
      <GraphStoreDocumentUiRestoreRuntime />
      <React.Suspense fallback={null}>
        <GraphStoreDocumentUiPersistRuntimeLazy />
      </React.Suspense>
    </>
  )
}
