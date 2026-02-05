import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useLocation } from 'react-router-dom'
import { createTabSync, buildEnvelope } from '@/lib/tabSync'
import type { GraphSchema } from '@/lib/graph/schema'
import usePersistedBoolean from '@/features/hooks/usePersistedBoolean'
import { LS_KEYS, STORAGE_CHANNELS } from '@/lib/config'
import { lsBool } from '@/lib/persistence'
import { hashText } from '@/features/parsers/hash'
import { autoApplyFrontmatterMermaidMarkdownToGraphIfEmpty } from '@/features/parsers/loader'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import LaunchSpotlight from '@/features/spotlight/LaunchSpotlight'
import { onGeospatialModeChanged } from '@/features/geospatial/events'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import ToastHost from '@/components/ui/ToastHost'
import { SourceFilesPersistenceBootstrap } from '@/features/source-files/SourceFilesPersistenceBootstrap'
import { EmbeddedEditorShell } from '@/components/EmbeddedEditorShell'
import { SsotEventBridge } from '@/features/ssot/SsotEventBridge'

const GeospatialOverlayHostLazy = React.lazy(async () => {
  const m = await import('gympgrph')
  return { default: m.GeospatialOverlayHost }
})

const GeospatialPanelHostLazy = React.lazy(async () => {
  const m = await import('gympgrph')
  return { default: m.GeospatialPanelHost }
})

const GraphCanvasLazy = React.lazy(() => import('@/components/GraphCanvas'))
const FlowCanvasLazy = React.lazy(() => import('@/components/FlowCanvas'))
const FlowEditorCanvasLazy = React.lazy(() => import('@/components/FlowEditorCanvas'))
const ThreeGraphLazy = React.lazy(() => import('@/features/three/ThreeGraph'))
const BottomPanelLazy = React.lazy(() => import('@/components/BottomPanel'))
const ToolbarLazy = React.lazy(() => import('@/components/Toolbar'))
const GraphTableWorkspaceLazy = React.lazy(() => import('@/features/graph-table/ui/GraphTableWorkspace'))
const MinimapLazy = React.lazy(() => import('@/features/minimap/Minimap'))

type MarkdownMetricSample = {
  ts: number
  event: string
  payload: Record<string, unknown>
}

