import { useGraphStore } from '@/hooks/useGraphStore'
import { buildDocumentKey, buildDocumentRef, readPerDocumentUiState } from '@/lib/persistence/perDocumentUiState'
import { graphStoreDocumentUiRuntimeShared } from '@/features/canvas/graphStoreDocumentUiRuntimeShared'
import {
  applySavedDocumentUiPresentationState,
  applySavedDocumentUiSelectionState,
} from '@/features/canvas/graphStoreDocumentUiRestoreHelpers'

export function mountGraphStoreDocumentUiRestoreLifecycle(): () => void {
  const unsubscribeRestore = useGraphStore.subscribe(
    s => ({
      docKey: buildDocumentKey({ name: s.markdownDocumentName, sourceUrl: s.markdownDocumentSourceUrl }),
      docRef: buildDocumentRef({ name: s.markdownDocumentName, sourceUrl: s.markdownDocumentSourceUrl }),
      documentStructureBaselineLock: s.documentStructureBaselineLock,
      applyViewPreset: s.markdownDocumentApplyViewPreset !== false,
    }),
    (next, prev) => {
      if (next.docKey === prev?.docKey) return
      if (next.documentStructureBaselineLock === true) return
      if (next.applyViewPreset === false) return
      const saved = readPerDocumentUiState({ documentKey: next.docKey, documentRef: next.docRef })
      if (!saved) return

      const api = useGraphStore.getState()
      graphStoreDocumentUiRuntimeShared.restoring = true
      try {
        applySavedDocumentUiPresentationState(api, saved)
        applySavedDocumentUiSelectionState(api, saved)
      } finally {
        graphStoreDocumentUiRuntimeShared.restoring = false
      }

      graphStoreDocumentUiRuntimeShared.scheduleCurrentStatePersist?.()
    },
  )

  return () => {
    unsubscribeRestore()
    graphStoreDocumentUiRuntimeShared.restoring = false
  }
}
