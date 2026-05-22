import { useGraphStore } from '@/hooks/useGraphStore'
import { writePerDocumentUiState } from '@/lib/persistence/perDocumentUiState'
import { cancelWorkspaceSyncTask, scheduleWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'
import {
  WORKSPACE_SYNC_SCOPE_PER_DOCUMENT_UI_RUNTIME_PERSISTENCE,
  WORKSPACE_SYNC_TASK_PER_DOCUMENT_UI,
} from '@/lib/async/workspaceSyncKeys'
import { graphStoreDocumentUiRuntimeShared } from '@/features/canvas/graphStoreDocumentUiRuntimeShared'
import {
  buildPendingDocumentUiPersistSignature,
  buildPendingDocumentUiPersistStateFromSnapshot,
  buildPendingDocumentUiPersistStateFromStore,
  type PendingDocumentUiPersistState,
  selectGraphStoreDocumentUiPersistSnapshot,
} from '@/features/canvas/graphStoreDocumentUiPersistState'

export function mountGraphStoreDocumentUiPersistLifecycle(): () => void {
  let pending: PendingDocumentUiPersistState | null = null

  const schedulePersist = () => {
    const signature = buildPendingDocumentUiPersistSignature(pending)
    scheduleWorkspaceSyncTask(
      WORKSPACE_SYNC_TASK_PER_DOCUMENT_UI,
      () => {
        const next = pending
        pending = null
        if (!next) return
        writePerDocumentUiState({
          documentKey: next.key,
          documentRef: next.ref,
          state: next.state,
        })
      },
      250,
      { signature, scopeKey: WORKSPACE_SYNC_SCOPE_PER_DOCUMENT_UI_RUNTIME_PERSISTENCE },
    )
  }

  const scheduleCurrentStatePersist = () => {
    const store = useGraphStore.getState()
    if (store.documentStructureBaselineLock === true) return
    pending = buildPendingDocumentUiPersistStateFromStore(store)
    if (!pending) return
    schedulePersist()
  }

  graphStoreDocumentUiRuntimeShared.scheduleCurrentStatePersist = scheduleCurrentStatePersist
  scheduleCurrentStatePersist()

  const unsubscribePersist = useGraphStore.subscribe(
    selectGraphStoreDocumentUiPersistSnapshot,
    (next, prev) => {
      if (graphStoreDocumentUiRuntimeShared.restoring) return

      if (prev?.docKey && prev.docKey !== next.docKey) {
        pending = buildPendingDocumentUiPersistStateFromSnapshot(prev)
        schedulePersist()
      }

      if (next.documentStructureBaselineLock === true) return
      if (prev?.docKey === next.docKey) {
        pending = buildPendingDocumentUiPersistStateFromSnapshot(next)
        schedulePersist()
      }
    },
  )

  return () => {
    unsubscribePersist()
    if (graphStoreDocumentUiRuntimeShared.scheduleCurrentStatePersist === scheduleCurrentStatePersist) {
      graphStoreDocumentUiRuntimeShared.scheduleCurrentStatePersist = null
    }
    cancelWorkspaceSyncTask(WORKSPACE_SYNC_TASK_PER_DOCUMENT_UI)
  }
}
