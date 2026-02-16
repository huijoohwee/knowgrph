import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { FileCode, GitBranch, Layers, Map, MessageCircle, MonitorPlay, SlidersHorizontal } from 'lucide-react'
import { useOrchestratorPanelState } from '@/features/panels/hooks/useOrchestratorPanelState'
import { GRAPH_TRAVERSAL_FLOATING_PANEL_EVENT } from '@/features/panels/utils/useMainPanelRect'
import OrchestratorSettingsSection from '@/features/panels/views/OrchestratorSettingsSection'
import IconButton from '@/components/IconButton'
import { FLOATING_PANEL_SCROLL_CLASSNAME } from '@/components/ui/FloatingPanel'
import { ToolbarToolMenuRendererView } from '@/features/toolbar/ToolbarToolMenuRendererView'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { usePinnedLs } from '@/lib/ui/panelPinned'
import { uiPrimaryPillActiveClassName } from '@/features/graph-data-table/ui/GraphDataTableToolbarStyles'
import { cn } from '@/lib/utils'
import {
  FLOW_EDITOR_INSPECTOR_PORTAL_SLOT_ID,
  LS_KEYS,
  UI_LABELS,
  UI_SELECTORS,
} from '@/lib/config'
import { lsBool } from '@/lib/persistence'
import HeaderActions from '@/features/panels/ui/HeaderActions'
import { FloatingPropsPanel } from '@/features/toolbar/FloatingPropsPanel'
import DesignLayersPanel from '@/features/design/DesignLayersPanel'
import type { ToolbarToolMenuProps } from '@/features/toolbar/ToolbarToolMenuTypes'
import { requestGeospatialTraversalRun } from '@/features/geospatial/gympgrphBridge'
import { onGeospatialModeChanged } from '@/features/geospatial/events'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { openOrchestratorWorkflowWorkspaceFile } from '@/features/panels/utils/orchestratorWorkspaceFiles'

type FloatingPanelView = 'propsPanel' | 'designLayers' | 'inspector' | 'chat' | 'geo' | 'renderer' | 'graphTraversal'

const GeospatialPanelHostLazy = React.lazy(async () => {
  const m = await import('gympgrph')
  return { default: m.GeospatialPanelHost }
})

const GraphTableSelectionInspectorLazy = React.lazy(
  () => import('@/features/graph-table/ui/GraphTableSelectionInspector'),
)

const SidePanelChatLazy = React.lazy(() => import('@/features/chat/SidePanelChat'))

const InspectorView = React.memo(function InspectorView(props: { geospatialModeEnabled: boolean }) {
  const { geospatialModeEnabled } = props
  const { workspaceViewMode, canvasRenderMode, canvas2dRenderer } = useGraphStore(
    useShallow(s => ({
      workspaceViewMode: s.workspaceViewMode,
      canvasRenderMode: s.canvasRenderMode,
      canvas2dRenderer: s.canvas2dRenderer,
    })),
  )

  return (
    <section className="h-full" aria-label="Selection inspector">
      {!geospatialModeEnabled && workspaceViewMode === 'canvas' && canvasRenderMode === '2d' && canvas2dRenderer === 'flowEditor' ? (
        <section
          id={FLOW_EDITOR_INSPECTOR_PORTAL_SLOT_ID}
          className="h-full"
          aria-label="Flow Editor Inspector Slot"
        />
      ) : (
        <React.Suspense fallback={null}>
          <GraphTableSelectionInspectorLazy />
        </React.Suspense>
      )}
    </section>
  )
})

