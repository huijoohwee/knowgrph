import type { TabSync } from '@/lib/tabSync'
import {
  applyCanvasTabSyncInboundMessage,
  canApplyCanvasTabSyncInboundMessage,
} from '@/features/canvas/canvasTabSyncInbound'
import type {
  CanvasTabSyncBooleanRef,
  CanvasTabSyncNumberRef,
} from '@/features/canvas/canvasTabSyncShared'

export function mountCanvasTabSyncInboundSubscription(args: {
  sync: TabSync
  graphId: string | null | undefined
  tabId: string | null | undefined
  applyingRemoteRef: CanvasTabSyncBooleanRef
  lastSelectionRemoteTimestampRef: CanvasTabSyncNumberRef
  lastSchemaRemoteTimestampRef: CanvasTabSyncNumberRef
  selectNode: (nodeId: string | null) => void
  selectEdge: (edgeId: string | null) => void
  setSchema: (schema: never) => void
}): () => void {
  const {
    sync,
    graphId,
    tabId,
    applyingRemoteRef,
    lastSelectionRemoteTimestampRef,
    lastSchemaRemoteTimestampRef,
    selectNode,
    selectEdge,
    setSchema,
  } = args

  return sync.subscribe(msg => {
    if (!canApplyCanvasTabSyncInboundMessage(msg, graphId, tabId)) return
    applyingRemoteRef.current = true
    try {
      applyCanvasTabSyncInboundMessage({
        msg,
        lastSelectionRemoteTimestampRef,
        lastSchemaRemoteTimestampRef,
        selectNode,
        selectEdge,
        setSchema,
      })
    } finally {
      applyingRemoteRef.current = false
    }
  })
}
