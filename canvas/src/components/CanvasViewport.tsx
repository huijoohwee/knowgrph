import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Canvas2dRendererId } from '@/lib/config'
import type { GraphData } from '@/lib/graph/types'
import type { ViewportControlsPreset } from '@/lib/config.viewport-controls'
import { importWithRetry } from '@/lib/react/importWithRetry'
import LaunchSpotlight from '@/features/spotlight/LaunchSpotlight'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useForbidBrowserZoomWheel } from '@/lib/ui/forbidBrowserZoom'
import { deriveSceneDisplayGraph } from '@/lib/scene/sceneDerivation'
import { useMediaQuery } from '@/lib/ui/useMediaQuery'

import { isD3Like2dRenderer } from '@/lib/config'

import { InfiniteCanvasWorkspaceOverlay } from '@/features/canvas/InfiniteCanvasWorkspaceOverlay'

type GeospatialOverlayHostProps = {
  active?: boolean
  snapshot?: unknown
  handlers?: unknown
}

const MissingGeospatialOverlayHost = React.memo(function MissingGeospatialOverlayHost(_props: GeospatialOverlayHostProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-700 dark:text-gray-200 bg-white/70 dark:bg-black/40">
      Geospatial overlay unavailable
    </div>
  )
})

const GeospatialOverlayHostLazy = React.lazy(async (): Promise<{ default: React.ComponentType<GeospatialOverlayHostProps> }> => {
  const m = (await import('gympgrph')) as unknown as Record<string, unknown>
  const c = m.GeospatialOverlayHost as unknown
  if (!c) return { default: MissingGeospatialOverlayHost }
  return { default: c as React.ComponentType<GeospatialOverlayHostProps> }
})

const GraphCanvasLazy = React.lazy(() => import('@/components/GraphCanvas'))
const FlowCanvasLazy = React.lazy(() => importWithRetry(() => import('@/components/FlowCanvas'), { retries: 2, retryDelayMs: 50 }))
const DesignCanvasLazy = React.lazy(() => import('@/components/DesignCanvas'))
const FlowEditorCanvasLazy = React.lazy(() => import('@/components/FlowEditorCanvas'))
const ThreeGraphLazy = React.lazy(() => import('@/features/three/ThreeGraph'))
const MinimapLazy = React.lazy(() => import('@/features/minimap/Minimap'))

type MarkdownMetricSample = {
  ts: number
  event: string
  payload: Record<string, unknown>
}

type GympgrphStoreState = {
  setGeospatialAutoFitEnabled?: (enabled: boolean) => void
}

type GympgrphModule = {
  useGympgrphStore?: { getState?: () => GympgrphStoreState }
  requestGeospatialFitToData?: () => void
  requestGeospatialFitToSelection?: () => void
}

