import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Canvas2dRendererId, Canvas3dModeId } from '@/lib/config.render'
import type { GraphData } from '@/lib/graph/types'
import type { ViewportControlsPreset } from '@/lib/config.viewport-controls'
import { importWithRetry } from '@/lib/react/importWithRetry'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { useForbidBrowserZoomWheel } from '@/lib/ui/forbidBrowserZoom'
import { deriveSceneDisplayGraph } from '@/lib/scene/sceneDerivation'
import { buildGeospatialOverlayGraphData } from '@/features/geospatial/geospatialOverlayGraphData'
import { useMediaQuery } from '@/lib/ui/useMediaQuery'
import { resolveCanvas3dMode } from '@/lib/canvas/canvas3dMode'
import FlowEditorCanvas from '@/components/FlowEditorCanvas'

import { getCanvas2dSurfaceId, supportsCanvas2dMinimap } from '@/lib/config.render'

import { InfiniteCanvasWorkspaceOverlay } from '@/features/canvas/InfiniteCanvasWorkspaceOverlay'
import { PaywallOverlay } from '@/features/payments/PaywallOverlay'

type GeospatialOverlayHostProps = {
  active?: boolean
  snapshot?: unknown
  handlers?: unknown
}

type GeospatialViewportOverlayProps = {
  active: boolean
  geospatialModeEnabled: boolean
  graphData: GraphData
  flowEditorWidgetPanelsActive: boolean
}

const MissingGeospatialOverlayHost = React.memo(function MissingGeospatialOverlayHost(_props: GeospatialOverlayHostProps) {
  return (
    <div className="absolute inset-0 flex items-center justify-center text-xs text-gray-700 dark:text-gray-200 bg-white/70 dark:bg-black/40">
      Geospatial overlay unavailable
    </div>
  )
})

const GeospatialOverlayHostLazy = React.lazy(async (): Promise<{ default: React.ComponentType<GeospatialOverlayHostProps> }> => {
  const m = await loadGympgrphModule()
  const c = m.GeospatialOverlayHost as unknown
  if (!c) return { default: MissingGeospatialOverlayHost }
  return { default: c as React.ComponentType<GeospatialOverlayHostProps> }
})

const GraphCanvasLazy = React.lazy(() => import('@/components/GraphCanvas'))
const FlowCanvasLazy = React.lazy(() => importWithRetry(() => import('@/components/FlowCanvas'), { retries: 2, retryDelayMs: 50 }))
const DesignCanvasLazy = React.lazy(() => import('@/components/DesignCanvas'))
const ThreeGraphLazy = React.lazy(() => import('@/features/three/ThreeGraph'))
const MinimapLazy = React.lazy(() => import('@/features/minimap/Minimap'))
const LaunchSpotlightLazy = React.lazy(() => import('@/features/spotlight/LaunchSpotlight'))

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
  GeospatialOverlayHost?: React.ComponentType<GeospatialOverlayHostProps>
}

let gympgrphModulePromise: Promise<GympgrphModule> | null = null