function MarkdownMetricsDevOverlay() {
  const [samples, setSamples] = React.useState<MarkdownMetricSample[]>([])
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const anyImportMeta = import.meta as unknown as { env?: { DEV?: boolean } }
    if (!anyImportMeta.env?.DEV) return
    if (typeof window === 'undefined') return
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<{ event?: string } & Record<string, unknown>>
      const detail = e.detail || {}
      const name = typeof detail.event === 'string' ? detail.event : null
      if (!name) return
      const payloadEntries = Object.entries(detail).filter(([k]) => k !== 'event')
      const payload: Record<string, unknown> = {}
      for (const [k, v] of payloadEntries) {
        payload[k] = v
      }
      const sample: MarkdownMetricSample = {
        ts: Date.now(),
        event: name,
        payload,
      }
      setSamples(prev => {
        const next = [sample, ...prev]
        if (next.length > 50) next.length = 50
        return next
      })
    }
    window.addEventListener('kg:markdownPanelMetric', handler as EventListener)
    return () => {
      window.removeEventListener('kg:markdownPanelMetric', handler as EventListener)
    }
  }, [])

  const anyImportMeta = import.meta as unknown as { env?: { DEV?: boolean } }
  if (!anyImportMeta.env?.DEV) return null

  let slideLabel = 'n/a'
  const latestSlide = samples.find(s => s.event === 'markdownPresentationSlideStateChanged')
  if (latestSlide) {
    const idxRaw = latestSlide.payload.activeIndex
    const countRaw = latestSlide.payload.slideCount
    const idx = typeof idxRaw === 'number' && Number.isFinite(idxRaw) ? idxRaw : null
    const count = typeof countRaw === 'number' && Number.isFinite(countRaw) ? countRaw : null
    if (idx != null && count != null && count > 0) {
      slideLabel = `${idx + 1}/${count}`
    }
  }

  return (
    <div className={`fixed bottom-2 right-2 z-50 text-xs ${UI_THEME_TOKENS.text.primary}`}>
      <button
        type="button"
        className={[
          `px-2 py-1 rounded border ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.panel.bg} shadow-sm`,
          open ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700' : '',
        ].join(' ')}
        onClick={() => setOpen(v => !v)}
      >
        Markdown metrics
      </button>
      {open && (
        <div className={`mt-1 w-80 max-h-64 overflow-auto rounded ${UI_THEME_TOKENS.panel.bg} border ${UI_THEME_TOKENS.input.border} shadow-lg p-2 space-y-1`}>
          <div className="flex items-center justify-between mb-1">
            <div className="font-semibold">Markdown usage</div>
            <div className={`text-[10px] ${UI_THEME_TOKENS.text.tertiary}`}>slides: {slideLabel}</div>
          </div>
          <div className="space-y-1">
            {samples.map(s => (
              <div key={s.ts.toString() + s.event} className="border-b last:border-b-0 border-gray-100 dark:border-gray-800 pb-1">
                <div className="flex items-center justify-between">
                  <div className={`font-semibold text-[11px] ${UI_THEME_TOKENS.text.secondary}`}>{s.event}</div>
                  <div className="text-[10px] text-gray-400">
                    {new Date(s.ts).toLocaleTimeString(undefined, { hour12: false })}
                  </div>
                </div>
                <div className="text-[10px] text-gray-600 break-words">
                  {JSON.stringify(s.payload)}
                </div>
              </div>
            ))}
            {samples.length === 0 && (
              <div className="text-[10px] text-gray-500">No markdown metrics yet.</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function CanvasPage() {
  const location = useLocation()
  const isEmbeddedPreview = React.useMemo(() => {
    try {
      const q = new URLSearchParams(String(location.search || '')).get('kgPreview') === '1'
      if (q) return true
      const w = window as unknown as { frameElement?: Element | null }
      const frameEl = w?.frameElement
      if (!frameEl) return false
      if (frameEl instanceof HTMLIFrameElement) {
        return String(frameEl.getAttribute('data-kg-preview') || '') === '1'
      }
      return String(frameEl.getAttribute('data-kg-preview') || '') === '1'
    } catch {
      return false
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

  const [mounted2dRenderers, setMounted2dRenderers] = React.useState<{ d3: boolean; flow: boolean; flowEditor: boolean }>(() => ({
    d3: canvas2dRenderer === 'd3',
    flow: canvas2dRenderer === 'flow',
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
    const shouldPrefetchFlowEditor = canvas2dRenderer !== 'flowEditor' && !mounted2dRenderers.flowEditor
    if (!shouldPrefetchD3 && !shouldPrefetchFlow && !shouldPrefetchFlowEditor) return

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
        void import('@/components/FlowCanvas').then(() => {
          if (cancelled) return
          setMounted2dRenderers(prev => (prev.flow ? prev : { ...prev, flow: true }))
        })
      }
      if (shouldPrefetchFlowEditor) {
        void import('@/components/FlowEditorCanvas').then(() => {
          if (cancelled) return
          setMounted2dRenderers(prev => (prev.flowEditor ? prev : { ...prev, flowEditor: true }))
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
  }, [canvas2dRenderer, canvasRenderMode, geospatialModeEnabled, mounted2dRenderers.d3, mounted2dRenderers.flow])

  React.useEffect(() => {
    return onGeospatialModeChanged(detail => {
      const enabled = typeof detail.enabled === 'boolean' ? detail.enabled : null
      if (enabled == null) return
      setGeospatialModeEnabled(enabled)
    })
  }, [])

  React.useEffect(() => {
    if (documentSemanticMode !== 'document') return
    if (!frontmatterModeEnabled) return
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

  const previewSrc = React.useMemo(() => {
    return '/'
  }, [])

  React.useEffect(() => {
    if (!isEmbeddedPreview) return
    const handler = (event: MessageEvent) => {
      try {
        if (event.origin !== window.location.origin) return
        const data = event.data as unknown
        if (!data || typeof data !== 'object') return
        const msg = data as { kind?: unknown; payload?: unknown }
        if (msg.kind !== 'kg-preview-sync') return
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
        if (payload.schema) {
          try {
            const setSchema = store.setSchema
            if (typeof setSchema === 'function') setSchema(payload.schema as never)
          } catch {
            void 0
          }
        }
        if (payload.canvasRenderMode) {
          try {
            const setCanvasRenderMode = store.setCanvasRenderMode
            if (typeof setCanvasRenderMode === 'function') setCanvasRenderMode(payload.canvasRenderMode as never)
          } catch {
            void 0
          }
        }
        if (payload.canvas2dRenderer) {
          try {
            const setCanvas2dRenderer = store.setCanvas2dRenderer
            if (typeof setCanvas2dRenderer === 'function') setCanvas2dRenderer(payload.canvas2dRenderer as never)
          } catch {
            void 0
          }
        }
        if (payload.graphData) {
          try {
            const setGraphData = store.setGraphData
            if (typeof setGraphData === 'function') setGraphData(payload.graphData as never)
          } catch {
            void 0
          }
        }

        const selectedNodeId = typeof payload.selectedNodeId === 'string' ? payload.selectedNodeId : ''
        const selectedEdgeId = typeof payload.selectedEdgeId === 'string' ? payload.selectedEdgeId : ''
        const selectedGroupId = typeof payload.selectedGroupId === 'string' ? payload.selectedGroupId : ''
        if (selectedNodeId || selectedEdgeId || selectedGroupId) {
          try {
            store.setSelectionSource('editor')
          } catch {
            void 0
          }
          try {
            if (selectedNodeId) store.selectNode(selectedNodeId)
            else if (selectedEdgeId) store.selectEdge(selectedEdgeId)
            else if (selectedGroupId) store.selectGroup(selectedGroupId)
          } catch {
            void 0
          }
          try {
            store.requestZoom('selection')
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
  }, [isEmbeddedPreview])

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
        if (next.selectionSource === 'editor') return
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
            <React.Suspense fallback={null}>
              {geospatialModeEnabled && (
                <GeospatialOverlayHostLazy
                  active
                  snapshot={{
                    graphData: activeGraphData,
                    zoomState: gympgrphBridge.zoomState,
                    canvasRenderMode: gympgrphBridge.canvasRenderMode,
                    selectedNodeId: gympgrphBridge.selectedNodeId,
                    selectedNodeIds: gympgrphBridge.selectedNodeIds,
                    selectedEdgeId: gympgrphBridge.selectedEdgeId,
                  }}
                  handlers={{
                    selectNode: gympgrphBridge.selectNode,
                    selectEdge: gympgrphBridge.selectEdge,
                    setSelectionSource: gympgrphBridge.setSelectionSource,
                    requestZoom: gympgrphBridge.requestZoom,
                    requestThreeCamera: gympgrphBridge.requestThreeCamera,
                    pushUiToast: gympgrphBridge.pushUiToast,
                    upsertUiToast: gympgrphBridge.upsertUiToast,
                    dismissUiToast: gympgrphBridge.dismissUiToast,
                  }}
                />
              )}
              {!geospatialModeEnabled && canvasRenderMode === '2d' && (
                <>
                  <div className={`absolute inset-0 z-[10] ${canvas2dRenderer === 'd3' ? '' : 'opacity-0 pointer-events-none'}`}>
                    {mounted2dRenderers.d3 ? <GraphCanvasLazy active={canvas2dRenderer === 'd3'} /> : null}
                  </div>
                  <div className={`absolute inset-0 z-[10] ${canvas2dRenderer === 'flow' ? '' : 'opacity-0 pointer-events-none'}`}>
                    {mounted2dRenderers.flow ? <FlowCanvasLazy active={canvas2dRenderer === 'flow'} /> : null}
                  </div>
                  <div className={`absolute inset-0 z-[10] ${canvas2dRenderer === 'flowEditor' ? '' : 'opacity-0 pointer-events-none'}`}>
                    {mounted2dRenderers.flowEditor ? <FlowEditorCanvasLazy active={canvas2dRenderer === 'flowEditor'} /> : null}
                  </div>
                </>
              )}
              {!geospatialModeEnabled && canvasRenderMode === '3d' && (
                <div className="absolute inset-0 z-[10]">
                  <ThreeGraphLazy active />
                </div>
              )}
            </React.Suspense>
          </main>
        ) : workspaceViewMode === 'editor' ? (
          <>
            <header className="shrink-0" aria-label="Editor Toolbar Header">
              <nav className="relative z-[200] flex items-center justify-center pt-2" aria-label="Canvas Toolbar" role="navigation">
                <React.Suspense fallback={null}>
                  <ToolbarLazy
                    onZoomIn={handleZoomIn}
                    onZoomOut={handleZoomOut}
                    onReset={handleReset}
                    onZoomSelection={handleZoomSelection}
                  />
                </React.Suspense>
              </nav>
            </header>
            <ToastHost />
            <EmbeddedEditorShell previewSrc={previewSrc} />
          </>
        ) : workspaceViewMode === 'table' ? (
          <>
            <header className="shrink-0" aria-label="Table Toolbar Header">
              <nav
                className="relative z-[200] flex items-center justify-center pt-2"
                aria-label="Canvas Toolbar"
                role="navigation"
              >
                <React.Suspense fallback={null}>
                  <ToolbarLazy
                    onZoomIn={handleZoomIn}
                    onZoomOut={handleZoomOut}
                    onReset={handleReset}
                    onZoomSelection={handleZoomSelection}
                  />
                </React.Suspense>
              </nav>
            </header>
            <ToastHost />
            <React.Suspense fallback={null}>
              <GraphTableWorkspaceLazy />
            </React.Suspense>
          </>
        ) : (
          <main className="flex-1 flex overflow-hidden" aria-label="Canvas Workspace">
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 relative overflow-hidden">
                <>
                  <nav
                    className="absolute top-2 inset-x-0 z-[200] flex items-center justify-center"
                    aria-label="Canvas Toolbar"
                    role="navigation"
                  >
                    <React.Suspense fallback={null}>
                      <ToolbarLazy
                        onZoomIn={handleZoomIn}
                        onZoomOut={handleZoomOut}
                        onReset={handleReset}
                        onZoomSelection={handleZoomSelection}
                      />
                    </React.Suspense>
                  </nav>
                  <ToastHost />
                  <>
                    <React.Suspense fallback={null}>
                      {geospatialModeEnabled && (
                        <GeospatialOverlayHostLazy
                          active
                          snapshot={{
                            graphData: activeGraphData,
                            zoomState: gympgrphBridge.zoomState,
                            canvasRenderMode: gympgrphBridge.canvasRenderMode,
                            selectedNodeId: gympgrphBridge.selectedNodeId,
                            selectedNodeIds: gympgrphBridge.selectedNodeIds,
                            selectedEdgeId: gympgrphBridge.selectedEdgeId,
                          }}
                          handlers={{
                            selectNode: gympgrphBridge.selectNode,
                            selectEdge: gympgrphBridge.selectEdge,
                            setSelectionSource: gympgrphBridge.setSelectionSource,
                            requestZoom: gympgrphBridge.requestZoom,
                            requestThreeCamera: gympgrphBridge.requestThreeCamera,
                            pushUiToast: gympgrphBridge.pushUiToast,
                            upsertUiToast: gympgrphBridge.upsertUiToast,
                            dismissUiToast: gympgrphBridge.dismissUiToast,
                          }}
                        />
                      )}
                      {!geospatialModeEnabled && canvasRenderMode === '2d' && (
                        <>
                          <div className={`absolute inset-0 z-[10] ${canvas2dRenderer === 'd3' ? '' : 'opacity-0 pointer-events-none'}`}>
                            {mounted2dRenderers.d3 ? <GraphCanvasLazy active={canvas2dRenderer === 'd3'} /> : null}
                          </div>
                          <div className={`absolute inset-0 z-[10] ${canvas2dRenderer === 'flow' ? '' : 'opacity-0 pointer-events-none'}`}>
                            {mounted2dRenderers.flow ? <FlowCanvasLazy active={canvas2dRenderer === 'flow'} /> : null}
                          </div>
                          <div className={`absolute inset-0 z-[10] ${canvas2dRenderer === 'flowEditor' ? '' : 'opacity-0 pointer-events-none'}`}>
                            {mounted2dRenderers.flowEditor ? <FlowEditorCanvasLazy active={canvas2dRenderer === 'flowEditor'} /> : null}
                          </div>
                        </>
                      )}
                      {!geospatialModeEnabled && canvasRenderMode === '3d' && (
                        <div className="absolute inset-0 z-[10]">
                          <ThreeGraphLazy active />
                        </div>
                      )}
                      <LaunchSpotlight />
                      {!geospatialModeEnabled && canvasRenderMode === '2d' && canvas2dRenderer === 'd3' && (
                        <aside
                          className="fixed left-3 z-[201] pointer-events-auto"
                          style={{ bottom: 'calc(40px + 12px)' }}
                          aria-label="Minimap Overlay"
                        >
                          <MinimapLazy />
                        </aside>
                      )}
                      <BottomPanelLazy />
                      <MarkdownMetricsDevOverlay />
                    </React.Suspense>
                  </>
                </>
              </div>
            </div>
          </main>
        )}
      </section>
    </>
  )
}
