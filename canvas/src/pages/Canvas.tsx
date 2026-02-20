import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useLocation, useNavigate } from 'react-router-dom'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'
import { createTabSync, buildEnvelope } from '@/lib/tabSync'
import type { GraphSchema } from '@/lib/graph/schema'
import usePersistedBoolean from '@/features/hooks/usePersistedBoolean'
import { LS_KEYS, STORAGE_CHANNELS } from '@/lib/config'
import { lsBool, lsInt, lsSetInt } from '@/lib/persistence'
import { hashText } from '@/features/parsers/hash'
import { hashGraphDataForPreviewSync } from '@/hooks/store/graphDataSliceUtils'
import { autoApplyFrontmatterMermaidMarkdownToGraphIfEmpty } from '@/features/parsers/loader'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { onGeospatialModeChanged } from '@/features/geospatial/events'
import ToastHost from '@/components/ui/ToastHost'
import { SourceFilesPersistenceBootstrap } from '@/features/source-files/SourceFilesPersistenceBootstrap'
import { EmbeddedEditorShell } from '@/components/EmbeddedEditorShell'
import { SsotEventBridge } from '@/features/ssot/SsotEventBridge'
import { CanvasViewport } from '@/components/CanvasViewport'
import { normalizeSingleRootRoute } from '@/lib/routing/normalizeSingleRoot'
import { VerticalResizeSeparatorHr } from '@/components/ui/VerticalResizeSeparatorHr'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import { createRafValueScheduler } from '@/lib/react/rafValueScheduler'

const ToolbarLazy = React.lazy(() => import('@/components/Toolbar'))
const GraphTableWorkspaceLazy = React.lazy(() => import('@/features/graph-table/ui/GraphTableWorkspace'))

