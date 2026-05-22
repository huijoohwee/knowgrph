import { buildEnvelope, type TabSync } from '@/lib/tabSync'
import { useGraphStore } from '@/hooks/useGraphStore'

type TabSyncPublisher = Pick<TabSync, 'publish'>

export function publishCanvasTabSelectionMessage(args: {
  sync: TabSyncPublisher
  graphId: string | null | undefined
  tabId: string | null | undefined
  signature: string
}): void {
  const { sync, graphId, tabId, signature } = args
  const store = useGraphStore.getState()
  sync.publish(
    buildEnvelope(
      'SelectionChanged',
      String(graphId || ''),
      String(tabId || ''),
      {
        selectedNodeId: store.selectedNodeId || null,
        selectedEdgeId: store.selectedEdgeId || null,
      },
      { sig: signature },
    ),
  )
}

export function publishCanvasTabSchemaMessage(args: {
  sync: TabSyncPublisher
  graphId: string | null | undefined
  tabId: string | null | undefined
  signature: string | null
}): void {
  const { sync, graphId, tabId, signature } = args
  const store = useGraphStore.getState()
  sync.publish(
    buildEnvelope(
      'SchemaChanged',
      String(graphId || ''),
      String(tabId || ''),
      { schema: store.schema },
      { sig: signature },
    ),
  )
}