function MarkdownMetricsDevOverlay(props: { layout: 'full' | 'pane' }) {
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

  return (
    <aside
      className={`${props.layout === 'pane' ? 'absolute' : 'fixed'} right-3 bottom-3 z-[300] pointer-events-auto`}
      aria-label="Markdown metrics"
    >
      <button
        type="button"
        className="App-toolbar__btn text-xs"
        onClick={() => setOpen(v => !v)}
        aria-label={open ? 'Hide markdown metrics' : 'Show markdown metrics'}
      >
        {open ? 'Hide metrics' : 'Metrics'}
      </button>
      {open ? (
        <section className="mt-2 max-w-[420px] max-h-[300px] overflow-auto rounded border border-[color:var(--kg-border)] bg-[color:var(--kg-panel-bg)] p-2 text-xs">
          {samples.length === 0 ? (
            <p className="text-[color:var(--kg-text-tertiary)]">No samples yet.</p>
          ) : (
            <ul className="space-y-2">
              {samples.map(s => (
                <li key={s.ts}>
                  <div className="font-mono text-[color:var(--kg-text-secondary)]">
                    {new Date(s.ts).toLocaleTimeString()} {s.event}
                  </div>
                  <pre className="mt-1 whitespace-pre-wrap break-words text-[10px] text-[color:var(--kg-text-tertiary)]">{JSON.stringify(s.payload, null, 2)}</pre>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </aside>
  )
}

export type CanvasViewportVariant = 'workspace' | 'embeddedPreview'

export type CanvasViewportProps = {
  variant: CanvasViewportVariant
  layout?: 'full' | 'pane'
  geospatialModeEnabled: boolean
  activeGraphData: GraphData | null
  canvasRenderMode: '2d' | '3d'
  canvas2dRenderer: Canvas2dRendererId
  mounted2dRenderers: { d3: boolean; flow: boolean; design: boolean; flowEditor: boolean }
  gympgrphBridge: {
    zoomState: unknown
    canvasRenderMode: '2d' | '3d'
    viewportControlsPreset: ViewportControlsPreset
    selectedNodeId: string | null
    selectedNodeIds: string[]
    selectedEdgeId: string | null
    selectNode: (id: string | null) => void
    selectEdge: (id: string | null) => void
    setSelectionSource: (source: string) => void
    requestZoom: (type: 'in' | 'out' | 'fit' | 'reset' | 'selection', opts?: { intent?: string }) => void
    requestThreeCamera: (type: 'in' | 'out' | 'fit' | 'reset' | 'selection') => void
    pushUiToast: (t: unknown) => void
    upsertUiToast: (t: unknown) => void
    dismissUiToast: (id: string) => void
  }
}

export function CanvasViewport(props: CanvasViewportProps) {
  const { variant, layout = 'full', geospatialModeEnabled, activeGraphData, canvasRenderMode, canvas2dRenderer, mounted2dRenderers, gympgrphBridge } = props
  const d3SurfaceActive = isD3Like2dRenderer(canvas2dRenderer)
  const safeGraphData = activeGraphData || ({ nodes: [], edges: [] } as GraphData)
  const activeSurface = geospatialModeEnabled ? 'geo' : canvasRenderMode === '3d' ? '3d' : '2d'
  const isNarrowViewport = useMediaQuery('(max-width: 768px)')
  const [geospatialWarmed, setGeospatialWarmed] = React.useState(geospatialModeEnabled)
  const [threeWarmed, setThreeWarmed] = React.useState(!geospatialModeEnabled && canvasRenderMode === '3d')
  React.useEffect(() => {
    if (geospatialModeEnabled) setGeospatialWarmed(true)
  }, [geospatialModeEnabled])
  React.useEffect(() => {
    if (!geospatialModeEnabled && canvasRenderMode === '3d') setThreeWarmed(true)
  }, [canvasRenderMode, geospatialModeEnabled])

  const geoGraphLastRef = React.useRef<GraphData>(safeGraphData)
  const geospatialGraphData = React.useMemo(() => {
    if (activeSurface !== 'geo') return geoGraphLastRef.current
    const derived = deriveSceneDisplayGraph({ graphData: safeGraphData })?.displayGraphData || null
    return (derived || safeGraphData) as GraphData
  }, [activeSurface, safeGraphData])
  React.useEffect(() => {
    if (activeSurface !== 'geo') return
    geoGraphLastRef.current = geospatialGraphData
  }, [activeSurface, geospatialGraphData])
  const rootRef = React.useRef<HTMLElement | null>(null)
  useForbidBrowserZoomWheel(rootRef, true, { stopPropagation: false })
  const { fitToScreenMode, zoomToSelectionMode, viewPinned, selectedNodeId, selectedNodeIds, selectedEdgeId } = useGraphStore(
    useShallow(s => ({
      fitToScreenMode: s.fitToScreenMode === true,
      zoomToSelectionMode: s.zoomToSelectionMode === true,
      viewPinned: s.viewPinned === true,
      selectedNodeId: s.selectedNodeId,
      selectedNodeIds: s.selectedNodeIds,
      selectedEdgeId: s.selectedEdgeId,
    })),
  )

  React.useEffect(() => {
    if (!geospatialModeEnabled) return
    void import('gympgrph')
      .then(m => {
        const gm = m as unknown as Partial<GympgrphModule>
        const st = gm.useGympgrphStore?.getState?.()
        const setAutoFit = st && typeof st.setGeospatialAutoFitEnabled === 'function' ? st.setGeospatialAutoFitEnabled : null
        if (!setAutoFit) return
        setAutoFit(fitToScreenMode && !viewPinned)
      })
      .catch(() => void 0)
  }, [fitToScreenMode, geospatialModeEnabled, viewPinned])

  const lastGeoFitToScreenEnabledRef = React.useRef<boolean>(false)
  React.useEffect(() => {
    if (!geospatialModeEnabled) return
    const prev = lastGeoFitToScreenEnabledRef.current
    lastGeoFitToScreenEnabledRef.current = fitToScreenMode && !viewPinned
    if (prev || !(fitToScreenMode && !viewPinned)) return
    void import('gympgrph')
      .then(m => {
        const gm = m as unknown as Partial<GympgrphModule>
        gm.requestGeospatialFitToData?.()
      })
      .catch(() => void 0)
  }, [fitToScreenMode, geospatialModeEnabled, viewPinned])

  const lastGeoSelectionFitKeyRef = React.useRef<string>('')
  React.useEffect(() => {
    if (!geospatialModeEnabled) return
    if (viewPinned) return
    if (!zoomToSelectionMode) {
      lastGeoSelectionFitKeyRef.current = ''
      return
    }
    const ids = Array.isArray(selectedNodeIds) && selectedNodeIds.length > 0 ? selectedNodeIds : selectedNodeId ? [selectedNodeId] : []
    const key = `${ids.length}:${ids.slice(0, 8).join(',')}:${String(selectedEdgeId || '')}`
    if (!ids.length) return
    if (key === lastGeoSelectionFitKeyRef.current) return
    lastGeoSelectionFitKeyRef.current = key
    void import('gympgrph')
      .then(m => {
        const gm = m as unknown as Partial<GympgrphModule>
        gm.requestGeospatialFitToSelection?.()
      })
      .catch(() => void 0)
  }, [geospatialModeEnabled, selectedEdgeId, selectedNodeId, selectedNodeIds, viewPinned, zoomToSelectionMode])

  return (
    <section ref={rootRef} className="relative w-full h-full overflow-hidden" aria-label={variant === 'embeddedPreview' ? 'Canvas Preview Only' : 'Canvas viewport'}>
      <React.Suspense fallback={null}>
        {!geospatialModeEnabled && canvasRenderMode === '2d' && (
          <div className="absolute inset-0 z-[10]">
            <div className={`absolute inset-0 ${d3SurfaceActive ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={!d3SurfaceActive}>
              {mounted2dRenderers.d3 ? <GraphCanvasLazy active={d3SurfaceActive} /> : null}
            </div>
            <div className={`absolute inset-0 ${canvas2dRenderer === 'flow' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={canvas2dRenderer !== 'flow'}>
              {mounted2dRenderers.flow ? <FlowCanvasLazy active={canvas2dRenderer === 'flow'} /> : null}
            </div>
            <div className={`absolute inset-0 ${canvas2dRenderer === 'design' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={canvas2dRenderer !== 'design'}>
              {mounted2dRenderers.design ? <DesignCanvasLazy active={canvas2dRenderer === 'design'} /> : null}
            </div>
            <div className={`absolute inset-0 ${canvas2dRenderer === 'flowEditor' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={canvas2dRenderer !== 'flowEditor'}>
              {mounted2dRenderers.flowEditor ? <FlowEditorCanvasLazy active={canvas2dRenderer === 'flowEditor'} /> : null}
            </div>
          </div>
        )}

        {!geospatialModeEnabled && canvasRenderMode === '3d' && threeWarmed ? (
          <div className={`absolute inset-0 z-[10] ${activeSurface === '3d' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
            <ThreeGraphLazy active={activeSurface === '3d'} />
          </div>
        ) : null}

        {geospatialWarmed ? (
          <div className={`absolute inset-0 z-[20] ${activeSurface === 'geo' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
            <GeospatialOverlayHostLazy
              active={activeSurface === 'geo'}
              snapshot={{
                graphData: geospatialGraphData,
                zoomState: gympgrphBridge.zoomState,
                canvasRenderMode: gympgrphBridge.canvasRenderMode,
                viewportControlsPreset: gympgrphBridge.viewportControlsPreset,
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
          </div>
        ) : null}

        {variant === 'workspace' ? (
          <>
            {layout === 'full' ? <LaunchSpotlight /> : null}
            {!geospatialModeEnabled && activeSurface === '2d' && !isNarrowViewport && (canvas2dRenderer === 'd3' || canvas2dRenderer === 'flow' || canvas2dRenderer === 'flowEditor' || canvas2dRenderer === 'design') ? (
              <aside
                className={`${layout === 'pane' ? 'absolute' : 'fixed'} left-3 z-[201] pointer-events-auto`}
                style={layout === 'pane' ? undefined : { bottom: 'calc(40px + 12px)' }}
                aria-label="Minimap Overlay"
              >
                <MinimapLazy />
              </aside>
            ) : null}
            <InfiniteCanvasWorkspaceOverlay />
            <MarkdownMetricsDevOverlay layout={layout} />
          </>
        ) : null}
      </React.Suspense>
    </section>
  )
}
