import type { SyncEnvelope } from '@/lib/tabSync'
import type { CanvasTabSyncNumberRef } from '@/features/canvas/canvasTabSyncShared'

export const canApplyCanvasTabSyncInboundMessage = (
  msg: SyncEnvelope<unknown>,
  graphId: string | null | undefined,
  tabId: string | null | undefined,
): boolean => {
  if (msg.graphId !== graphId) return false
  if (msg.sourceTabId === tabId) return false
  return true
}

export function applyCanvasTabSyncInboundMessage(args: {
  msg: SyncEnvelope<unknown>
  lastSelectionRemoteTimestampRef: CanvasTabSyncNumberRef
  lastSchemaRemoteTimestampRef: CanvasTabSyncNumberRef
  selectNode: (nodeId: string | null) => void
  selectEdge: (edgeId: string | null) => void
  setSchema: (schema: never) => void
}): void {
  const {
    msg,
    lastSelectionRemoteTimestampRef,
    lastSchemaRemoteTimestampRef,
    selectNode,
    selectEdge,
    setSchema,
  } = args

  if (msg.kind === 'SelectionChanged') {
    const ts = typeof msg.timestamp === 'number' ? msg.timestamp : 0
    if (ts <= lastSelectionRemoteTimestampRef.current) return
    lastSelectionRemoteTimestampRef.current = ts
    const payload = msg.payload as { selectedNodeId: string | null; selectedEdgeId: string | null }
    selectNode(payload.selectedNodeId ?? null)
    selectEdge(payload.selectedEdgeId ?? null)
    return
  }

  if (msg.kind !== 'SchemaChanged') return

  const ts = typeof msg.timestamp === 'number' ? msg.timestamp : 0
  if (ts <= lastSchemaRemoteTimestampRef.current) return
  lastSchemaRemoteTimestampRef.current = ts
  const payload = msg.payload as { schema?: unknown }
  if (!payload || typeof payload !== 'object' || !('schema' in payload)) return
  setSchema(payload.schema as never)
}
