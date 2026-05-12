import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { createTabSync, buildEnvelope } from '@/lib/tabSync'
import { STORAGE_CHANNELS } from '@/lib/config.ls.keys'
import { cancelIdle, scheduleIdle } from '@/features/panels/utils/idle'
import { cancelWorkspaceSyncTask, scheduleWorkspaceSyncTask } from '@/lib/async/workspaceSyncScheduler'
import {
  WORKSPACE_SYNC_SCOPE_CANVAS_PREVIEW_WRITEBACK_RUNTIME_PERSISTENCE,
  WORKSPACE_SYNC_SCOPE_CANVAS_TAB_SYNC_RUNTIME_PERSISTENCE,
} from '@/lib/async/workspaceSyncKeys'
import { useGraphStore } from '@/hooks/useGraphStore'
import { dispatchRuntimeFitIntentSoon, dispatchRuntimeZoomActionSoon } from '@/lib/canvas/runtimeZoomDispatch'
import { isFlowEditorCanvas2dRenderer } from '@/lib/config.render'
import { hashText } from '@/features/parsers/hash'
import { hashGraphDataForPreviewSync } from '@/hooks/store/graphDataSliceUtils'

const schemaPreviewHashCache = new WeakMap<object, string>()

const hashSchemaForPreviewSync = (schema: unknown): string => {
  if (!schema || typeof schema !== 'object') return ''
  const key = schema as object
  const cached = schemaPreviewHashCache.get(key)
  if (cached) return cached
  let hashed = ''
  try {
    hashed = hashText(JSON.stringify(schema))
  } catch {
    hashed = ''
  }
  if (hashed) schemaPreviewHashCache.set(key, hashed)
  return hashed
}

