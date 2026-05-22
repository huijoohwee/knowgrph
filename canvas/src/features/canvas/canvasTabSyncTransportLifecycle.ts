import { createTabSync } from '@/lib/tabSync'
import { STORAGE_CHANNELS } from '@/lib/config.ls.keys'
import { mountCanvasTabSyncInboundSubscription } from '@/features/canvas/canvasTabSyncInboundLifecycle'
import type {
  CanvasTabSyncBooleanRef,
  CanvasTabSyncNumberRef,
  CanvasTabSyncRef,
} from '@/features/canvas/canvasTabSyncShared'

export function mountCanvasTabSyncTransportLifecycle(args: {
  graphId: string | null | undefined
  tabId: string | null | undefined
  syncRef: CanvasTabSyncRef
  applyingRemoteRef: CanvasTabSyncBooleanRef
  lastSelectionRemoteTimestampRef: CanvasTabSyncNumberRef
  lastSchemaRemoteTimestampRef: CanvasTabSyncNumberRef
  selectNode: (nodeId: string | null) => void
  selectEdge: (edgeId: string | null) => void
  setSchema: (schema: never) => void
}): () => void {
  const {
    graphId,
    tabId,
    syncRef,
    applyingRemoteRef,
    lastSelectionRemoteTimestampRef,
    lastSchemaRemoteTimestampRef,
    selectNode,
    selectEdge,
    setSchema,
  } = args

  const sync = createTabSync(STORAGE_CHANNELS.tabSync)
  syncRef.current = sync
  const unsubscribe = mountCanvasTabSyncInboundSubscription({
    sync,
    graphId,
    tabId,
    applyingRemoteRef,
    lastSelectionRemoteTimestampRef,
    lastSchemaRemoteTimestampRef,
    selectNode,
    selectEdge,
    setSchema,
  })

  return () => {
    try {
      unsubscribe()
    } finally {
      try {
        sync.destroy()
      } catch {
        void 0
      }
      if (syncRef.current === sync) syncRef.current = null
    }
  }
}
