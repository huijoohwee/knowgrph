import React from 'react'
import { cancelIdle, scheduleIdle } from '@/features/panels/utils/idle'
import { useGraphStore } from '@/hooks/useGraphStore'
import { applyCanvasPreviewSyncPayload } from '@/features/canvas/canvasPreviewSyncInbound'

const CanvasTabSyncRuntimeLazy = React.lazy(() =>
  import('@/features/canvas/CanvasTabSyncRuntime').then(mod => ({ default: mod.CanvasTabSyncRuntime })),
)
const CanvasEmbeddedPreviewRuntimeLazy = React.lazy(() =>
  import('@/features/canvas/CanvasEmbeddedPreviewRuntime').then(mod => ({ default: mod.CanvasEmbeddedPreviewRuntime })),
)

export function CanvasSyncRuntime(props: {
  isEmbeddedPreview: boolean
  setIsEmbeddedPreview: React.Dispatch<React.SetStateAction<boolean>>
  detectEmbeddedPreviewWriteback: () => boolean
}) {
  const { isEmbeddedPreview, setIsEmbeddedPreview, detectEmbeddedPreviewWriteback } = props
  const enableTabSync = useGraphStore(s => s.enableTabSync)
  const lastInboundPreviewSelectionKeyRef = React.useRef<string>('')
  const lastInboundPreviewGraphHashRef = React.useRef<string>('')
  const lastInboundPreviewSchemaHashRef = React.useRef<string>('')
  const isEmbeddedPreviewRef = React.useRef<boolean>(isEmbeddedPreview)
  const [deferredSyncReady, setDeferredSyncReady] = React.useState(false)

  React.useEffect(() => {
    isEmbeddedPreviewRef.current = isEmbeddedPreview
  }, [isEmbeddedPreview])

  React.useEffect(() => {
    let cancelled = false
    const handle = scheduleIdle(() => {
      if (cancelled) return
      setDeferredSyncReady(true)
    })
    return () => {
      cancelled = true
      try {
        cancelIdle(handle)
      } catch {
        void 0
      }
    }
  }, [])

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      try {
        if (event.origin !== window.location.origin) return
        if (!window.parent || window.parent === window) return
        if (event.source && event.source !== window.parent) return
        const data = event.data as unknown
        if (!data || typeof data !== 'object') return
        const msg = data as { kind?: unknown; payload?: unknown }
        if (msg.kind !== 'kg-preview-sync') return
        if (!isEmbeddedPreviewRef.current) {
          isEmbeddedPreviewRef.current = true
          setIsEmbeddedPreview(true)
        }
        const payload = msg.payload as {
          graphData?: unknown
          schema?: unknown
          canvasRenderMode?: unknown
          canvas3dMode?: unknown
          canvas2dRenderer?: unknown
          selectedNodeId?: unknown
          selectedEdgeId?: unknown
          selectedGroupId?: unknown
        }
        applyCanvasPreviewSyncPayload({
          payload,
          lastInboundPreviewSelectionKeyRef,
          lastInboundPreviewGraphHashRef,
          lastInboundPreviewSchemaHashRef,
        })
      } catch {
        void 0
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [setIsEmbeddedPreview])

  return (
    <>
      {deferredSyncReady && enableTabSync ? (
        <React.Suspense fallback={null}>
          <CanvasTabSyncRuntimeLazy />
        </React.Suspense>
      ) : null}
      {deferredSyncReady && isEmbeddedPreview ? (
        <React.Suspense fallback={null}>
          <CanvasEmbeddedPreviewRuntimeLazy
            detectEmbeddedPreviewWriteback={detectEmbeddedPreviewWriteback}
            lastInboundPreviewSelectionKeyRef={lastInboundPreviewSelectionKeyRef}
            lastInboundPreviewGraphHashRef={lastInboundPreviewGraphHashRef}
          />
        </React.Suspense>
      ) : null}
    </>
  )
}