export function CanvasSyncRuntime(props: {
  isEmbeddedPreview: boolean
  setIsEmbeddedPreview: React.Dispatch<React.SetStateAction<boolean>>
  detectEmbeddedPreviewWriteback: () => boolean
}) {
  const { isEmbeddedPreview, setIsEmbeddedPreview, detectEmbeddedPreviewWriteback } = props

  const {
    graphId,
    tabId,
    enableTabSync,
    selectedNodeId,
    selectedEdgeId,
    selectNode,
    selectEdge,
    schema,
    setSchema,
  } = useGraphStore(
    useShallow(s => ({
      graphId: s.graphId,
      tabId: s.tabId,
      enableTabSync: s.enableTabSync,
      selectedNodeId: s.selectedNodeId,
      selectedEdgeId: s.selectedEdgeId,
      selectNode: s.selectNode,
      selectEdge: s.selectEdge,
      schema: s.schema,
      setSchema: s.setSchema,
    })),
  )

  const syncRef = React.useRef<ReturnType<typeof createTabSync> | null>(null)
  const applyingRemoteRef = React.useRef(false)
  const lastSelectionRef = React.useRef<{ n: string | null; e: string | null } | null>(null)
  const lastSelectionRemoteTimestampRef = React.useRef<number>(0)
  const lastSchemaHashRef = React.useRef<string | null>(null)
  const lastSchemaRemoteTimestampRef = React.useRef<number>(0)
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
    if (!deferredSyncReady) return
    if (!enableTabSync) return
    const sync = createTabSync(STORAGE_CHANNELS.tabSync)
    syncRef.current = sync
    const unsub = sync.subscribe(msg => {
      if (msg.graphId !== graphId || msg.sourceTabId === tabId) return
      applyingRemoteRef.current = true
      try {
        if (msg.kind === 'SelectionChanged') {
          const ts = typeof msg.timestamp === 'number' ? msg.timestamp : 0
          if (ts <= lastSelectionRemoteTimestampRef.current) return
          lastSelectionRemoteTimestampRef.current = ts
          const payload = msg.payload as { selectedNodeId: string | null; selectedEdgeId: string | null }
          selectNode(payload.selectedNodeId ?? null)
          selectEdge(payload.selectedEdgeId ?? null)
        }
        if (msg.kind === 'SchemaChanged') {
          const ts = typeof msg.timestamp === 'number' ? msg.timestamp : 0
          if (ts <= lastSchemaRemoteTimestampRef.current) return
          lastSchemaRemoteTimestampRef.current = ts
          const payload = msg.payload as { schema?: unknown }
          if (!payload || typeof payload !== 'object' || !('schema' in payload)) return
          setSchema(payload.schema as never)
        }
      } finally {
        applyingRemoteRef.current = false
      }
    })
    return () => {
      try {
        unsub()
      } finally {
        try {
          sync.destroy()
        } catch {
          void 0
        }
        if (syncRef.current === sync) syncRef.current = null
      }
    }
  }, [deferredSyncReady, enableTabSync, graphId, selectEdge, selectNode, setSchema, tabId])

  React.useEffect(() => {
    if (!deferredSyncReady) return
    if (!enableTabSync || !syncRef.current) return
    if (applyingRemoteRef.current) return
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    if (typeof document !== 'undefined' && typeof document.hasFocus === 'function' && !document.hasFocus()) return
    const taskKey = `tab-sync:selection:${String(graphId || '')}:${String(tabId || '')}`
    const signature = `${selectedNodeId || ''}:${selectedEdgeId || ''}`
    const last = lastSelectionRef.current
    if (!last || last.n !== selectedNodeId || last.e !== selectedEdgeId) {
      lastSelectionRef.current = { n: selectedNodeId || null, e: selectedEdgeId || null }
      scheduleWorkspaceSyncTask(taskKey, () => {
        if (applyingRemoteRef.current || !syncRef.current) return
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
        if (typeof document !== 'undefined' && typeof document.hasFocus === 'function' && !document.hasFocus()) return
        const s = useGraphStore.getState()
        syncRef.current.publish(buildEnvelope('SelectionChanged', graphId, tabId, {
          selectedNodeId: s.selectedNodeId || null,
          selectedEdgeId: s.selectedEdgeId || null,
        }, { sig: signature }))
      }, 32, { signature, scopeKey: WORKSPACE_SYNC_SCOPE_CANVAS_TAB_SYNC_RUNTIME_PERSISTENCE })
    }
    return () => {
      cancelWorkspaceSyncTask(taskKey)
    }
  }, [deferredSyncReady, enableTabSync, graphId, selectedEdgeId, selectedNodeId, tabId])

  React.useEffect(() => {
    if (!deferredSyncReady) return
    if (!enableTabSync || !syncRef.current) return
    if (applyingRemoteRef.current) return
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    if (typeof document !== 'undefined' && typeof document.hasFocus === 'function' && !document.hasFocus()) return
    const taskKey = `tab-sync:schema:${String(graphId || '')}:${String(tabId || '')}`
    const hash = hashSchemaForPreviewSync(schema)
    if (lastSchemaHashRef.current === hash) return
    lastSchemaHashRef.current = hash
    scheduleWorkspaceSyncTask(taskKey, () => {
      if (applyingRemoteRef.current || !syncRef.current) return
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
      if (typeof document !== 'undefined' && typeof document.hasFocus === 'function' && !document.hasFocus()) return
      const s = useGraphStore.getState()
      try {
        syncRef.current.publish(buildEnvelope('SchemaChanged', graphId, tabId, { schema: s.schema }, { sig: hash || null }))
      } catch {
        void 0
      }
    }, 64, { signature: hash || null, scopeKey: WORKSPACE_SYNC_SCOPE_CANVAS_TAB_SYNC_RUNTIME_PERSISTENCE })
    return () => {
      cancelWorkspaceSyncTask(taskKey)
    }
  }, [deferredSyncReady, enableTabSync, graphId, schema, tabId])

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
        const store = useGraphStore.getState()
        const lockRenderer = store.canvasRenderMode === '2d' && isFlowEditorCanvas2dRenderer(store.canvas2dRenderer)
        if (!lockRenderer && payload.canvasRenderMode && payload.canvasRenderMode !== store.canvasRenderMode) {
          try {
            const setCanvasRenderMode = store.setCanvasRenderMode
            if (typeof setCanvasRenderMode === 'function') setCanvasRenderMode(payload.canvasRenderMode as never)
          } catch {
            void 0
          }
        }
        if (!lockRenderer && payload.canvas2dRenderer && payload.canvas2dRenderer !== store.canvas2dRenderer) {
          try {
            const setCanvas2dRenderer = store.setCanvas2dRenderer
            if (typeof setCanvas2dRenderer === 'function') setCanvas2dRenderer(payload.canvas2dRenderer as never)
          } catch {
            void 0
          }
        }
        if (!lockRenderer && payload.canvas3dMode && payload.canvas3dMode !== store.canvas3dMode) {
          try {
            const setCanvas3dMode = store.setCanvas3dMode
            if (typeof setCanvas3dMode === 'function') setCanvas3dMode(payload.canvas3dMode as never)
          } catch {
            void 0
          }
        }
        if (payload.schema) {
          try {
            const nextSchemaHash = hashSchemaForPreviewSync(payload.schema)
            const alreadyApplied = nextSchemaHash === lastInboundPreviewSchemaHashRef.current
            if (!alreadyApplied) {
              lastInboundPreviewSchemaHashRef.current = nextSchemaHash
              const currentSchemaHash = hashSchemaForPreviewSync(store.schema)
              if (nextSchemaHash !== currentSchemaHash) {
                const applySchema = store.setSchema
                if (typeof applySchema === 'function') applySchema(payload.schema as never)
              }
            }
          } catch {
            void 0
          }
        }
        if (payload.graphData) {
          try {
            const setGraphData = store.setGraphData
            const nextGraphHash = hashGraphDataForPreviewSync(payload.graphData)
            if (!nextGraphHash || nextGraphHash !== lastInboundPreviewGraphHashRef.current) {
              if (typeof setGraphData === 'function') setGraphData(payload.graphData as never)
            }
            if (nextGraphHash) lastInboundPreviewGraphHashRef.current = nextGraphHash
          } catch {
            void 0
          }
        }

        const hasSelectionPayload =
          Object.prototype.hasOwnProperty.call(payload, 'selectedNodeId') ||
          Object.prototype.hasOwnProperty.call(payload, 'selectedEdgeId') ||
          Object.prototype.hasOwnProperty.call(payload, 'selectedGroupId')

        if (hasSelectionPayload) {
          const nextSelectedNodeId = typeof payload.selectedNodeId === 'string' ? payload.selectedNodeId : ''
          const nextSelectedEdgeId = typeof payload.selectedEdgeId === 'string' ? payload.selectedEdgeId : ''
          const nextSelectedGroupId = typeof payload.selectedGroupId === 'string' ? payload.selectedGroupId : ''
          const nextSelectionKey = `${nextSelectedNodeId}:${nextSelectedEdgeId}:${nextSelectedGroupId}`
          const prevSelectionKey = lastInboundPreviewSelectionKeyRef.current
          lastInboundPreviewSelectionKeyRef.current = nextSelectionKey
          if (nextSelectionKey === prevSelectionKey) return
          try {
            useGraphStore.setState({
              selectionSource: 'editor',
              selectedNodeId: nextSelectedNodeId || null,
              selectedEdgeId: nextSelectedEdgeId || null,
              selectedGroupId: nextSelectedGroupId || null,
              selectedNodeIds: nextSelectedNodeId ? [nextSelectedNodeId] : [],
              selectedEdgeIds: nextSelectedEdgeId ? [nextSelectedEdgeId] : [],
              selectedGroupIds: nextSelectedGroupId ? [nextSelectedGroupId] : [],
            })
          } catch {
            void 0
          }
        }
      } catch {
        void 0
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [setIsEmbeddedPreview])

  React.useEffect(() => {
    if (!deferredSyncReady) return
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
  }, [deferredSyncReady])

  React.useEffect(() => {
    if (!deferredSyncReady) return
    if (!isEmbeddedPreview) return
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
  }, [deferredSyncReady, detectEmbeddedPreviewWriteback, isEmbeddedPreview])

  React.useEffect(() => {
    if (!deferredSyncReady) return
    if (!isEmbeddedPreview) return
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
  }, [deferredSyncReady, isEmbeddedPreview])

  return null
}
