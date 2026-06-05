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

import { getCanvas2dSurfaceId, isFlowEditorCanvas2dRenderer, supportsCanvas2dMinimap } from '@/lib/config.render'
import { shouldRenderTimelineSurface } from '@/lib/timeline/timelineVisibility'
import { resolvePreferredEnabledComposedSourceFile } from '@/features/source-files/composedSourceSelection'
import { isFrontmatterFlowGraph } from '@/lib/graph/frontmatterMode'

import { InfiniteCanvasWorkspaceOverlay } from '@/features/canvas/InfiniteCanvasWorkspaceOverlay'
const CanvasViewportGeospatialOverlayLazy = React.lazy(() =>
  import('@/components/CanvasViewportGeospatialOverlay').then(mod => ({ default: mod.CanvasViewportGeospatialOverlay })),
)

const GraphCanvasLazy = React.lazy(() => import('@/components/GraphCanvas'))
const DashboardCanvasLazy = React.lazy(() => importWithRetry(() => import('@/components/DashboardCanvas'), { retries: 2, retryDelayMs: 50 }))
const MermaidGitGraphCanvasLazy = React.lazy(() => import('@/components/MermaidGitGraphCanvas'))
const FlowCanvasLazy = React.lazy(() => importWithRetry(() => import('@/components/FlowCanvas'), { retries: 2, retryDelayMs: 50 }))
const AnimaticCanvasLazy = React.lazy(() => importWithRetry(() => import('@/components/AnimaticCanvas'), { retries: 2, retryDelayMs: 50 }))
const StoryboardCanvasLazy = React.lazy(() => importWithRetry(() => import('@/components/StoryboardCanvas'), { retries: 2, retryDelayMs: 50 }))
const FlowEditorCanvasLazy = React.lazy(() => importWithRetry(() => import('@/components/FlowEditorCanvas'), { retries: 2, retryDelayMs: 50 }))
const FlowEditorWidgetDropBridgeLazy = React.lazy(() => importWithRetry(() => import('@/components/FlowEditorWidgetDropBridge'), { retries: 2, retryDelayMs: 50 }))
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
  const workspaceFrontmatterFlowEditorSurfaceActive = workspaceEditorOverlayOpen === true
    && isFlowEditorCanvas2dRenderer(canvas2dRenderer)
    && canvasRenderMode === '2d'
    && (
      isFrontmatterFlowGraph(activeGraphData)
      || isFrontmatterFlowGraph(activeSourceFile?.parsedGraphData)
    )
  const active2dSurface = workspaceFrontmatterFlowEditorSurfaceActive ? 'flowEditor' : rawActive2dSurface
  const documentSwitchBlocksCanvas = documentSwitchPending && !workspaceFrontmatterFlowEditorSurfaceActive
  const d3SurfaceActive = active2dSurface === 'd3'
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
  const mermaidGitGraphBottomPanelVisible = bottomSurfaceCollapsed !== true && bottomSurfaceTab === 'gitGraph'
  const mermaidGanttBottomPanelVisible = bottomSurfaceCollapsed !== true && bottomSurfaceTab === 'gantt'
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
  const geospatialOverlayOwnsViewport = geospatialModeEnabled && !(workspaceEditorOverlayOpen && active2dSurface === 'flowEditor')
  const strybldrTimelineBottomPanelVisible = canvas2dRenderer === 'strybldr' && shouldRenderTimelineSurface({
    activeSurface,
    documentSwitchPending: documentSwitchBlocksCanvas,
    geospatialOverlayOwnsViewport,
    timelineEnabled,
  })
  const timelineBottomPanelVisible = documentVersionGraphBottomPanelVisible || mermaidGitGraphBottomPanelVisible || mermaidGanttBottomPanelVisible || strybldrTimelineBottomPanelVisible
  const paywallOverlayActive = paywallEnabled && floatingPanelOpen && floatingPanelView === 'chat'
  const isNarrowViewport = useMediaQuery('(max-width: 768px)')
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
            <section className={`absolute inset-0 ${d3SurfaceActive ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={!d3SurfaceActive}>
              {d3SurfaceActive ? <GraphCanvasLazy active /> : null}
            </section>
            <section className={`absolute inset-0 ${active2dSurface === 'dashboard' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={active2dSurface !== 'dashboard'}>
              {active2dSurface === 'dashboard' ? <DashboardCanvasLazy active /> : null}
            </section>
            <section className={`absolute inset-0 ${active2dSurface === 'gitGraph' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={active2dSurface !== 'gitGraph'}>
              {active2dSurface === 'gitGraph' ? <MermaidGitGraphCanvasLazy active /> : null}
            </section>
            <section className={`absolute inset-0 ${active2dSurface === 'flow' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={active2dSurface !== 'flow'}>
              {active2dSurface === 'flow' ? <FlowCanvasLazy active /> : null}
            </section>
            <section className={`absolute inset-0 ${active2dSurface === 'animatic' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={active2dSurface !== 'animatic'}>
              {active2dSurface === 'animatic' ? <AnimaticCanvasLazy active /> : null}
            </section>
            <section className={`absolute inset-0 ${active2dSurface === 'storyboard' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={active2dSurface !== 'storyboard'}>
              {active2dSurface === 'storyboard' ? <StoryboardCanvasLazy active /> : null}
            </section>
            <section className={`absolute inset-0 ${active2dSurface === 'design' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={active2dSurface !== 'design'}>
              {active2dSurface === 'design' ? <DesignCanvasLazy active /> : null}
            </section>
            <section className={`absolute inset-0 ${active2dSurface === 'flowEditor' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`} aria-hidden={active2dSurface !== 'flowEditor'}>
              {active2dSurface === 'flowEditor' ? <FlowEditorCanvasLazy active /> : null}
            </section>
          </section>
        )}
        {!documentSwitchBlocksCanvas && !geospatialOverlayOwnsViewport && canvasRenderMode === '3d' ? (
          <section className={`absolute inset-0 z-[10] ${activeSurface === '3d' ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}>
            <ThreeGraphLazy active mode={effectiveCanvas3dMode} />
          </section>
        ) : null}

        {!documentSwitchBlocksCanvas && geospatialModeEnabled && active2dSurface === 'flowEditor' ? (
          <section className="absolute inset-0 z-[30] pointer-events-none" aria-hidden="true">
            <FlowEditorWidgetDropBridgeLazy active={false} widgetDropCaptureEnabled geospatialWidgetPanelMode />
          </section>
        ) : null}

        {!documentSwitchBlocksCanvas && geospatialOverlayOwnsViewport ? (
          <CanvasViewportGeospatialOverlayLazy
            active={activeSurface === 'geo'}
            geospatialModeEnabled={geospatialModeEnabled}
            graphData={safeGraphData}
            flowEditorWidgetPanelsActive={geospatialModeEnabled && active2dSurface === 'flowEditor'}
          />
        ) : null}

        {variant === 'workspace' ? (
          <>
            {layout === 'full' && !documentSwitchBlocksCanvas ? (
              <React.Suspense fallback={null}>
                <LaunchSpotlightLazy />
              </React.Suspense>
            ) : null}
            {!documentSwitchBlocksCanvas && !geospatialOverlayOwnsViewport && activeSurface === '2d' && !isNarrowViewport && supportsCanvas2dMinimap(canvas2dRenderer) ? (
              <aside
                className={`${layout === 'pane' ? 'absolute kg-canvas-minimap-overlay--pane' : 'fixed'} ${UI_RESPONSIVE_CANVAS_MINIMAP_OVERLAY_CLASSNAME} ${workspaceEditorOverlayOpen ? 'z-[420]' : 'z-[201]'} pointer-events-auto`}
                aria-label="Minimap Overlay"
              >
                <MinimapLazy />
              </aside>
            ) : null}
            {timelineBottomPanelVisible ? (
              <StrybldrTimelineBottomPanelLazy
                active={strybldrTimelineBottomPanelVisible}
                initialView={mermaidGanttBottomPanelVisible ? 'gantt' : mermaidGitGraphBottomPanelVisible ? 'gitGraph' : documentVersionGraphBottomPanelVisible ? 'documentVersionGraph' : 'timeline'}
                workspaceEditorOverlayOpen={workspaceEditorOverlayOpen}
              />
            ) : null}
            {!documentSwitchBlocksCanvas ? <InfiniteCanvasWorkspaceOverlay /> : null}
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