export default function CanvasPage() {
  const location = useLocation()
  const navigate = useNavigate()

  React.useEffect(() => {
    const normalized = normalizeSingleRootRoute({ pathname: location.pathname, search: location.search, hash: location.hash })
    if (!normalized) return
    navigate({ pathname: normalized.pathname, search: normalized.search, hash: normalized.hash }, { replace: true })
  }, [location.hash, location.pathname, location.search, navigate])
  const openedMainPanelFromQueryRef = React.useRef(false)
  const openedEditorWorkspaceFromQueryRef = React.useRef(false)
  const lastInboundPreviewSelectionKeyRef = React.useRef<string>('')
  const lastInboundPreviewGraphHashRef = React.useRef<string>('')
  const lastInboundPreviewSchemaHashRef = React.useRef<string>('')
  const isEmbeddedPreviewRef = React.useRef<boolean>(false)
  const geospatialHostViewportSnapshotRef = React.useRef<null | {
    zoomState: null | { k: number; x: number; y: number; graphDataRevision?: number; viewportW?: number; viewportH?: number }
    zoomStateByKey: Record<string, { k: number; x: number; y: number; graphDataRevision?: number; viewportW?: number; viewportH?: number }>
    viewPinned: boolean
    fitToScreenMode: boolean
    zoomToSelectionMode: boolean
  }>(null)
  const detectEmbeddedPreview = React.useCallback(() => {
    try {
      const q = new URLSearchParams(String(location.search || '')).get('kgPreview') === '1'
      if (q) return true
      const w = window as unknown as { frameElement?: Element | null; parent?: Window | null }
      const parent = w?.parent
      if (!parent || parent === window) return false
      const frameEl = w?.frameElement
      if (!frameEl) return false
      return String(frameEl.getAttribute('data-kg-preview') || '') === '1'
    } catch {
      return false
    }
  }, [location.search])

  const detectEmbeddedPreviewWriteback = React.useCallback(() => {
    try {
      const w = window as unknown as { frameElement?: Element | null }
      const frameEl = w?.frameElement
      if (!frameEl) return false
      return String(frameEl.getAttribute('data-kg-preview-writeback') || '') === '1'
    } catch {
      return false
    }
  }, [])
  const [isEmbeddedPreview, setIsEmbeddedPreview] = React.useState<boolean>(() => detectEmbeddedPreview())
  React.useEffect(() => {
    setIsEmbeddedPreview(prev => prev || detectEmbeddedPreview())
  }, [detectEmbeddedPreview])
  React.useEffect(() => {
    isEmbeddedPreviewRef.current = isEmbeddedPreview
  }, [isEmbeddedPreview])

  React.useEffect(() => {
    if (openedMainPanelFromQueryRef.current) return
    const raw = String(location.search || '')
    if (!raw) return
    const params = new URLSearchParams(raw)
    const tab = String(params.get('openMainPanel') || '').trim()
    if (!tab) return
    openedMainPanelFromQueryRef.current = true
    try {
      window.dispatchEvent(new CustomEvent(MAIN_PANEL_OPEN_EVENT, { detail: { tab } }))
    } catch {
      void 0
    }
    try {
      params.delete('openMainPanel')
      const next = params.toString()
      const nextUrl = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash || ''}`
      window.history.replaceState(null, '', nextUrl)
    } catch {
      void 0
    }
  }, [location.search])

  React.useEffect(() => {
    if (openedEditorWorkspaceFromQueryRef.current) return
    const raw = String(location.search || '')
    if (!raw) return
    const params = new URLSearchParams(raw)
    const flag = String(params.get('openEditorWorkspace') || '').trim()
    if (!flag) return
    openedEditorWorkspaceFromQueryRef.current = true
    try {
      const store = useGraphStore.getState()
      store.setWorkspaceViewMode('editor')
    } catch {
      void 0
    }
    try {
      params.delete('openEditorWorkspace')
      const next = params.toString()
      const nextUrl = `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash || ''}`
      window.history.replaceState(null, '', nextUrl)
    } catch {
      void 0
    }
  }, [location.search])

  const {
    uiOverlayOpacity,
    uiPanelOpacity,
    uiToolbarOpacity,
    graphId,
    tabId,
    enableTabSync,
    selectedNodeId,
    selectedEdgeId,
    selectNode,
    selectEdge,
    schema,
    setSchema,
    setEnableLaunchSpotlight,
    workspaceViewMode,
    workspaceCanvasPaneOpen,
  } = useGraphStore(
    useShallow(s => ({
      uiOverlayOpacity: s.uiOverlayOpacity,
      uiPanelOpacity: s.uiPanelOpacity,
      uiToolbarOpacity: s.uiToolbarOpacity,
      graphId: s.graphId,
      tabId: s.tabId,
      enableTabSync: s.enableTabSync,
      selectedNodeId: s.selectedNodeId,
      selectedEdgeId: s.selectedEdgeId,
      selectNode: s.selectNode,
      selectEdge: s.selectEdge,
      schema: s.schema as GraphSchema,
      setSchema: s.setSchema,
      setEnableLaunchSpotlight: s.setEnableLaunchSpotlight,
      workspaceViewMode: s.workspaceViewMode,
      workspaceCanvasPaneOpen: s.workspaceCanvasPaneOpen,
    })),
  )

  const setLifecycleStage = useGraphStore(s => s.setLifecycleStage)
  const { markdownDocumentName, markdownDocumentText, frontmatterModeEnabled, documentSemanticMode, graphData } = useGraphStore(
    useShallow(s => ({
      markdownDocumentName: s.markdownDocumentName,
      markdownDocumentText: s.markdownDocumentText,
      frontmatterModeEnabled: s.frontmatterModeEnabled || false,
      documentSemanticMode: (s.documentSemanticMode || 'document') as 'document' | 'keyword',
      graphData: s.graphData,
    })),
  )
  const lastAutoAppliedMarkdownHashRef = React.useRef<string | null>(null)
  const [, setSpotlightDismissed] = usePersistedBoolean(LS_KEYS.launchSpotlightDismissed, false)
  const syncRef = React.useRef<ReturnType<typeof createTabSync> | null>(null)
  const applyingRemoteRef = React.useRef(false)
  const lastSelectionRef = React.useRef<{ n: string | null; e: string | null } | null>(null)
  const lastSchemaHashRef = React.useRef<string | null>(null)
  const lastSchemaRemoteTimestampRef = React.useRef<number>(0)

  const [workspacePreviewWidthPx, setWorkspacePreviewWidthPx] = React.useState(() => {
    const raw = lsInt(LS_KEYS.workspacePreviewWidthPx, 520)
    const next = Math.max(320, Math.min(960, raw))
    if (next !== raw) lsSetInt(LS_KEYS.workspacePreviewWidthPx, next, { min: 320, max: 960 })
    return next
  })
  const workspacePreviewWidthPxRef = React.useRef(workspacePreviewWidthPx)
  workspacePreviewWidthPxRef.current = workspacePreviewWidthPx
  const resizeHandleRef = React.useRef<HTMLHRElement | null>(null)
  const rafSetPreviewWidthRef = React.useRef(createRafValueScheduler<number>(v => setWorkspacePreviewWidthPx(v)))

  React.useEffect(() => {
    return () => {
      rafSetPreviewWidthRef.current.cancel()
    }
  }, [])

  React.useEffect(() => {
    if (!Number.isFinite(workspacePreviewWidthPx) || workspacePreviewWidthPx < 320 || workspacePreviewWidthPx > 960) {
      const next = Math.max(320, Math.min(960, Number.isFinite(workspacePreviewWidthPx) ? workspacePreviewWidthPx : 520))
      setWorkspacePreviewWidthPx(next)
      lsSetInt(LS_KEYS.workspacePreviewWidthPx, next, { min: 320, max: 960 })
    }
  }, [workspacePreviewWidthPx])

  React.useEffect(() => {
    lsSetInt(LS_KEYS.workspacePreviewWidthPx, workspacePreviewWidthPx, { min: 320, max: 960 })
  }, [workspacePreviewWidthPx])

  React.useEffect(() => {
    const el = resizeHandleRef.current
    if (!el) return
    const onDown = (ev: PointerEvent) => {
      if (ev.button !== undefined && ev.button !== 0) return
      const startX = ev.clientX
      const startWidth = workspacePreviewWidthPxRef.current
      let pending = startWidth
      startPointerDrag({
        ev,
        cursor: 'col-resize',
        shouldStart: down => {
          if (down.button !== undefined && down.button !== 0) return false
          return true
        },
        onMove: mv => {
          const dx = startX - mv.clientX
          const next = Math.max(320, Math.min(960, Math.round(startWidth + dx)))
          pending = next
          rafSetPreviewWidthRef.current.schedule(next)
        },
        onEnd: () => {
          rafSetPreviewWidthRef.current.flush()
          setWorkspacePreviewWidthPx(pending)
          lsSetInt(LS_KEYS.workspacePreviewWidthPx, pending, { min: 320, max: 960 })
        },
        onCancel: () => {
          rafSetPreviewWidthRef.current.flush()
          setWorkspacePreviewWidthPx(pending)
          lsSetInt(LS_KEYS.workspacePreviewWidthPx, pending, { min: 320, max: 960 })
        },
      })
    }
    el.addEventListener('pointerdown', onDown)
    return () => el.removeEventListener('pointerdown', onDown)
  }, [])
  

  React.useEffect(() => {
    const root = document.documentElement
    root.style.setProperty('--overlay-opacity', String(uiOverlayOpacity))
    root.style.setProperty('--panel-opacity', String(uiPanelOpacity))
    root.style.setProperty('--toolbar-opacity', String(uiToolbarOpacity))
    root.style.setProperty('--panel-bg', `rgba(var(--panel-bg-rgb), ${uiPanelOpacity})`)
    root.style.setProperty('--toolbar-bg', `rgba(var(--panel-bg-rgb), ${uiToolbarOpacity})`)
  }, [uiOverlayOpacity, uiPanelOpacity, uiToolbarOpacity])

  React.useEffect(() => {
    setLifecycleStage('hydrated')
  }, [setLifecycleStage])

  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      const isCmd = e.metaKey || e.ctrlKey
      if (!isCmd || !e.shiftKey) return
      const k = e.key.toLowerCase()
      if (k === 'g') {
        e.preventDefault()
        try {
          setEnableLaunchSpotlight(true)
          setSpotlightDismissed(false)
        } catch {
          void 0
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setEnableLaunchSpotlight, setSpotlightDismissed])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (ev: StorageEvent) => {
      if (!ev || ev.key !== LS_KEYS.geospatialOverlayEnabled) return
      try {
        setGeospatialModeEnabled(lsBool(LS_KEYS.geospatialOverlayEnabled, false))
      } catch {
        setGeospatialModeEnabled(false)
      }
    }
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener('storage', handler)
    }
  }, [])

  React.useEffect(() => {
    if (!enableTabSync) return
    const sync = createTabSync(STORAGE_CHANNELS.tabSync)
    syncRef.current = sync
    const unsub = sync.subscribe(msg => {
      if (msg.graphId !== graphId || msg.sourceTabId === tabId) return
      applyingRemoteRef.current = true
      try {
        if (msg.kind === 'SelectionChanged') {
          const payload = msg.payload as unknown as { selectedNodeId: string | null; selectedEdgeId: string | null }
          const { selectedNodeId: nid, selectedEdgeId: eid } = payload
          selectNode(nid ?? null)
          selectEdge(eid ?? null)
        }
        if (msg.kind === 'SchemaChanged') {
          const ts = typeof msg.timestamp === 'number' ? msg.timestamp : 0
          if (ts <= lastSchemaRemoteTimestampRef.current) return
          lastSchemaRemoteTimestampRef.current = ts
          const payload = msg.payload as unknown as { schema?: unknown }
          if (!payload || typeof payload !== 'object' || !('schema' in payload)) return
          setSchema(payload.schema as GraphSchema)
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
  }, [enableTabSync, graphId, tabId, selectNode, selectEdge, setSchema])

  React.useEffect(() => {
    if (!enableTabSync || !syncRef.current) return
    if (applyingRemoteRef.current) return
    const payload = { selectedNodeId, selectedEdgeId }
    const last = lastSelectionRef.current
    if (!last || last.n !== selectedNodeId || last.e !== selectedEdgeId) {
      lastSelectionRef.current = { n: selectedNodeId || null, e: selectedEdgeId || null }
      syncRef.current.publish(buildEnvelope('SelectionChanged', graphId, tabId, payload))
    }
  }, [enableTabSync, graphId, tabId, selectedNodeId, selectedEdgeId])

  React.useEffect(() => {
    if (!enableTabSync || !syncRef.current) return
    if (applyingRemoteRef.current) return
    let hash = ''
    try {
      hash = JSON.stringify(schema)
    } catch {
      hash = ''
    }
    const last = lastSchemaHashRef.current
    if (last === hash) return
    lastSchemaHashRef.current = hash
    try {
      syncRef.current.publish(buildEnvelope('SchemaChanged', graphId, tabId, { schema }))
    } catch {
      void 0
    }
  }, [enableTabSync, graphId, tabId, schema])

  const { requestZoom, canvasRenderMode, canvas2dRenderer, requestThreeCamera } = useGraphStore(
    useShallow(s => ({
      requestZoom: s.requestZoom,
      canvasRenderMode: s.canvasRenderMode,
      canvas2dRenderer: s.canvas2dRenderer,
      requestThreeCamera: s.requestThreeCamera,
    })),
  )

  const activeGraphData = useActiveGraphRenderData(!isEmbeddedPreview)
  const gympgrphBridge = useGraphStore(
    useShallow(s => ({
      zoomState: s.zoomState,
      canvasRenderMode: s.canvasRenderMode,
      viewportControlsPreset: s.viewportControlsPreset,
      selectedNodeId: s.selectedNodeId,
      selectedNodeIds: s.selectedNodeIds,
      selectedEdgeId: s.selectedEdgeId,
      selectNode: s.selectNode,
      selectEdge: s.selectEdge,
      setSelectionSource: s.setSelectionSource,
      requestZoom: s.requestZoom,
      requestThreeCamera: s.requestThreeCamera,
      pushUiToast: s.pushUiToast,
      upsertUiToast: s.upsertUiToast,
      dismissUiToast: s.dismissUiToast,
    })),
  )
  const [geospatialModeEnabled, setGeospatialModeEnabled] = React.useState<boolean>(() => {
    try {
      return lsBool(LS_KEYS.geospatialOverlayEnabled, false)
    } catch {
      return false
    }
  })

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return
      }
      const isCmd = e.metaKey || e.ctrlKey
      if (!isCmd) return
      const k = e.key
      const isZoomIn = k === '+' || k === '='
      const isZoomOut = k === '-' || k === '_'
      const isReset = k === '0'
      if (!isZoomIn && !isZoomOut && !isReset) return

      e.preventDefault()
      if (isReset) {
        if (geospatialModeEnabled) {
          requestZoom('reset')
          return
        }
        if (canvasRenderMode === '2d') requestZoom('reset')
        else requestThreeCamera('reset')
        return
      }

      const type = isZoomIn ? 'in' : 'out'
      if (geospatialModeEnabled) {
        requestZoom(type)
        return
      }
      if (canvasRenderMode === '2d') requestZoom(type)
      else requestThreeCamera(type)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [canvasRenderMode, geospatialModeEnabled, requestThreeCamera, requestZoom])

  const [mounted2dRenderers, setMounted2dRenderers] = React.useState<{ d3: boolean; flow: boolean; design: boolean; flowEditor: boolean }>(() => ({
    d3: canvas2dRenderer === 'd3',
    flow: canvas2dRenderer === 'flow',
    design: canvas2dRenderer === 'design',
    flowEditor: canvas2dRenderer === 'flowEditor',
  }))

  React.useEffect(() => {
    if (canvas2dRenderer === 'd3') {
      setMounted2dRenderers(prev => (prev.d3 ? prev : { ...prev, d3: true }))
      return
    }
    if (canvas2dRenderer === 'flow') {
      setMounted2dRenderers(prev => (prev.flow ? prev : { ...prev, flow: true }))
      return
    }
    if (canvas2dRenderer === 'design') {
      setMounted2dRenderers(prev => (prev.design ? prev : { ...prev, design: true }))
      return
    }
    if (canvas2dRenderer === 'flowEditor') {
      setMounted2dRenderers(prev => (prev.flowEditor ? prev : { ...prev, flowEditor: true }))
    }
  }, [canvas2dRenderer])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (geospatialModeEnabled) return
    if (canvasRenderMode !== '2d') return

    const shouldPrefetchD3 = canvas2dRenderer !== 'd3' && !mounted2dRenderers.d3
    const shouldPrefetchFlow = canvas2dRenderer !== 'flow' && !mounted2dRenderers.flow
    const shouldPrefetchDesign = canvas2dRenderer !== 'design' && !mounted2dRenderers.design
    const shouldPrefetchFlowEditor = canvas2dRenderer !== 'flowEditor' && !mounted2dRenderers.flowEditor
    if (!shouldPrefetchD3 && !shouldPrefetchFlow && !shouldPrefetchDesign && !shouldPrefetchFlowEditor) return

    let cancelled = false
    const prefetch = () => {
      if (cancelled) return
      if (shouldPrefetchD3) {
        void import('@/components/GraphCanvas').then(() => {
          if (cancelled) return
          setMounted2dRenderers(prev => (prev.d3 ? prev : { ...prev, d3: true }))
        })
      }
      if (shouldPrefetchFlow) {
        void import('@/components/FlowCanvas')
          .then(() => {
            if (cancelled) return
            setMounted2dRenderers(prev => (prev.flow ? prev : { ...prev, flow: true }))
          })
          .catch(() => {
            void 0
          })
      }
      if (shouldPrefetchDesign) {
        void import('@/components/DesignCanvas')
          .then(() => {
            if (cancelled) return
            setMounted2dRenderers(prev => (prev.design ? prev : { ...prev, design: true }))
          })
          .catch(() => {
            void 0
          })
      }
      if (shouldPrefetchFlowEditor) {
        void import('@/components/FlowEditorCanvas')
          .then(() => {
            if (cancelled) return
            setMounted2dRenderers(prev => (prev.flowEditor ? prev : { ...prev, flowEditor: true }))
          })
          .catch(() => {
            void 0
          })
      }
    }

    const anyWindow = window as unknown as {
      requestIdleCallback?: (cb: () => void, opts?: { timeout?: number }) => number
      cancelIdleCallback?: (id: number) => void
    }

    if (typeof anyWindow.requestIdleCallback === 'function') {
      const id = anyWindow.requestIdleCallback(prefetch, { timeout: 1000 })
      return () => {
        cancelled = true
        try {
          anyWindow.cancelIdleCallback?.(id)
        } catch {
          void 0
        }
      }
    }

    const timeoutId = window.setTimeout(prefetch, 200)
    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
    }
  }, [canvas2dRenderer, canvasRenderMode, geospatialModeEnabled, mounted2dRenderers.d3, mounted2dRenderers.flow, mounted2dRenderers.design, mounted2dRenderers.flowEditor])

  React.useEffect(() => {
    return onGeospatialModeChanged(detail => {
      const enabled = typeof detail.enabled === 'boolean' ? detail.enabled : null
      if (enabled == null) return
      if (enabled) {
        try {
          const s = useGraphStore.getState()
          geospatialHostViewportSnapshotRef.current = {
            zoomState: s.zoomState,
            zoomStateByKey: s.zoomStateByKey,
            viewPinned: s.viewPinned,
            fitToScreenMode: s.fitToScreenMode,
            zoomToSelectionMode: s.zoomToSelectionMode,
          }
        } catch {
          geospatialHostViewportSnapshotRef.current = null
        }
      } else {
        const snap = geospatialHostViewportSnapshotRef.current
        geospatialHostViewportSnapshotRef.current = null
        if (snap) {
          try {
            const s = useGraphStore.getState()
            s.setViewPinned(snap.viewPinned)
            s.setFitToScreenMode(snap.fitToScreenMode)
            s.setZoomToSelectionMode(snap.zoomToSelectionMode)
            if (snap.zoomState) s.setZoomState(snap.zoomState)
            else useGraphStore.setState(() => ({ zoomState: null }))
            useGraphStore.setState(() => ({ zoomStateByKey: snap.zoomStateByKey || {}, zoomRequest: null, threeCameraRequest: null }))
          } catch {
            void 0
          }
        }
      }
      setGeospatialModeEnabled(enabled)
    })
  }, [])

  React.useEffect(() => {
    if (documentSemanticMode !== 'document') return
    if (!frontmatterModeEnabled) return
    if (canvasRenderMode === '2d' && canvas2dRenderer === 'flowEditor') return
    const text = String(markdownDocumentText || '')
    if (!text.trim()) return
    const base = graphData as unknown as { nodes?: unknown[]; edges?: unknown[] } | null
    const n = base && Array.isArray(base.nodes) ? base.nodes.length : 0
    const e = base && Array.isArray(base.edges) ? base.edges.length : 0
    if (n > 0 || e > 0) return
    const h = hashText(text)
    if (lastAutoAppliedMarkdownHashRef.current === h) return
    lastAutoAppliedMarkdownHashRef.current = h
    void autoApplyFrontmatterMermaidMarkdownToGraphIfEmpty({ name: markdownDocumentName, text })
  }, [documentSemanticMode, frontmatterModeEnabled, graphData, markdownDocumentName, markdownDocumentText])

  const makeZoomHandler = (type: 'in' | 'out' | 'fit' | 'reset' | 'selection') => () => {
    if (geospatialModeEnabled) {
      requestZoom(type)
      return
    }
    if (canvasRenderMode === '2d') {
      requestZoom(type)
    } else {
      requestThreeCamera(type)
    }
  }

  const handleZoomIn = makeZoomHandler('in')
  const handleZoomOut = makeZoomHandler('out')
  const handleReset = makeZoomHandler('reset')
  const handleZoomSelection = makeZoomHandler('selection')

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
          const store = useGraphStore.getState()
          const t = typeof zr.type === 'string' ? zr.type : ''
          if (t === 'in' || t === 'out' || t === 'reset' || t === 'selection') {
            store.requestZoom(t)
            return
          }
          if (t === 'fit') {
            const intent = typeof zr.intent === 'string' ? (zr.intent as never) : 'fitToView'
            store.requestZoom('fit', { intent })
            return
          }
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

        if (msg.kind === 'kg-preview-three-camera') {
          const payload = msg.payload as { threeCameraRequest?: unknown }
          const req = payload && payload.threeCameraRequest && typeof payload.threeCameraRequest === 'object'
            ? (payload.threeCameraRequest as { type?: unknown })
            : null
          if (!req) return
          const t = typeof req.type === 'string' ? req.type : ''
          if (t === 'in' || t === 'out' || t === 'fit' || t === 'reset' || t === 'selection') {
            useGraphStore.getState().requestThreeCamera(t)
          }
          return
        }

        if (msg.kind !== 'kg-preview-sync') return
        if (!isEmbeddedPreviewRef.current) {
          isEmbeddedPreviewRef.current = true
          setIsEmbeddedPreview(true)
        }
        const payload = msg.payload as {
          graphData?: unknown
          schema?: unknown
          canvasRenderMode?: unknown
          canvas2dRenderer?: unknown
          selectedNodeId?: unknown
          selectedEdgeId?: unknown
          selectedGroupId?: unknown
        }
        const store = useGraphStore.getState()
        const lockRenderer = store.canvasRenderMode === '2d' && store.canvas2dRenderer === 'flowEditor'
        if (!lockRenderer && payload.canvasRenderMode) {
          try {
            const setCanvasRenderMode = store.setCanvasRenderMode
            if (typeof setCanvasRenderMode === 'function') setCanvasRenderMode(payload.canvasRenderMode as never)
          } catch {
            void 0
          }
        }
        if (!lockRenderer && payload.canvas2dRenderer) {
          try {
            const setCanvas2dRenderer = store.setCanvas2dRenderer
            if (typeof setCanvas2dRenderer === 'function') setCanvas2dRenderer(payload.canvas2dRenderer as never)
          } catch {
            void 0
          }
        }
        if (payload.schema) {
          try {
            const nextSchemaHash = hashText(JSON.stringify(payload.schema))
            const alreadyApplied = nextSchemaHash === lastInboundPreviewSchemaHashRef.current
            if (!alreadyApplied) {
              lastInboundPreviewSchemaHashRef.current = nextSchemaHash
              const currentSchemaHash = hashText(JSON.stringify(store.schema))
              if (nextSchemaHash !== currentSchemaHash) {
                const setSchema = store.setSchema
                if (typeof setSchema === 'function') setSchema(payload.schema as never)
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
            try {
              if (nextGraphHash) lastInboundPreviewGraphHashRef.current = nextGraphHash
            } catch {
              void 0
            }
          } catch {
            void 0
          }
        }

        const hasSelectionPayload =
          Object.prototype.hasOwnProperty.call(payload, 'selectedNodeId') ||
          Object.prototype.hasOwnProperty.call(payload, 'selectedEdgeId') ||
          Object.prototype.hasOwnProperty.call(payload, 'selectedGroupId')

        if (hasSelectionPayload) {
          const selectedNodeId = typeof payload.selectedNodeId === 'string' ? payload.selectedNodeId : ''
          const selectedEdgeId = typeof payload.selectedEdgeId === 'string' ? payload.selectedEdgeId : ''
          const selectedGroupId = typeof payload.selectedGroupId === 'string' ? payload.selectedGroupId : ''
          const nextSelectionKey = `${selectedNodeId}:${selectedEdgeId}:${selectedGroupId}`
          const prevSelectionKey = lastInboundPreviewSelectionKeyRef.current
          lastInboundPreviewSelectionKeyRef.current = nextSelectionKey
          if (nextSelectionKey === prevSelectionKey) return
          try {
            useGraphStore.setState({
              selectionSource: 'editor',
              selectedNodeId: selectedNodeId || null,
              selectedEdgeId: selectedEdgeId || null,
              selectedGroupId: selectedGroupId || null,
              selectedNodeIds: selectedNodeId ? [selectedNodeId] : [],
              selectedEdgeIds: selectedEdgeId ? [selectedEdgeId] : [],
              selectedGroupIds: selectedGroupId ? [selectedGroupId] : [],
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
  }, [])

  React.useEffect(() => {
    if (!isEmbeddedPreview) return
    if (!detectEmbeddedPreviewWriteback()) return
    const parentWin = window.parent
    if (!parentWin || parentWin === window) return

    const lastSentRef = { hash: '' }
    const unsubscribe = useGraphStore.subscribe(
      s => ({ graphData: s.graphData, graphDataRevision: s.graphDataRevision }),
      next => {
        if (!next.graphData) return
        try {
          const nextHash = hashGraphDataForPreviewSync(next.graphData)
          if (nextHash === lastInboundPreviewGraphHashRef.current) return
          if (nextHash === lastSentRef.hash) return
          lastSentRef.hash = nextHash
          parentWin.postMessage(
            {
              kind: 'kg-preview-graph',
              payload: {
                graphData: next.graphData,
              },
            },
            window.location.origin,
          )
        } catch {
          void 0
        }
      },
    )
    return () => {
      try {
        unsubscribe()
      } catch {
        void 0
      }
    }
  }, [detectEmbeddedPreviewWriteback, isEmbeddedPreview])

  React.useEffect(() => {
    if (!isEmbeddedPreview) return
    const parentWin = window.parent
    if (!parentWin || parentWin === window) return
    const lastRef = { key: '' }
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
        lastRef.key = key
        try {
          parentWin.postMessage(
            {
              kind: 'kg-preview-selection',
              payload: {
                selectedNodeId: next.selectedNodeId,
                selectedEdgeId: next.selectedEdgeId,
                selectedGroupId: next.selectedGroupId,
              },
            },
            window.location.origin,
          )
        } catch {
          void 0
        }
      },
    )
    return () => {
      try {
        unsubscribe()
      } catch {
        void 0
      }
    }
  }, [isEmbeddedPreview])

  return (
    <>
      <SourceFilesPersistenceBootstrap />
      <SsotEventBridge />
      <section
        className="flex h-screen w-screen flex-col overflow-hidden bg-[var(--kg-canvas-bg)] transition-colors duration-300"
        aria-label="Knowgrph Canvas"
      >
        {isEmbeddedPreview ? (
          <main className="flex-1 relative overflow-hidden" aria-label="Canvas Preview Only">
            <CanvasViewport
              variant="embeddedPreview"
              geospatialModeEnabled={geospatialModeEnabled}
              activeGraphData={activeGraphData}
              canvasRenderMode={canvasRenderMode}
              canvas2dRenderer={canvas2dRenderer}
              mounted2dRenderers={mounted2dRenderers}
              gympgrphBridge={gympgrphBridge}
            />
          </main>
        ) : (
          <>
            {workspaceViewMode === 'editor' || workspaceViewMode === 'table' ? (
              <header className="shrink-0" aria-label="Workspace Toolbar Header">
                <nav className="relative z-[200] flex items-center justify-center pt-2" aria-label="Canvas Toolbar" role="navigation">
                  <React.Suspense fallback={null}>
                    <ToolbarLazy onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onReset={handleReset} onZoomSelection={handleZoomSelection} />
                  </React.Suspense>
                </nav>
              </header>
            ) : null}

            <ToastHost />

            <main className="flex-1 flex overflow-hidden" aria-label="Canvas Workspace">
              <section className="flex-1 flex flex-col overflow-hidden" aria-label="Workspace stage">
                <section className="flex-1 min-h-0 overflow-hidden flex" aria-label="Workspace split">
                  <section
                    className={`flex-1 min-w-0 min-h-0 overflow-hidden ${workspaceViewMode === 'editor' || workspaceViewMode === 'table' ? 'flex flex-col' : 'hidden'}`}
                    aria-label="Workspace left pane"
                  >
                    {workspaceViewMode === 'editor' ? (
                      <EmbeddedEditorShell />
                    ) : workspaceViewMode === 'table' ? (
                      <React.Suspense fallback={null}>
                        <GraphTableWorkspaceLazy />
                      </React.Suspense>
                    ) : null}
                  </section>

                  {workspaceViewMode === 'editor' || workspaceViewMode === 'table' ? (
                    <VerticalResizeSeparatorHr
                      ref={el => {
                        resizeHandleRef.current = el
                      }}
                      ariaLabel="Resize canvas"
                      className={workspaceCanvasPaneOpen ? '' : 'hidden'}
                    />
                  ) : null}

                  <section
                    className={`min-h-0 overflow-hidden relative bg-[var(--kg-canvas-bg)] ${workspaceViewMode === 'editor' || workspaceViewMode === 'table' ? (workspaceCanvasPaneOpen ? 'shrink-0' : 'hidden') : 'flex-1'}`}
                    style={workspaceViewMode === 'editor' || workspaceViewMode === 'table' ? (workspaceCanvasPaneOpen ? { width: `${workspacePreviewWidthPx}px` } : undefined) : undefined}
                    aria-label="Canvas pane"
                  >
                    {workspaceViewMode !== 'editor' && workspaceViewMode !== 'table' ? (
                      <nav
                        className="absolute top-2 inset-x-0 z-[200] flex items-center justify-center"
                        aria-label="Canvas Toolbar"
                        role="navigation"
                      >
                        <React.Suspense fallback={null}>
                          <ToolbarLazy onZoomIn={handleZoomIn} onZoomOut={handleZoomOut} onReset={handleReset} onZoomSelection={handleZoomSelection} />
                        </React.Suspense>
                      </nav>
                    ) : null}
                    <CanvasViewport
                      variant="workspace"
                      layout={workspaceViewMode === 'editor' || workspaceViewMode === 'table' ? 'pane' : 'full'}
                      geospatialModeEnabled={geospatialModeEnabled}
                      activeGraphData={activeGraphData}
                      canvasRenderMode={canvasRenderMode}
                      canvas2dRenderer={canvas2dRenderer}
                      mounted2dRenderers={mounted2dRenderers}
                      gympgrphBridge={gympgrphBridge}
                    />
                  </section>
                </section>
              </section>
            </main>
          </>
        )}
      </section>
    </>
  )
}
