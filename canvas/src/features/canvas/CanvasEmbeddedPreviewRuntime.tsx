import React from 'react'
import { cancelWorkspaceSyncTask, scheduleWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'
import { WORKSPACE_SYNC_SCOPE_CANVAS_PREVIEW_WRITEBACK_RUNTIME_PERSISTENCE } from '@/lib/async/workspaceSyncKeys'
import { useGraphStore } from '@/hooks/useGraphStore'
import { dispatchRuntimeFitIntentSoon, dispatchRuntimeZoomActionSoon } from '@/lib/canvas/runtimeZoomDispatch'
import { hashGraphDataForPreviewSync } from '@/hooks/store/graphDataSliceUtils'

export function CanvasEmbeddedPreviewRuntime(props: {
  detectEmbeddedPreviewWriteback: () => boolean
  lastInboundPreviewSelectionKeyRef: React.MutableRefObject<string>
  lastInboundPreviewGraphHashRef: React.MutableRefObject<string>
}) {
  const {
    detectEmbeddedPreviewWriteback,
    lastInboundPreviewSelectionKeyRef,
    lastInboundPreviewGraphHashRef,
  } = props

  React.useEffect(() => {
    const handler = (event: MessageEvent) => {
      try {
        if (event.origin !== window.location.origin) return
        if (!window.parent || window.parent === window) return
        if (event.source && event.source !== window.parent) return
        const data = event.data as unknown
        if (!data || typeof data !== 'object') return
        const msg = data as { kind?: unknown; payload?: unknown }
        if (msg.kind === 'kg-preview-zoom') {
          const payload = msg.payload as { zoomRequest?: unknown }
          const zr = payload && payload.zoomRequest && typeof payload.zoomRequest === 'object'
            ? (payload.zoomRequest as { type?: unknown; intent?: unknown; payload?: unknown })
            : null
          if (!zr) return
          const t = typeof zr.type === 'string' ? zr.type : ''
          if (t === 'in' || t === 'out' || t === 'reset' || t === 'selection') {
            dispatchRuntimeZoomActionSoon(t)
            return
          }
          if (t === 'fit') {
            const intent = zr.intent === 'fitToScreen' ? 'fitToScreen' : 'fitToView'
            dispatchRuntimeFitIntentSoon(intent)
            return
          }
          const store = useGraphStore.getState()
          if (t === 'bounds') {
            const p = (zr as { payload?: unknown }).payload as {
              bounds?: { x?: unknown; y?: unknown; w?: unknown; h?: unknown }
              insetPx?: unknown
              origin?: { x?: unknown; y?: unknown }
            } | null
            if (!p || !p.bounds) return
            store.requestZoomBounds({
              bounds: {
                x: Number(p.bounds.x),
                y: Number(p.bounds.y),
                w: Number(p.bounds.w),
                h: Number(p.bounds.h),
              },
              insetPx: typeof p.insetPx === 'number' ? p.insetPx : undefined,
              origin: p.origin && typeof p.origin === 'object'
                ? { x: Number(p.origin.x), y: Number(p.origin.y) }
                : undefined,
            })
            return
          }
          if (t === 'transform') {
            const p = (zr as { payload?: unknown }).payload as { k?: unknown; x?: unknown; y?: unknown } | null
            if (!p) return
            store.requestZoomTransform({ k: Number(p.k), x: Number(p.x), y: Number(p.y) })
          }
          return
        }
        if (msg.kind !== 'kg-preview-three-camera') return
        const payload = msg.payload as { threeCameraRequest?: unknown }
        const req = payload && payload.threeCameraRequest && typeof payload.threeCameraRequest === 'object'
          ? (payload.threeCameraRequest as { type?: unknown })
          : null
        if (!req) return
        const t = typeof req.type === 'string' ? req.type : ''
        if (t === 'in' || t === 'out' || t === 'fit' || t === 'reset' || t === 'selection') {
          useGraphStore.getState().requestThreeCamera(t)
        }
      } catch {
        void 0
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  React.useEffect(() => {
    if (!detectEmbeddedPreviewWriteback()) return
    const parentWin = window.parent
    if (!parentWin || parentWin === window) return

    const lastSentRef = { hash: '' }
    const taskKey = 'preview:writeback:graph'
    const unsubscribe = useGraphStore.subscribe(
      s => ({ graphData: s.graphData, graphDataRevision: s.graphDataRevision }),
      next => {
        if (!next.graphData) return
        try {
          const nextHash = hashGraphDataForPreviewSync(next.graphData)
          if (nextHash === lastInboundPreviewGraphHashRef.current) return
          if (nextHash === lastSentRef.hash) return
          scheduleWorkspaceSyncTask(taskKey, () => {
            const snapshot = useGraphStore.getState().graphData
            if (!snapshot) return
            const snapshotHash = hashGraphDataForPreviewSync(snapshot)
            if (!snapshotHash) return
            if (snapshotHash === lastInboundPreviewGraphHashRef.current) return
            if (snapshotHash === lastSentRef.hash) return
            lastSentRef.hash = snapshotHash
            parentWin.postMessage({ kind: 'kg-preview-graph', payload: { graphData: snapshot } }, window.location.origin)
          }, 90, { signature: nextHash || null, scopeKey: WORKSPACE_SYNC_SCOPE_CANVAS_PREVIEW_WRITEBACK_RUNTIME_PERSISTENCE })
        } catch {
          void 0
        }
      },
    )
    return () => {
      cancelWorkspaceSyncTask(taskKey)
      try {
        unsubscribe()
      } catch {
        void 0
      }
    }
  }, [detectEmbeddedPreviewWriteback, lastInboundPreviewGraphHashRef])

  React.useEffect(() => {
    const parentWin = window.parent
    if (!parentWin || parentWin === window) return
    const lastRef = { key: '' }
    const taskKey = 'preview:writeback:selection'
    const unsubscribe = useGraphStore.subscribe(
      s => ({
        selectedNodeId: s.selectedNodeId,
        selectedEdgeId: s.selectedEdgeId,
        selectedGroupId: s.selectedGroupId,
        selectionSource: s.selectionSource,
      }),
      next => {
        const nextIdsKey = `${next.selectedNodeId || ''}:${next.selectedEdgeId || ''}:${next.selectedGroupId || ''}`
        if (next.selectionSource === 'editor' && nextIdsKey === lastInboundPreviewSelectionKeyRef.current) return
        const key = `${next.selectionSource || ''}:${next.selectedNodeId || ''}:${next.selectedEdgeId || ''}:${next.selectedGroupId || ''}`
        if (key === lastRef.key) return
        scheduleWorkspaceSyncTask(taskKey, () => {
          const snapshot = useGraphStore.getState()
          const snapshotIdsKey = `${snapshot.selectedNodeId || ''}:${snapshot.selectedEdgeId || ''}:${snapshot.selectedGroupId || ''}`
          if (snapshot.selectionSource === 'editor' && snapshotIdsKey === lastInboundPreviewSelectionKeyRef.current) return
          const snapshotKey = `${snapshot.selectionSource || ''}:${snapshot.selectedNodeId || ''}:${snapshot.selectedEdgeId || ''}:${snapshot.selectedGroupId || ''}`
          if (snapshotKey === lastRef.key) return
          lastRef.key = snapshotKey
          parentWin.postMessage({
            kind: 'kg-preview-selection',
            payload: {
              selectedNodeId: snapshot.selectedNodeId,
              selectedEdgeId: snapshot.selectedEdgeId,
              selectedGroupId: snapshot.selectedGroupId,
            },
          }, window.location.origin)
        }, 70, { signature: key, scopeKey: WORKSPACE_SYNC_SCOPE_CANVAS_PREVIEW_WRITEBACK_RUNTIME_PERSISTENCE })
      },
    )
    return () => {
      cancelWorkspaceSyncTask(taskKey)
      try {
        unsubscribe()
      } catch {
        void 0
      }
    }
  }, [lastInboundPreviewSelectionKeyRef])

  return null
}
