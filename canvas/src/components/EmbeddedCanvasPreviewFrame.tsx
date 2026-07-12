import React from 'react'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { ZoomRequest } from '@/lib/zoom/requests'
import { hashGraphDataForPreviewSync } from '@/hooks/store/graphDataSliceUtils'
import {
  createEmbeddedCanvasChatSubmitMessage,
  deliverEmbeddedCanvasChatSubmit,
  installEmbeddedCanvasChatCommandBridge,
} from '@/features/canvas/embeddedCanvasChatCommand'

export function EmbeddedCanvasPreviewFrame(props: { previewSrc: string; className?: string }) {
  const graphData = useGraphStore(s => s.graphData)
  const graphDataRevision = useGraphStore(s => s.graphDataRevision)
  const schema = useGraphStore(s => s.schema)
  const canvasRenderMode = useGraphStore(s => s.canvasRenderMode)
  const canvas3dMode = useGraphStore(s => s.canvas3dMode)
  const canvas2dRenderer = useGraphStore(s => s.canvas2dRenderer)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const selectedGroupId = useGraphStore(s => s.selectedGroupId)
  const selectedNodeIds = useGraphStore(s => s.selectedNodeIds)
  const selectedEdgeIds = useGraphStore(s => s.selectedEdgeIds)
  const selectedGroupIds = useGraphStore(s => s.selectedGroupIds)
  const zoomRequest = useGraphStore(s => s.zoomRequest)
  const threeCameraRequest = useGraphStore(s => s.threeCameraRequest)
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null)
  const pendingZoomRef = React.useRef<ZoomRequest | null>(null)
  const pendingThreeRef = React.useRef<{ type: 'in' | 'out' | 'fit' | 'reset' | 'selection'; at: number } | null>(null)
  const lastInboundPreviewGraphHashRef = React.useRef<string>('')

  React.useEffect(() => installEmbeddedCanvasChatCommandBridge({
    submit: text => {
      const target = iframeRef.current?.contentWindow
      const message = createEmbeddedCanvasChatSubmitMessage(text)
      if (!target || !message) return false
      return deliverEmbeddedCanvasChatSubmit(target, message, window.location.origin)
    },
  }), [])

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
            canvas3dMode,
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
    canvas3dMode,
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

  const trySendZoomRequest = React.useCallback((req: ZoomRequest) => {
    const target = iframeRef.current?.contentWindow
    if (!target) return false
    try {
      target.postMessage({ kind: 'kg-preview-zoom', payload: { zoomRequest: req } }, window.location.origin)
      return true
    } catch {
      return false
    }
  }, [])

  const trySendThreeCameraRequest = React.useCallback((req: { type: 'in' | 'out' | 'fit' | 'reset' | 'selection'; at: number }) => {
    const target = iframeRef.current?.contentWindow
    if (!target) return false
    try {
      target.postMessage({ kind: 'kg-preview-three-camera', payload: { threeCameraRequest: req } }, window.location.origin)
      return true
    } catch {
      return false
    }
  }, [])

  React.useEffect(() => {
    void graphDataRevision
    sendPreviewSnapshot()
  }, [graphDataRevision, sendPreviewSnapshot])

  React.useEffect(() => {
    if (!zoomRequest) return
    const ok = trySendZoomRequest(zoomRequest)
    if (!ok) pendingZoomRef.current = zoomRequest
    try {
      useGraphStore.getState().clearZoomRequest()
    } catch {
      void 0
    }
  }, [trySendZoomRequest, zoomRequest])

  React.useEffect(() => {
    if (!threeCameraRequest) return
    const ok = trySendThreeCameraRequest(threeCameraRequest)
    if (!ok) pendingThreeRef.current = threeCameraRequest
    try {
      useGraphStore.getState().clearThreeCameraRequest()
    } catch {
      void 0
    }
  }, [threeCameraRequest, trySendThreeCameraRequest])

  React.useEffect(() => {
    sendPreviewSnapshot()
  }, [
    canvas2dRenderer,
    canvas3dMode,
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
        if (msg.kind === 'kg-preview-selection') {
          const payload = msg.payload as { selectedNodeId?: unknown; selectedEdgeId?: unknown; selectedGroupId?: unknown }
          const nextNodeId = typeof payload.selectedNodeId === 'string' ? payload.selectedNodeId : ''
          const nextEdgeId = typeof payload.selectedEdgeId === 'string' ? payload.selectedEdgeId : ''
          const nextGroupId = typeof payload.selectedGroupId === 'string' ? payload.selectedGroupId : ''
          const store = useGraphStore.getState()
          store.setSelectionSource('canvas')
          if (nextNodeId) store.selectNode(nextNodeId)
          else if (nextEdgeId) store.selectEdge(nextEdgeId)
          else if (nextGroupId) store.selectGroup(nextGroupId)
          else {
            store.selectNode(null)
          }
          return
        }

        if (msg.kind === 'kg-preview-graph') {
          const payload = msg.payload as { graphData?: unknown }
          if (!payload || !payload.graphData) return
          const store = useGraphStore.getState()
          const setGraphData = store.setGraphData
          const nextHash = hashGraphDataForPreviewSync(payload.graphData)
          const currentHash = hashGraphDataForPreviewSync(store.graphData)
          if (nextHash && nextHash === lastInboundPreviewGraphHashRef.current) return
          if (nextHash && nextHash === currentHash) {
            lastInboundPreviewGraphHashRef.current = nextHash
            return
          }
          if (typeof setGraphData === 'function') setGraphData(payload.graphData as never)
          if (nextHash) lastInboundPreviewGraphHashRef.current = nextHash
        }
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
        const pendingZoom = pendingZoomRef.current
        if (pendingZoom) {
          if (trySendZoomRequest(pendingZoom)) pendingZoomRef.current = null
        }
        const pendingThree = pendingThreeRef.current
        if (pendingThree) {
          if (trySendThreeCameraRequest(pendingThree)) pendingThreeRef.current = null
        }
      }}
    />
  )
}
