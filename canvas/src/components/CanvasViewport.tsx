import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import type { Canvas2dRendererId, Canvas3dModeId } from '@/lib/config.render'
import type { GraphData } from '@/lib/graph/types'
import { importWithRetry } from '@/lib/react/importWithRetry'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { useMarkdownExplorerStore } from '@/features/markdown-explorer/store'
import { useForbidBrowserZoomWheel } from '@/lib/ui/forbidBrowserZoom'
import { useMediaQuery } from '@/lib/ui/useMediaQuery'
import { UI_RESPONSIVE_CANVAS_MINIMAP_OVERLAY_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import { resolveCanvas3dMode } from '@/lib/canvas/canvas3dMode'

import { getCanvas2dSurfaceId, isStoryboardCanvas2dRenderer, supportsCanvas2dMinimap } from '@/lib/config.render'
import { shouldRenderTimelineSurface } from '@/lib/timeline/timelineVisibility'
import { resolvePreferredEnabledComposedSourceFile } from '@/features/source-files/composedSourceSelection'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'
import { isStrybldrStoryboardGraphData } from '@/features/strybldr/strybldrStoryboard'
import { useKnowgrphLiveCanvasHero } from '@/features/canvas/useKnowgrphLiveCanvasHero'
import { useSourceFilesBootstrapReady } from '@/features/source-files/sourceFilesBootstrapReadiness'
const CanvasViewportGeospatialOverlayLazy = React.lazy(() =>
  import('@/components/CanvasViewportGeospatialOverlay').then(mod => ({ default: mod.CanvasViewportGeospatialOverlay })),
)
const LiveCanvasHeroLazy = React.lazy(() =>
  import('@/components/LiveCanvasHero').then(mod => ({ default: mod.LiveCanvasHero })),
)

const SharedGraphCanvasLazy = React.lazy(() => import('@/components/GraphCanvas'))
const DashboardCanvasLazy = React.lazy(() => importWithRetry(() => import('@/components/DashboardCanvas'), { retries: 2, retryDelayMs: 50 }))
const GalleryCanvasLazy = React.lazy(() => importWithRetry(() => import('@/components/GalleryCanvas'), { retries: 2, retryDelayMs: 50 }))
const MediaCanvasLazy = React.lazy(() => importWithRetry(() => import('@/components/MediaCanvas'), { retries: 2, retryDelayMs: 50 }))
const MultiDimTableSurfaceLazy = React.lazy(() =>
  importWithRetry(() => import('@/features/markdown-workspace/main/viewer/MultiDimTableSurface'), { retries: 2, retryDelayMs: 50 })
    .then(mod => ({ default: mod.MultiDimTableSurface })),
)
const CanvasWorkspaceDataViewFloatingRegistrationBridgeLazy = React.lazy(() =>
  importWithRetry(() => import('@/features/markdown-workspace/main/viewer/CanvasWorkspaceDataViewFloatingRegistrationBridge'), { retries: 2, retryDelayMs: 50 })
    .then(mod => ({ default: mod.CanvasWorkspaceDataViewFloatingRegistrationBridge })),
)
const MermaidGitGraphCanvasLazy = React.lazy(() => import('@/components/MermaidGitGraphCanvas'))
const MermaidGanttCanvasLazy = React.lazy(() => import('@/components/MermaidGanttCanvas'))
const FlowCanvasLazy = React.lazy(() => importWithRetry(() => import('@/components/FlowCanvas'), { retries: 2, retryDelayMs: 50 }))
const AnimaticCanvasLazy = React.lazy(() => importWithRetry(() => import('@/components/AnimaticCanvas'), { retries: 2, retryDelayMs: 50 }))
const StoryboardWidgetCanvasLazy = React.lazy(() => importWithRetry(() => import('@/components/StoryboardWidgetCanvas'), { retries: 2, retryDelayMs: 50 }))
const StoryboardWidgetDropBridgeLazy = React.lazy(() => importWithRetry(() => import('@/components/StoryboardWidgetDropBridge'), { retries: 2, retryDelayMs: 50 }))
const MarkdownMetricsDevOverlayLazy = React.lazy(() =>
  import('@/components/CanvasViewportMarkdownMetricsDevOverlay').then(mod => ({ default: mod.CanvasViewportMarkdownMetricsDevOverlay })),
)
const DesignCanvasLazy = React.lazy(() => import('@/components/DesignCanvas'))
const ThreeGraphLazy = React.lazy(() => import('@/features/three/ThreeGraph'))
const MinimapLazy = React.lazy(() => import('@/features/minimap/Minimap'))
const StrybldrTimelineBottomPanelLazy = React.lazy(() =>
  import('@/features/strybldr/StrybldrTimelineBottomPanel').then(mod => ({ default: mod.StrybldrTimelineBottomPanel })),
)
const LaunchSpotlightLazy = React.lazy(() => import('@/features/spotlight/LaunchSpotlight'))
const PaywallOverlayLazy = React.lazy(async (): Promise<{ default: React.ComponentType<{ portalTarget: HTMLElement | null }> }> => ({
  default: (await import('@/features/payments/PaywallOverlay')).PaywallOverlay,
}))
const MARKDOWN_METRICS_DEV_ENABLED = Boolean((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV)

export type CanvasViewportVariant = 'workspace' | 'embeddedPreview'

export type CanvasViewportProps = {
  variant: CanvasViewportVariant
  layout?: 'full' | 'pane'
  geospatialModeEnabled: boolean
  workspaceEditorOverlayOpen?: boolean
  canvasRenderMode: '2d' | '3d'
  canvas3dMode: Canvas3dModeId
  canvas2dRenderer: Canvas2dRendererId
  documentSwitchPending?: boolean
  documentSwitchPendingLabel?: string
}

export function CanvasViewport(props: CanvasViewportProps) {
  const {
    variant,
    layout = 'full',
    geospatialModeEnabled,
    workspaceEditorOverlayOpen = false,
    canvasRenderMode,
    canvas3dMode,
    canvas2dRenderer,
    documentSwitchPending = false,
    documentSwitchPendingLabel = 'Switching document...',
  } = props
  const activeGraphData = useActiveGraphRenderData(true)
  const sourceFiles = useGraphStore(s => s.sourceFiles)
  const markdownDocumentName = useGraphStore(s => s.markdownDocumentName)
  const markdownDocumentText = useGraphStore(s => s.markdownDocumentText)
  const sourceFilesBootstrapReady = useSourceFilesBootstrapReady()
  const explorerActivePath = useMarkdownExplorerStore(s => s.activePath)
  const activeSourceFile = React.useMemo(
    () => resolvePreferredEnabledComposedSourceFile({
      sourceFiles,
      markdownDocumentName,
      explorerActivePath,
      fallbackName: markdownDocumentName,
    }),
    [explorerActivePath, markdownDocumentName, sourceFiles],
  )
  const rawActive2dSurface = getCanvas2dSurfaceId(canvas2dRenderer)
  const workspaceStoryboardSurfaceActive = workspaceEditorOverlayOpen === true
    && isStoryboardCanvas2dRenderer(canvas2dRenderer)
    && canvasRenderMode === '2d'
    && (
      isFrontmatterFlowGraph(activeGraphData)
      || isFrontmatterFlowGraph(activeSourceFile?.parsedGraphData)
    )
  const active2dSurface = workspaceStoryboardSurfaceActive ? 'storyboard' : rawActive2dSurface
  const documentSwitchBlocksCanvas = documentSwitchPending && !workspaceStoryboardSurfaceActive
  const sharedGraphCanvasSurfaceActive = active2dSurface === 'd3'
  const safeGraphData = activeGraphData || ({ nodes: [], edges: [] } as GraphData)
  const { frontmatterModeEnabled, multiDimTableModeEnabled, documentSemanticMode, schema, timelineEnabled, bottomSurfaceCollapsed, bottomSurfaceTab } = useGraphStore(
    useShallow(s => ({
      frontmatterModeEnabled: s.frontmatterModeEnabled === true,
      multiDimTableModeEnabled: s.multiDimTableModeEnabled === true,
      documentSemanticMode: s.documentSemanticMode,
      schema: s.schema,
      timelineEnabled: s.timelineEnabled,
      bottomSurfaceCollapsed: s.bottomSurfaceCollapsed === true,
      bottomSurfaceTab: s.bottomSurfaceTab,
    })),
  )
  const documentVersionGraphBottomPanelVisible = bottomSurfaceCollapsed !== true && bottomSurfaceTab === 'documentVersionGraph'
  const mermaidFlowchartBottomPanelVisible = bottomSurfaceCollapsed !== true && bottomSurfaceTab === 'flowchart'
  const mermaidGitGraphBottomPanelVisible = bottomSurfaceCollapsed !== true && bottomSurfaceTab === 'gitGraph'
  const mermaidGanttBottomPanelVisible = bottomSurfaceCollapsed !== true && bottomSurfaceTab === 'gantt'
  const designTimelineBottomPanelVisible = canvas2dRenderer === 'design' && bottomSurfaceCollapsed !== true && bottomSurfaceTab === 'timeline'
  const mermaidTimelineBottomPanelVisible = !designTimelineBottomPanelVisible && bottomSurfaceCollapsed !== true && bottomSurfaceTab === 'timeline'
  const xrBottomPanelVisible = bottomSurfaceCollapsed !== true && bottomSurfaceTab === 'xr'
  const mermaidArchitectureBottomPanelVisible = bottomSurfaceCollapsed !== true && bottomSurfaceTab === 'architecture'
  const mermaidEventModelingBottomPanelVisible = bottomSurfaceCollapsed !== true && bottomSurfaceTab === 'eventModeling'
  const { paywallEnabled, floatingPanelOpen, floatingPanelView } = useGraphStore(
    useShallow(s => ({
      paywallEnabled: s.paymentsStripePaywallEnabled === true,
      floatingPanelOpen: s.floatingPanelOpen === true,
      floatingPanelView: s.floatingPanelView,
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
  const geospatialOverlayOwnsViewport = geospatialModeEnabled && !(workspaceEditorOverlayOpen && active2dSurface === 'storyboard')
  const strybldrTimelineBottomPanelVisible = canvas2dRenderer === 'storyboard'
    && (
      isStrybldrStoryboardGraphData(activeGraphData)
      || isStrybldrStoryboardGraphData(activeSourceFile?.parsedGraphData)
    )
    && shouldRenderTimelineSurface({
    activeSurface,
    documentSwitchPending: documentSwitchBlocksCanvas,
    geospatialOverlayOwnsViewport,
    timelineEnabled,
  })
  const timelineBottomPanelVisible =
    documentVersionGraphBottomPanelVisible ||
    mermaidFlowchartBottomPanelVisible ||
    mermaidGitGraphBottomPanelVisible ||
    mermaidGanttBottomPanelVisible ||
    mermaidTimelineBottomPanelVisible ||
    xrBottomPanelVisible ||
    mermaidArchitectureBottomPanelVisible ||
    mermaidEventModelingBottomPanelVisible ||
    designTimelineBottomPanelVisible ||
    strybldrTimelineBottomPanelVisible
  const paywallOverlayActive = paywallEnabled && floatingPanelOpen && floatingPanelView === 'chat'
  const { liveCanvasHeroVisible, liveCanvasHeroSource, dismissLiveCanvasHero } = useKnowgrphLiveCanvasHero({
    graphData: activeGraphData,
    sourceFiles,
    markdownDocumentName,
    markdownDocumentText,
    sourceFilesBootstrapReady,
    isEmbeddedPreview: variant === 'embeddedPreview',
    workspaceEditorOverlayOpen,
    workspaceDocumentSwitchPending: documentSwitchBlocksCanvas,
    floatingPanelOpen,
    alternateCanvasSurfaceActive: geospatialModeEnabled || canvasRenderMode !== '2d' || active2dSurface !== 'storyboard',
  })
  const isNarrowViewport = useMediaQuery('(max-width: 768px)')
  const minimapOverlayVisible = !documentSwitchBlocksCanvas
    && !geospatialOverlayOwnsViewport
    && !liveCanvasHeroVisible
    && !isNarrowViewport
    && (
      (activeSurface === '2d' && supportsCanvas2dMinimap(canvas2dRenderer))
      || (activeSurface === '3d' && effectiveCanvas3dMode === '3d')
    )
  const minimapOverlaySurface = activeSurface === '3d' ? '3d' : '2d'
  const bridgeOnlyWidgetDropActive = !documentSwitchBlocksCanvas
    && !geospatialOverlayOwnsViewport
    && !liveCanvasHeroVisible
    && canvasRenderMode === '2d'
    && active2dSurface !== 'storyboard'
  const rootRef = React.useRef<HTMLElement | null>(null)
  useForbidBrowserZoomWheel(rootRef, true, { stopPropagation: false })

  return (
    <section
      ref={rootRef}
      data-kg-canvas-viewport-root="1"
      className="relative w-full h-full overflow-hidden"
      style={{ touchAction: 'manipulation', overscrollBehavior: 'none', WebkitTapHighlightColor: 'transparent' }}
      aria-label={variant === 'embeddedPreview' ? 'Canvas Preview Only' : 'Canvas viewport'}
    >
      <React.Suspense fallback={null}>
        {!documentSwitchBlocksCanvas && !geospatialOverlayOwnsViewport && canvasRenderMode === '2d' && (
          <section className="absolute inset-0 z-[10]">
            {liveCanvasHeroVisible && liveCanvasHeroSource ? (
              <>
                <section
                  className="absolute inset-0 pointer-events-auto opacity-100"
                  aria-label="Interactive workspace README command-route canvas"
                  data-kg-live-canvas-hero-canvas="workspace-runtime"
                  data-kg-live-canvas-hero-interactive="true"
                  data-kg-live-canvas-hero-source={liveCanvasHeroSource.sourcePath}
                  data-kg-live-canvas-hero-source-graph-id={liveCanvasHeroSource.graphId || undefined}
                >
                  <FlowCanvasLazy
                    active
                    graphDataOverride={liveCanvasHeroSource.canvasGraphData}
                    mutationSourceGraphDataOverride={liveCanvasHeroSource.graphData}
                    graphDataRevisionOverride={liveCanvasHeroSource.graphRevision}
                    canvas2dRendererOverride="flow"
                    suppressMediaOverlays
                    flowWidgetStateGraphKeyOverride={`live-hero:${liveCanvasHeroSource.sourceLayerHash}`}
                    forbidCircleNodes
                  />
                </section>
                <LiveCanvasHeroLazy source={liveCanvasHeroSource} onHandoffComplete={dismissLiveCanvasHero} />
              </>
            ) : (
              <>
                <section
                  className={`absolute inset-0 ${sharedGraphCanvasSurfaceActive ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
                  aria-hidden={!sharedGraphCanvasSurfaceActive}
                  data-kg-shared-graph-canvas-surface={sharedGraphCanvasSurfaceActive ? active2dSurface || undefined : undefined}
                >
                  {sharedGraphCanvasSurfaceActive ? <SharedGraphCanvasLazy active /> : null}
                </section>
                <section className={`absolute inset-0 ${active2dSurface === 'dashboard' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={active2dSurface !== 'dashboard'}>
                  {active2dSurface === 'dashboard' ? <DashboardCanvasLazy active /> : null}
                </section>
                <section className={`absolute inset-0 ${active2dSurface === 'gallery' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={active2dSurface !== 'gallery'}>
                  {active2dSurface === 'gallery' ? <GalleryCanvasLazy active /> : null}
                </section>
                <section className={`absolute inset-0 ${active2dSurface === 'media' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={active2dSurface !== 'media'}>
                  {active2dSurface === 'media' ? <MediaCanvasLazy /> : null}
                </section>
                <section className={`absolute inset-0 flex min-h-0 min-w-0 bg-[var(--kg-panel-bg)] ${active2dSurface === 'multiDimTable' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={active2dSurface !== 'multiDimTable'}>
                  {active2dSurface === 'multiDimTable' ? <MultiDimTableSurfaceLazy active ariaLabel="Canvas Multi-dimensional Table" /> : null}
                </section>
                <section className={`absolute inset-0 ${active2dSurface === 'gitGraph' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={active2dSurface !== 'gitGraph'}>
                  {active2dSurface === 'gitGraph' ? <MermaidGitGraphCanvasLazy active /> : null}
                </section>
                <section className={`absolute inset-0 ${active2dSurface === 'gantt' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={active2dSurface !== 'gantt'}>
                  {active2dSurface === 'gantt' ? <MermaidGanttCanvasLazy active /> : null}
                </section>
                <section className={`absolute inset-0 ${active2dSurface === 'flow' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={active2dSurface !== 'flow'}>
                  {active2dSurface === 'flow' ? <FlowCanvasLazy active /> : null}
                </section>
                <section className={`absolute inset-0 ${active2dSurface === 'animatic' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={active2dSurface !== 'animatic'}>
                  {active2dSurface === 'animatic' ? <AnimaticCanvasLazy active /> : null}
                </section>
                <section className={`absolute inset-0 ${active2dSurface === 'design' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={active2dSurface !== 'design'}>
                  {active2dSurface === 'design' ? <DesignCanvasLazy active /> : null}
                </section>
                <section className={`absolute inset-0 ${active2dSurface === 'storyboard' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={active2dSurface !== 'storyboard'}>
                  {active2dSurface === 'storyboard' ? <StoryboardWidgetCanvasLazy active storyboardWidgetSurfaceId="storyboard" storyboardCardsMode /> : null}
                  {active2dSurface === 'storyboard' && floatingPanelOpen && floatingPanelView === 'view' ? (
                    <CanvasWorkspaceDataViewFloatingRegistrationBridgeLazy active fallbackDocumentName="storyboard.md" />
                  ) : null}
                </section>
              </>
            )}
          </section>
        )}
        {bridgeOnlyWidgetDropActive ? (
          <section
            className="absolute inset-0 z-[30] pointer-events-none"
            aria-hidden="true"
            data-kg-storyboard-widget-drop-bridge="canvas"
          >
            <StoryboardWidgetDropBridgeLazy active={false} widgetDropCaptureEnabled />
          </section>
        ) : null}
        {!documentSwitchBlocksCanvas && !geospatialOverlayOwnsViewport && canvasRenderMode === '3d' ? (
          <section className={`absolute inset-0 z-[10] ${activeSurface === '3d' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
            <ThreeGraphLazy active mode={effectiveCanvas3dMode} />
          </section>
        ) : null}

        {!documentSwitchBlocksCanvas && geospatialModeEnabled && active2dSurface === 'storyboard' ? (
          <section className="absolute inset-0 z-[30] pointer-events-none" aria-hidden="true">
            <StoryboardWidgetDropBridgeLazy active={false} widgetDropCaptureEnabled geospatialWidgetPanelMode />
          </section>
        ) : null}

        {!documentSwitchBlocksCanvas && geospatialOverlayOwnsViewport ? (
          <CanvasViewportGeospatialOverlayLazy
            active={activeSurface === 'geo'}
            geospatialModeEnabled={geospatialModeEnabled}
            graphData={safeGraphData}
            storyboardWidgetPanelsActive={geospatialModeEnabled && active2dSurface === 'storyboard'}
          />
        ) : null}

        {variant === 'workspace' ? (
          <>
            {layout === 'full' && !documentSwitchBlocksCanvas && !liveCanvasHeroVisible ? (
              <React.Suspense fallback={null}>
                <LaunchSpotlightLazy />
              </React.Suspense>
            ) : null}
            {minimapOverlayVisible ? (
              <aside
                className={`${layout === 'pane' ? 'absolute kg-canvas-minimap-overlay--pane' : 'fixed'} ${UI_RESPONSIVE_CANVAS_MINIMAP_OVERLAY_CLASSNAME} ${workspaceEditorOverlayOpen ? 'z-[420]' : 'z-[201]'} pointer-events-auto isolate`}
                aria-label="Minimap Overlay"
                data-kg-minimap-overlay="1"
                data-kg-css-inspector-selectable="minimap-overlay"
                data-kg-minimap-overlay-placement="bottom-left"
                data-kg-minimap-overlay-surface={minimapOverlaySurface}
              >
                <MinimapLazy />
              </aside>
            ) : null}
            {timelineBottomPanelVisible && !liveCanvasHeroVisible ? (
              <StrybldrTimelineBottomPanelLazy
                active={strybldrTimelineBottomPanelVisible}
                initialView={
                  mermaidEventModelingBottomPanelVisible
                    ? 'eventModeling'
                    : mermaidArchitectureBottomPanelVisible
                      ? 'architecture'
                      : designTimelineBottomPanelVisible
                        ? 'designTimeline'
                        : mermaidTimelineBottomPanelVisible
                          ? 'timeline'
                          : xrBottomPanelVisible
                            ? 'xr'
                            : mermaidGanttBottomPanelVisible
                              ? 'gantt'
                              : mermaidGitGraphBottomPanelVisible
                                ? 'gitGraph'
                                : mermaidFlowchartBottomPanelVisible
                                  ? 'flowchart'
                                  : documentVersionGraphBottomPanelVisible
                                    ? 'documentVersionGraph'
                                    : 'strybldrTimeline'
                }
                workspaceEditorOverlayOpen={workspaceEditorOverlayOpen}
              />
            ) : null}
            {!documentSwitchBlocksCanvas && MARKDOWN_METRICS_DEV_ENABLED ? <MarkdownMetricsDevOverlayLazy layout={layout} /> : null}
            {!documentSwitchBlocksCanvas && paywallOverlayActive ? <PaywallOverlayLazy portalTarget={rootRef.current} /> : null}
            {documentSwitchBlocksCanvas ? (
              <section
                className="absolute inset-0 z-[80] flex items-center justify-center bg-[var(--kg-canvas-bg)]"
                aria-label={documentSwitchPendingLabel}
              >
                <section className="rounded border border-[var(--kg-border)] bg-[var(--kg-panel-bg)] px-4 py-3 text-center shadow-sm">
                  <p className="text-sm font-medium text-[var(--kg-text-primary)]">{documentSwitchPendingLabel}</p>
                  <p className="mt-1 text-xs text-[var(--kg-text-secondary)]">Preparing canvas view...</p>
                </section>
              </section>
            ) : null}
          </>
        ) : null}
      </React.Suspense>
    </section>
  )
}
