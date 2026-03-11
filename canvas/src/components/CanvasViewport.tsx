import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Canvas2dRendererId } from '@/lib/config'
import type { GraphData } from '@/lib/graph/types'
import type { ViewportControlsPreset } from '@/lib/config.viewport-controls'
import { importWithRetry } from '@/lib/react/importWithRetry'
import LaunchSpotlight from '@/features/spotlight/LaunchSpotlight'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useForbidBrowserZoomWheel } from '@/lib/ui/forbidBrowserZoom'

import { InfiniteCanvasWorkspaceOverlay } from '@/features/canvas/InfiniteCanvasWorkspaceOverlay'

const GeospatialOverlayHostLazy = React.lazy(async () => {
  const m = await import('gympgrph')
  return { default: m.GeospatialOverlayHost }
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
  const safeGraphData = activeGraphData || ({ nodes: [], edges: [] } as GraphData)
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
        {geospatialModeEnabled && (
          <GeospatialOverlayHostLazy
            active
            snapshot={{
              graphData: safeGraphData,
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
        )}

        {!geospatialModeEnabled && canvasRenderMode === '2d' && (
          <div className="absolute inset-0 z-[10]">
            {canvas2dRenderer === 'd3' && mounted2dRenderers.d3 ? <GraphCanvasLazy active /> : null}
            {canvas2dRenderer === 'flow' && mounted2dRenderers.flow ? <FlowCanvasLazy active /> : null}
            {canvas2dRenderer === 'design' && mounted2dRenderers.design ? <DesignCanvasLazy active /> : null}
            {canvas2dRenderer === 'flowEditor' && mounted2dRenderers.flowEditor ? <FlowEditorCanvasLazy active /> : null}
          </div>
        )}

        {!geospatialModeEnabled && canvasRenderMode === '3d' && (
          <div className="absolute inset-0 z-[10]">
            <ThreeGraphLazy active />
          </div>
        )}

        {variant === 'workspace' ? (
          <>
            {layout === 'full' ? <LaunchSpotlight /> : null}
            {!geospatialModeEnabled && canvasRenderMode === '2d' && (canvas2dRenderer === 'd3' || canvas2dRenderer === 'flow' || canvas2dRenderer === 'flowEditor' || canvas2dRenderer === 'design') ? (
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
