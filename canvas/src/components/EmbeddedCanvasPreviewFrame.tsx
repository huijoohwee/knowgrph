import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'

export function EmbeddedCanvasPreviewFrame(props: { previewSrc: string; className?: string }) {
  const graphData = useGraphStore(s => s.graphData)
  const graphDataRevision = useGraphStore(s => s.graphDataRevision)
  const schema = useGraphStore(s => s.schema)
  const canvasRenderMode = useGraphStore(s => s.canvasRenderMode)
  const canvas2dRenderer = useGraphStore(s => s.canvas2dRenderer)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const selectedGroupId = useGraphStore(s => s.selectedGroupId)
  const selectedNodeIds = useGraphStore(s => s.selectedNodeIds)
  const selectedEdgeIds = useGraphStore(s => s.selectedEdgeIds)
  const selectedGroupIds = useGraphStore(s => s.selectedGroupIds)
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null)

  const sendPreviewSnapshot = React.useCallback(() => {
    const target = iframeRef.current?.contentWindow
    if (!target) return
    try {
      target.postMessage(
        {
          kind: 'kg-preview-sync',
          payload: {
            graphData,
            schema,
            canvasRenderMode,
            canvas2dRenderer,
            selectedNodeId,
            selectedEdgeId,
            selectedGroupId,
            selectedNodeIds,
            selectedEdgeIds,
            selectedGroupIds,
          },
        },
        window.location.origin,
      )
    } catch {
      void 0
    }
  }, [
    canvas2dRenderer,
    canvasRenderMode,
    graphData,
    schema,
    selectedEdgeId,
    selectedEdgeIds,
    selectedGroupId,
    selectedGroupIds,
    selectedNodeId,
    selectedNodeIds,
  ])

  React.useEffect(() => {
    void graphDataRevision
    sendPreviewSnapshot()
  }, [graphDataRevision, sendPreviewSnapshot])

  React.useEffect(() => {
    sendPreviewSnapshot()
  }, [
    canvas2dRenderer,
    canvasRenderMode,
    schema,
    selectedEdgeId,
    selectedEdgeIds,
    selectedGroupId,
    selectedGroupIds,
    selectedNodeId,
    selectedNodeIds,
    sendPreviewSnapshot,
  ])

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      try {
        if (event.origin !== window.location.origin) return
        const data = event.data as unknown
        if (!data || typeof data !== 'object') return
        const msg = data as { kind?: unknown; payload?: unknown }
        if (msg.kind !== 'kg-preview-selection') return
        const payload = msg.payload as { selectedNodeId?: unknown; selectedEdgeId?: unknown; selectedGroupId?: unknown }
        const nextNodeId = typeof payload.selectedNodeId === 'string' ? payload.selectedNodeId : ''
        const nextEdgeId = typeof payload.selectedEdgeId === 'string' ? payload.selectedEdgeId : ''
        const nextGroupId = typeof payload.selectedGroupId === 'string' ? payload.selectedGroupId : ''
        const store = useGraphStore.getState()
        store.setSelectionSource('canvas')
        if (nextNodeId) store.selectNode(nextNodeId)
        else if (nextEdgeId) store.selectEdge(nextEdgeId)
        else if (nextGroupId) store.selectGroup(nextGroupId)
      } catch {
        void 0
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  return (
    <iframe
      title="Canvas Preview"
      src={props.previewSrc}
      className={props.className || 'block w-full h-full border-0'}
      sandbox="allow-scripts allow-same-origin allow-forms allow-downloads"
      data-kg-preview="1"
      ref={el => {
        iframeRef.current = el
      }}
      onLoad={() => {
        sendPreviewSnapshot()
      }}
    />
  )
}

