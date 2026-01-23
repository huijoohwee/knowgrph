import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { createTabSync, buildEnvelope } from '@/lib/tabSync'
import { useParserUIState } from '@/features/parsers/uiState'
import { clearCustomParsers } from '@/features/parsers/persistence'
import type { GraphSchema } from '@/lib/graph/schema'
import usePersistedBoolean from '@/features/hooks/usePersistedBoolean'
import { LS_KEYS, STORAGE_CHANNELS, UI_LAYOUT } from '@/lib/config'
import LaunchSpotlight from '@/features/spotlight/LaunchSpotlight'
import TabHeader from '@/features/panels/ui/TabHeader'
import { SIDE_PANEL_OPEN_EVENT } from '@/features/canvas/utils'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { FileCode, MessageCircle, Map as MapIcon } from 'lucide-react'

const GraphCanvasLazy = React.lazy(() => import('@/components/GraphCanvas'))
const ThreeGraphLazy = React.lazy(() => import('@/features/three/ThreeGraph'))
const BottomPanelLazy = React.lazy(() => import('@/components/BottomPanel'))
const ToolbarLazy = React.lazy(() => import('@/components/Toolbar'))
const NodeEditorLazy = React.lazy(() => import('@/components/NodeEditor'))
const MinimapLazy = React.lazy(() => import('@/features/minimap/Minimap'))
const SidebarTriggerLazy = React.lazy(() => import('@/components/SidebarTrigger'))
const SidePanelChatLazy = React.lazy(() => import('@/features/chat/SidePanelChat'))
const GeospatialPanelLazy = React.lazy(() => import('@/features/geospatial/GeospatialPanel'))

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
  const {
    isSidebarOpen,
    setSidebarOpen,
    sidebarWidthRatio,
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
  } = useGraphStore(
    useShallow(s => ({
      isSidebarOpen: s.isSidebarOpen,
      setSidebarOpen: s.setSidebarOpen,
      sidebarWidthRatio: s.sidebarWidthRatio,
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
    })),
  )
  const setLifecycleStage = useGraphStore(s => s.setLifecycleStage)
  const [, setSpotlightDismissed] = usePersistedBoolean(LS_KEYS.launchSpotlightDismissed, false)
  const asideRef = React.useRef<HTMLDivElement | null>(null)
  const sidebarToggleRef = React.useRef<HTMLButtonElement | null>(null)
  const syncRef = React.useRef<ReturnType<typeof createTabSync> | null>(null)
  const applyingRemoteRef = React.useRef(false)
  const lastSelectionRef = React.useRef<{ n: string | null; e: string | null } | null>(null)
  const lastSchemaHashRef = React.useRef<string | null>(null)
  const lastSchemaRemoteTimestampRef = React.useRef<number>(0)
  const [sidebarTopOffsetPx, setSidebarTopOffsetPx] = React.useState(0)

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
    let timer: ReturnType<typeof setTimeout> | null = null
    const measure = () => {
      if (timer) return
      timer = setTimeout(() => {
        const toolbar = typeof document === 'undefined' ? null : document.querySelector('.App-toolbar')
        const toolbarOffsetPx = UI_LAYOUT.toolbarOffsetPx
        const toolbarBottomPx = toolbar instanceof HTMLElement ? toolbar.getBoundingClientRect().bottom : toolbarOffsetPx
        const topOffset = toolbarBottomPx + toolbarOffsetPx
        setSidebarTopOffsetPx(topOffset)
        timer = null
      }, 100)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('resize', measure)
      if (timer) clearTimeout(timer)
    }
  }, [])

  React.useEffect(() => {
    try {
      useGraphStore.getState().clearGraphData?.()
    } catch {
      void 0
    }
    try {
      useParserUIState.getState().reset?.()
    } catch {
      void 0
    }
    try {
      clearCustomParsers()
    } catch {
      void 0
    }
  }, [])

  void setSidebarOpen

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

  const { requestZoom, canvasRenderMode, requestThreeCamera } = useGraphStore(
    useShallow(s => ({
      requestZoom: s.requestZoom,
      canvasRenderMode: s.canvasRenderMode,
      requestThreeCamera: s.requestThreeCamera,
    })),
  )
  const [sidePanelTab, setSidePanelTab] = React.useState<'node' | 'chat' | 'map'>('node')
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<{ tab?: 'node' | 'chat' | 'map'; open?: boolean } | undefined>
      const detail = e.detail
      const tab = detail?.tab === 'chat' ? 'chat' : detail?.tab === 'map' ? 'map' : detail?.tab === 'node' ? 'node' : null
      if (tab) setSidePanelTab(tab)
      if (detail?.open) setSidebarOpen(true)
    }
    window.addEventListener(SIDE_PANEL_OPEN_EVENT, handler as EventListener)
    return () => {
      window.removeEventListener(SIDE_PANEL_OPEN_EVENT, handler as EventListener)
    }
  }, [setSidebarOpen])
  const makeZoomHandler = (type: 'in' | 'out' | 'fit' | 'reset' | 'selection') => () => {
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

  return (
    <>
      <style>{`
        :root { --panel-bg-rgb: 255, 255, 255; }
        .dark { --panel-bg-rgb: 13, 17, 23; }
      `}</style>
      <div className="flex h-screen w-screen flex-col overflow-hidden bg-white dark:bg-[#0d1117] transition-colors duration-300">
      <main className="flex-1 flex overflow-hidden">
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
                  <SidebarTriggerLazy ref={sidebarToggleRef} className="absolute right-3" />
                </React.Suspense>
              </nav>
              <>
                <React.Suspense fallback={null}>
                  <div
                    className={`absolute inset-0 ${canvasRenderMode === '2d' ? 'visible' : 'invisible pointer-events-none'}`}
                    aria-hidden={canvasRenderMode !== '2d'}
                  >
                    <GraphCanvasLazy active={canvasRenderMode === '2d'} />
                  </div>
                  <div
                    className={`absolute inset-0 ${canvasRenderMode === '3d' ? 'visible' : 'invisible pointer-events-none'}`}
                    aria-hidden={canvasRenderMode !== '3d'}
                  >
                    <ThreeGraphLazy active={canvasRenderMode === '3d'} />
                  </div>
                  <LaunchSpotlight />
                  <section
        className="fixed left-3 z-[201] pointer-events-auto"
        style={{ bottom: 'calc(40px + 12px)' }}
        aria-label="Minimap Overlay"
      >
        <MinimapLazy />
      </section>
                  <BottomPanelLazy />
                  <MarkdownMetricsDevOverlay />
                </React.Suspense>
                <aside
                  className={`absolute right-0 z-30 transition-all duration-200 flex flex-col ${
                    isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                  style={{
                    width: isSidebarOpen ? `${Math.round(((sidebarWidthRatio || 0.25) * 100))}vw` : 0,
                    top: `${Math.max(0, Math.round(sidebarTopOffsetPx))}px`,
                    bottom: 'var(--bottom-panel-height-px, 40px)',
                  }}
                  aria-hidden={!isSidebarOpen}
                  ref={asideRef}
                >
                  <div className="ModalContainer h-full flex flex-col rounded-none shadow-none p-0 border-l border-gray-200 border-t-0 border-b-0 border-r-0">
                    <TabHeader
                      collapsed={false}
                      tabs={[
                        { key: 'node', label: 'Node' },
                        { key: 'chat', label: 'Chat' },
                        { key: 'map', label: 'Map' },
                      ]}
                      tabVariant="icon"
                      tabIconByKey={{
                        node: FileCode,
                        chat: MessageCircle,
                        map: MapIcon,
                      }}
                      activeTab={sidePanelTab}
                      onTabChange={key => {
                        setSidePanelTab(key === 'chat' ? 'chat' : key === 'map' ? 'map' : 'node')
                      }}
                    />
                    <div className="flex-1 overflow-y-auto">
                      <React.Suspense fallback={null}>
                        <div className={sidePanelTab === 'chat' ? 'h-full' : 'hidden'}>
                          <SidePanelChatLazy />
                        </div>
                        <div className={sidePanelTab === 'map' ? 'h-full' : 'hidden'}>
                          <GeospatialPanelLazy />
                        </div>
                        <div className={sidePanelTab === 'node' ? 'h-full' : 'hidden'}>
                          <NodeEditorLazy />
                        </div>
                      </React.Suspense>
                    </div>
                  </div>
                </aside>
              </>
            </>
          </div>
        </div>
      </main>
      </div>
    </>
  )
}