const loadGympgrphModule = (): Promise<GympgrphModule> => {
  if (!gympgrphModulePromise) {
    gympgrphModulePromise = import('gympgrph')
      .then(mod => mod as unknown as GympgrphModule)
      .catch(err => {
        gympgrphModulePromise = null
        throw err
      })
  }
  return gympgrphModulePromise
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

const CanvasViewportGeospatialOverlay = React.memo(function CanvasViewportGeospatialOverlay(
  props: GeospatialViewportOverlayProps,
) {
  const { active, geospatialModeEnabled, graphData, flowEditorWidgetPanelsActive } = props
  const gympgrphBridge = useGraphStore(
    useShallow(s => ({
      zoomState: s.zoomState,
      canvasRenderMode: s.canvasRenderMode,
      viewportControlsPreset: s.viewportControlsPreset as ViewportControlsPreset,
      selectedNodeId: s.selectedNodeId,
      selectedNodeIds: s.selectedNodeIds,
      selectedEdgeId: s.selectedEdgeId,
      openWidgetNodeIds: s.openWidgetNodeIds || [],
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
  const { fitToScreenMode, zoomToSelectionMode, viewPinned, selectedNodeId, selectedNodeIds, selectedEdgeId, markdownDocumentName, markdownDocumentText, sourceFiles } = useGraphStore(
    useShallow(s => ({
      fitToScreenMode: s.fitToScreenMode === true,
      zoomToSelectionMode: s.zoomToSelectionMode === true,
      viewPinned: s.viewPinned === true,
      selectedNodeId: s.selectedNodeId,
      selectedNodeIds: s.selectedNodeIds,
      selectedEdgeId: s.selectedEdgeId,
      markdownDocumentName: s.markdownDocumentName,
      markdownDocumentText: s.markdownDocumentText,
      sourceFiles: s.sourceFiles,
    })),
  )

  const geoGraphLastRef = React.useRef<GraphData>(graphData)
  const geospatialGraphData = React.useMemo(() => {
    if (!active) return geoGraphLastRef.current
    const derived = deriveSceneDisplayGraph({ graphData })?.displayGraphData || null
    const base = (derived || graphData) as GraphData
    return buildGeospatialOverlayGraphData({
      graphData: base,
      markdownText: markdownDocumentText,
      sourceDocumentPath: markdownDocumentName,
      sourceFiles,
    })
  }, [active, graphData, markdownDocumentName, markdownDocumentText, sourceFiles])

  React.useEffect(() => {
    if (!active) return
    geoGraphLastRef.current = geospatialGraphData
  }, [active, geospatialGraphData])

  const snapshot = React.useMemo(
    () => ({
      graphData: geospatialGraphData,
      zoomState: gympgrphBridge.zoomState,
      canvasRenderMode: gympgrphBridge.canvasRenderMode,
      viewportControlsPreset: gympgrphBridge.viewportControlsPreset,
      selectedNodeId: gympgrphBridge.selectedNodeId,
      selectedNodeIds: gympgrphBridge.selectedNodeIds,
      selectedEdgeId: gympgrphBridge.selectedEdgeId,
      geospatialPanelNodeIds: flowEditorWidgetPanelsActive ? gympgrphBridge.openWidgetNodeIds : [],
    }),
    [
      geospatialGraphData,
      gympgrphBridge.canvasRenderMode,
      gympgrphBridge.openWidgetNodeIds,
      gympgrphBridge.selectedEdgeId,
      gympgrphBridge.selectedNodeId,
      gympgrphBridge.selectedNodeIds,
      flowEditorWidgetPanelsActive,
      gympgrphBridge.viewportControlsPreset,
      gympgrphBridge.zoomState,
    ],
  )

  const handlers = React.useMemo(
    () => ({
      selectNode: gympgrphBridge.selectNode,
      selectEdge: gympgrphBridge.selectEdge,
      setSelectionSource: gympgrphBridge.setSelectionSource,
      requestZoom: gympgrphBridge.requestZoom,
      requestThreeCamera: gympgrphBridge.requestThreeCamera,
      pushUiToast: gympgrphBridge.pushUiToast,
      upsertUiToast: gympgrphBridge.upsertUiToast,
      dismissUiToast: gympgrphBridge.dismissUiToast,
    }),
    [
      gympgrphBridge.dismissUiToast,
      gympgrphBridge.pushUiToast,
      gympgrphBridge.requestThreeCamera,
      gympgrphBridge.requestZoom,
      gympgrphBridge.selectEdge,
      gympgrphBridge.selectNode,
      gympgrphBridge.setSelectionSource,
      gympgrphBridge.upsertUiToast,
    ],
  )

  React.useEffect(() => {
    if (!geospatialModeEnabled) return
    void loadGympgrphModule()
      .then(m => {
        const st = m.useGympgrphStore?.getState?.()
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
    void loadGympgrphModule()
      .then(m => {
        m.requestGeospatialFitToData?.()
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
    void loadGympgrphModule()
      .then(m => {
        m.requestGeospatialFitToSelection?.()
      })
      .catch(() => void 0)
  }, [geospatialModeEnabled, selectedEdgeId, selectedNodeId, selectedNodeIds, viewPinned, zoomToSelectionMode])

  return (
    <div className={`absolute inset-0 z-[20] ${active ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
      <GeospatialOverlayHostLazy
        active={active}
        snapshot={snapshot}
        handlers={handlers}
      />
    </div>
  )
})

export type CanvasViewportVariant = 'workspace' | 'embeddedPreview'

export type CanvasViewportProps = {
  variant: CanvasViewportVariant
  layout?: 'full' | 'pane'
  geospatialModeEnabled: boolean
  canvasRenderMode: '2d' | '3d'
  canvas3dMode: Canvas3dModeId
  canvas2dRenderer: Canvas2dRendererId
  mounted2dRenderers: { d3: boolean; flow: boolean; design: boolean; flowEditor: boolean }
}

export function CanvasViewport(props: CanvasViewportProps) {
  const { variant, layout = 'full', geospatialModeEnabled, canvasRenderMode, canvas3dMode, canvas2dRenderer, mounted2dRenderers } = props
  const activeGraphData = useActiveGraphRenderData(true)
  const active2dSurface = getCanvas2dSurfaceId(canvas2dRenderer)
  const d3SurfaceActive = active2dSurface === 'd3'
  const safeGraphData = activeGraphData || ({ nodes: [], edges: [] } as GraphData)
  const { frontmatterModeEnabled, multiDimTableModeEnabled, documentSemanticMode, schema } = useGraphStore(
    useShallow(s => ({
      frontmatterModeEnabled: s.frontmatterModeEnabled === true,
      multiDimTableModeEnabled: s.multiDimTableModeEnabled === true,
      documentSemanticMode: s.documentSemanticMode,
      schema: s.schema,
    })),
  )
  const effectiveCanvas3dMode = resolveCanvas3dMode({
    requested: canvas3dMode,
    canvas2dRenderer,
    documentSemanticMode,
    frontmatterModeEnabled,
    multiDimTableModeEnabled,
    geospatialEnabled: geospatialModeEnabled,
    schema,
  })
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
  const rootRef = React.useRef<HTMLElement | null>(null)
  useForbidBrowserZoomWheel(rootRef, true, { stopPropagation: false })

  return (
    <section
      ref={rootRef}
      className="relative w-full h-full overflow-hidden"
      style={{ touchAction: 'manipulation', overscrollBehavior: 'none', WebkitTapHighlightColor: 'transparent' }}
      aria-label={variant === 'embeddedPreview' ? 'Canvas Preview Only' : 'Canvas viewport'}
    >
      <React.Suspense fallback={null}>
        {!geospatialModeEnabled && canvasRenderMode === '2d' && (
          <div className="absolute inset-0 z-[10]">
            <div className={`absolute inset-0 ${d3SurfaceActive ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={!d3SurfaceActive}>
              {mounted2dRenderers.d3 ? <GraphCanvasLazy active={d3SurfaceActive} /> : null}
            </div>
            <div className={`absolute inset-0 ${active2dSurface === 'flow' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={active2dSurface !== 'flow'}>
              {mounted2dRenderers.flow ? <FlowCanvasLazy active={active2dSurface === 'flow'} /> : null}
            </div>
            <div className={`absolute inset-0 ${active2dSurface === 'design' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={active2dSurface !== 'design'}>
              {mounted2dRenderers.design ? <DesignCanvasLazy active={active2dSurface === 'design'} /> : null}
            </div>
            <div className={`absolute inset-0 ${active2dSurface === 'flowEditor' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={active2dSurface !== 'flowEditor'}>
              {mounted2dRenderers.flowEditor ? <FlowEditorCanvas active={active2dSurface === 'flowEditor'} /> : null}
            </div>
          </div>
        )}
        {!geospatialModeEnabled && canvasRenderMode === '3d' && threeWarmed ? (
          <div className={`absolute inset-0 z-[10] ${activeSurface === '3d' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
            <ThreeGraphLazy active={activeSurface === '3d'} mode={effectiveCanvas3dMode} />
          </div>
        ) : null}

        {geospatialModeEnabled && active2dSurface === 'flowEditor' ? (
          <div className="absolute inset-0 z-[30] pointer-events-none" aria-hidden="true">
            <FlowEditorCanvas active={false} widgetDropCaptureEnabled geospatialWidgetPanelMode />
          </div>
        ) : null}

        {geospatialWarmed ? (
          <CanvasViewportGeospatialOverlay
            active={activeSurface === 'geo'}
            geospatialModeEnabled={geospatialModeEnabled}
            graphData={safeGraphData}
            flowEditorWidgetPanelsActive={geospatialModeEnabled && active2dSurface === 'flowEditor'}
          />
        ) : null}

        {variant === 'workspace' ? (
          <>
            {layout === 'full' ? (
              <React.Suspense fallback={null}>
                <LaunchSpotlightLazy />
              </React.Suspense>
            ) : null}
            {!geospatialModeEnabled && activeSurface === '2d' && !isNarrowViewport && supportsCanvas2dMinimap(canvas2dRenderer) ? (
              <aside
                className={`${layout === 'pane' ? 'absolute' : 'fixed'} left-3 z-[201] pointer-events-auto`}
                style={layout === 'pane' ? { bottom: 'calc(var(--kg-safe-bottom) + 0.75rem)' } : { bottom: 'calc(40px + 12px)' }}
                aria-label="Minimap Overlay"
              >
                <MinimapLazy />
              </aside>
            ) : null}
            <InfiniteCanvasWorkspaceOverlay />
            <MarkdownMetricsDevOverlay layout={layout} />
            <PaywallOverlay portalTarget={rootRef.current} />
          </>
        ) : null}
      </React.Suspense>
    </section>
  )
}