const GeoView = React.memo(function GeoView(props: { geospatialModeEnabled: boolean }) {
  const { geospatialModeEnabled } = props
  const activeGraphData = useActiveGraphRenderData()
  const panelTypography = usePanelTypography()
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

  return (
    <section className="h-full" aria-label="Geospatial panel">
      {geospatialModeEnabled ? (
        <React.Suspense fallback={null}>
          <GeospatialPanelHostLazy
            active
            showDatasetsManager={false}
            panelTypography={panelTypography}
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
        </React.Suspense>
      ) : (
        <p className="p-3 text-sm text-gray-600 dark:text-gray-300">Enable Geospatial Mode to view this panel.</p>
      )}
    </section>
  )
})

export function ToolbarToolMenu({
  pipelineStatus,
  exportStatus,
  toolMenuCardRef,
  toolMenuCardStyle,
  onHeaderPointerDown,
  requestedFloatingPanelView,
  requestedFloatingPanelViewSeq,
  onClose,
}: ToolbarToolMenuProps) {
  const { pinned: floatingPanelPinned, togglePinned: toggleFloatingPanelPinned } = usePinnedLs(LS_KEYS.floatingPanelPinned, true)
  const [floatingPanelMinimized, setFloatingPanelMinimized] = React.useState(false)
  const [floatingPanelView, setFloatingPanelView] = React.useState<FloatingPanelView>('propsPanel')
  const handledRequestedViewSeqRef = React.useRef<number | undefined>(undefined)
  const setFloatingPanelZIndex = useGraphStore(s => s.setFloatingPanelZIndex)

  const [geospatialModeEnabled, setGeospatialModeEnabled] = React.useState<boolean>(() => {
    try {
      return lsBool(LS_KEYS.geospatialOverlayEnabled, false)
    } catch {
      return false
    }
  })

  const { floatingPanelWidthRatio, floatingPanelHeightRatio, floatingPanelZIndex, uiIconScale, uiIconStrokeWidth } = useGraphStore(
    useShallow(state => ({
      floatingPanelWidthRatio: state.floatingPanelWidthRatio,
      floatingPanelHeightRatio: state.floatingPanelHeightRatio,
      floatingPanelZIndex: state.floatingPanelZIndex,
      uiIconScale: state.uiIconScale,
      uiIconStrokeWidth: state.uiIconStrokeWidth,
    })),
  )

  const {
    fontClass: uiPanelTextFontClass,
    textSizeClass: uiPanelKeyValueTextSizeClass,
    microLabelTextSizeClass: uiPanelMicroLabelTextSizeClass,
  } = usePanelTypography()

  const { sections: orchestratorSections } = useOrchestratorPanelState()
  const orchestratorSectionCollapsedById = orchestratorSections.byId
  const orchestratorSectionSetters = orchestratorSections.setters

  const orchestratorGraphRagCollapsed = orchestratorSectionCollapsedById.graphRag
  const orchestratorPresetsCollapsed = orchestratorSectionCollapsedById.presets
  const orchestratorEditorCollapsed = orchestratorSectionCollapsedById.editor
  const orchestratorContextCollapsed = orchestratorSectionCollapsedById.context
  const orchestratorWorkflowIndexingCollapsed = orchestratorSectionCollapsedById.workflowIndexing
  const orchestratorWorkflowTracingCollapsed = orchestratorSectionCollapsedById.workflowTracing

  const setOrchestratorGraphRagCollapsed = orchestratorSectionSetters.graphRag
  const setOrchestratorPresetsCollapsed = orchestratorSectionSetters.presets
  const setOrchestratorEditorCollapsed = orchestratorSectionSetters.editor
  const setOrchestratorContextCollapsed = orchestratorSectionSetters.context
  const setOrchestratorWorkflowIndexingCollapsed = orchestratorSectionSetters.workflowIndexing
  const setOrchestratorWorkflowTracingCollapsed = orchestratorSectionSetters.workflowTracing

  const handleSelectView = React.useCallback((view: FloatingPanelView) => {
    setFloatingPanelView(view)
  }, [])

  const handleFloatingPanelPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (floatingPanelPinned) return
      const target = event.target
      if (!(target instanceof Element)) return
      if (
        target.closest(
          UI_SELECTORS.draggablePanelIgnorePointerDown,
        )
      ) {
        return
      }
      onHeaderPointerDown(event)
    },
    [floatingPanelPinned, onHeaderPointerDown],
  )

  const floatingPanelRootClassName = 'fixed inset-0 pointer-events-none'

  const handlePinToggle = toggleFloatingPanelPinned

  const floatingPanelRootStyle = React.useMemo(() => {
    const safeZ = Number.isFinite(floatingPanelZIndex) ? Math.max(1, Math.floor(floatingPanelZIndex)) : 5000
    return { zIndex: floatingPanelPinned ? Math.max(safeZ, 1000) : 90 }
  }, [floatingPanelPinned, floatingPanelZIndex])

  const floatingPanelSizeStyle = React.useMemo(() => {
    const widthRatio = Number.isFinite(floatingPanelWidthRatio) ? floatingPanelWidthRatio : 0.25
    const heightRatio = Number.isFinite(floatingPanelHeightRatio) ? floatingPanelHeightRatio : 0.5
    const safeWidth = Math.max(0.15, Math.min(0.6, widthRatio))
    const safeHeight = Math.max(0.3, Math.min(0.9, heightRatio))
    return {
      width: `${Math.round(safeWidth * 100)}vw`,
      height: `${Math.round(safeHeight * 100)}vh`,
    }
  }, [floatingPanelWidthRatio, floatingPanelHeightRatio])

  const iconSizeClass = getIconSizeClass(uiIconScale)

  const viewButtons = (
    <>
      <IconButton
        title={UI_LABELS.propsPanel}
        onClick={() => handleSelectView('propsPanel')}
        className={`App-toolbar__btn ${
          floatingPanelView === 'propsPanel' ? uiPrimaryPillActiveClassName : UI_THEME_TOKENS.text.secondary
        }`}
        showTooltip
      >
        <SlidersHorizontal className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
      </IconButton>

      <IconButton
        title={UI_LABELS.layerMode}
        onClick={() => handleSelectView('designLayers')}
        className={`App-toolbar__btn ${
          floatingPanelView === 'designLayers' ? uiPrimaryPillActiveClassName : UI_THEME_TOKENS.text.secondary
        }`}
        showTooltip
      >
        <Layers className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
      </IconButton>

      {!geospatialModeEnabled && (
        <IconButton
          title={UI_LABELS.inspector}
          onClick={() => handleSelectView('inspector')}
          className={`App-toolbar__btn ${
            floatingPanelView === 'inspector' ? uiPrimaryPillActiveClassName : UI_THEME_TOKENS.text.secondary
          }`}
          showTooltip
        >
          <FileCode className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
        </IconButton>
      )}

      <IconButton
        title={UI_LABELS.chat}
        onClick={() => handleSelectView('chat')}
        className={`App-toolbar__btn ${
          floatingPanelView === 'chat' ? uiPrimaryPillActiveClassName : UI_THEME_TOKENS.text.secondary
        }`}
        showTooltip
      >
        <MessageCircle className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
      </IconButton>

      <IconButton
        title={UI_LABELS.geo}
        onClick={() => handleSelectView('geo')}
        disabled={!geospatialModeEnabled}
        className={`App-toolbar__btn ${
          floatingPanelView === 'geo' ? uiPrimaryPillActiveClassName : UI_THEME_TOKENS.text.secondary
        }`}
        showTooltip
      >
        <Map className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
      </IconButton>

      <IconButton
        title={UI_LABELS.renderer}
        onClick={() => handleSelectView('renderer')}
        className={`App-toolbar__btn ${
          floatingPanelView === 'renderer' ? uiPrimaryPillActiveClassName : UI_THEME_TOKENS.text.secondary
        }`}
        showTooltip
      >
        <MonitorPlay className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
      </IconButton>
      <IconButton
        title={UI_LABELS.graphTraversal}
        onClick={() => handleSelectView('graphTraversal')}
        className={`App-toolbar__btn ${
          floatingPanelView === 'graphTraversal' ? uiPrimaryPillActiveClassName : UI_THEME_TOKENS.text.secondary
        }`}
        showTooltip
        data-kg-spotlight-view="graphTraversal"
      >
        <GitBranch className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
      </IconButton>
    </>
  )

  React.useEffect(() => {
    return onGeospatialModeChanged(detail => {
      const enabled = typeof detail.enabled === 'boolean' ? detail.enabled : null
      if (enabled == null) return
      setGeospatialModeEnabled(enabled)
    })
  }, [])

  React.useEffect(() => {
    if (!floatingPanelPinned) return
    if (!Number.isFinite(floatingPanelZIndex)) return
    if (floatingPanelZIndex >= 1000) return
    setFloatingPanelZIndex(1000)
  }, [floatingPanelPinned, floatingPanelZIndex, setFloatingPanelZIndex])

  React.useEffect(() => {
    if (!requestedFloatingPanelView || !requestedFloatingPanelViewSeq) return
    if (handledRequestedViewSeqRef.current === requestedFloatingPanelViewSeq) return
    handledRequestedViewSeqRef.current = requestedFloatingPanelViewSeq
    setFloatingPanelMinimized(false)
    setFloatingPanelView(requestedFloatingPanelView)
  }, [requestedFloatingPanelView, requestedFloatingPanelViewSeq])

  React.useEffect(() => {
    if (geospatialModeEnabled) {
      if (floatingPanelView === 'inspector') setFloatingPanelView('geo')
      return
    }
    if (floatingPanelView === 'geo') setFloatingPanelView('inspector')
  }, [floatingPanelView, geospatialModeEnabled])

  React.useEffect(() => {
    const handleOpenGraphTraversal = () => {
      setFloatingPanelMinimized(false)
      setFloatingPanelView('graphTraversal')
    }
    window.addEventListener(GRAPH_TRAVERSAL_FLOATING_PANEL_EVENT, handleOpenGraphTraversal)
    return () => {
      window.removeEventListener(GRAPH_TRAVERSAL_FLOATING_PANEL_EVENT, handleOpenGraphTraversal)
    }
  }, [])

  if (floatingPanelMinimized) {
    return (
      <section className={floatingPanelRootClassName} style={floatingPanelRootStyle}>
        <aside
          ref={toolMenuCardRef}
          className={`pointer-events-auto ModalContainer App-toolbar App-toolbar--compact select-none min-w-[260px] max-w-xs w-80 p-0 ${!floatingPanelPinned ? 'cursor-move' : ''}`}
          style={toolMenuCardStyle}
          onPointerDown={handleFloatingPanelPointerDown}
        >
          <header className="flex items-center justify-between gap-2 w-full">
            <nav className={`flex items-center gap-1 min-w-0 ${uiPanelTextFontClass}`} aria-label="Floating panel views">
              {viewButtons}
              {pipelineStatus && (
                <span className={`${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.text.tertiary} truncate max-w-[120px]`}>
                  {pipelineStatus}
                </span>
              )}
            </nav>
            <HeaderActions
              onPinToggle={handlePinToggle}
              pinned={floatingPanelPinned}
              onRestore={() => {
                setFloatingPanelMinimized(false)
              }}
              onClose={onClose}
            />
          </header>
        </aside>
      </section>
    )
  }

  return (
    <section className={floatingPanelRootClassName} style={floatingPanelRootStyle}>
      <aside
        ref={toolMenuCardRef}
        className={`pointer-events-auto ModalContainer flex flex-col overflow-hidden p-0 ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}
        style={{ ...toolMenuCardStyle, ...floatingPanelSizeStyle }}
        onPointerDown={handleFloatingPanelPointerDown}
      >
        <section className="px-2 py-1 flex flex-col gap-1 min-w-[260px] min-h-[36px] h-full" aria-label="Floating panel">
          <header className={`flex items-center justify-between gap-2 w-full select-none ${!floatingPanelPinned ? 'cursor-move' : ''}`}>
            <nav className={`flex items-center gap-1 min-w-0 ${uiPanelTextFontClass}`} aria-label="Floating panel views">
              {viewButtons}
              {pipelineStatus && (
                <span className={`${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.text.tertiary} truncate max-w-[120px]`}>
                  {pipelineStatus}
                </span>
              )}
              {exportStatus && (
                <span className={`${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.text.tertiary} truncate max-w-[160px]`}>
                  {exportStatus}
                </span>
              )}
            </nav>
            <HeaderActions
              onPinToggle={handlePinToggle}
              pinned={floatingPanelPinned}
              onMinimize={() => {
                setFloatingPanelMinimized(true)
              }}
              onClose={onClose}
            />
          </header>
          <section
            className={cn(
              'mt-1',
              FLOATING_PANEL_SCROLL_CLASSNAME,
              uiPanelTextFontClass,
              uiPanelKeyValueTextSizeClass,
              UI_THEME_TOKENS.text.primary,
            )}
            aria-label={UI_LABELS.floatingPanel}
          >
            {floatingPanelView === 'propsPanel' && <FloatingPropsPanel />}
            {floatingPanelView === 'designLayers' && <DesignLayersPanel active={true} as="section" />}
            {floatingPanelView === 'inspector' && <InspectorView geospatialModeEnabled={geospatialModeEnabled} />}
            {floatingPanelView === 'chat' && (
              <section className="h-full" aria-label="Chat panel">
                <React.Suspense fallback={null}>
                  <SidePanelChatLazy />
                </React.Suspense>
              </section>
            )}
            {floatingPanelView === 'geo' && <GeoView geospatialModeEnabled={geospatialModeEnabled} />}
            {floatingPanelView === 'renderer' && <ToolbarToolMenuRendererView />}
            {floatingPanelView === 'graphTraversal' && (
              <section className="space-y-2" aria-label="Graph traversal">
                <header className="flex items-center justify-between gap-2" aria-label="Graph traversal actions">
                  <nav className="flex items-center gap-2" aria-label="Traversal tools">
                    <button
                      type="button"
                      className={cn('App-toolbar__btn', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
                      onClick={() => openOrchestratorWorkflowWorkspaceFile()}
                    >
                      Open `orchestrator/graphrag-workflow.jsonld`
                    </button>
                    <button
                      type="button"
                      className={cn('App-toolbar__btn', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
                      onClick={() => {
                        void requestGeospatialTraversalRun().catch(() => void 0)
                      }}
                    >
                      Run airplane on selected edge
                    </button>
                  </nav>
                  <p className={`${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.text.tertiary}`}>Geospatial</p>
                </header>
                <OrchestratorSettingsSection
                  graphRagCollapsed={orchestratorGraphRagCollapsed}
                  presetsCollapsed={orchestratorPresetsCollapsed}
                  editorCollapsed={orchestratorEditorCollapsed}
                  contextCollapsed={orchestratorContextCollapsed}
                  setGraphRagCollapsed={setOrchestratorGraphRagCollapsed}
                  setPresetsCollapsed={setOrchestratorPresetsCollapsed}
                  setEditorCollapsed={setOrchestratorEditorCollapsed}
                  setContextCollapsed={setOrchestratorContextCollapsed}
                  indexingCollapsed={orchestratorWorkflowIndexingCollapsed}
                  setIndexingCollapsed={setOrchestratorWorkflowIndexingCollapsed}
                  tracingCollapsed={orchestratorWorkflowTracingCollapsed}
                  setTracingCollapsed={setOrchestratorWorkflowTracingCollapsed}
                />
              </section>
            )}
          </section>
        </section>
      </aside>
    </section>
  )
}
