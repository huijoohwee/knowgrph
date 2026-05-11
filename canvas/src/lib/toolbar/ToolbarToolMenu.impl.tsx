import React from 'react'
import { useShallow } from 'zustand/react/shallow'
import { ChevronDown, FileCode, GitBranch, Hand, ListTree, Map, MessageCircle, MonitorPlay, SlidersHorizontal } from 'lucide-react'
import { useOrchestratorPanelState } from '@/features/panels/hooks/useOrchestratorPanelState'
import { GRAPH_TRAVERSAL_FLOATING_PANEL_EVENT } from '@/features/panels/utils/useMainPanelRect'
import OrchestratorSettingsSection from '@/features/panels/views/OrchestratorSettingsSection'
import IconButton from '@/components/IconButton'
import { ToolbarDropdownSelect } from '@/components/toolbar/ToolbarDropdownSelect'
import { FLOATING_PANEL_SCROLL_CLASSNAME } from '@/components/ui/FloatingPanel'
import { ToolbarToolMenuRendererView } from '@/features/toolbar/ToolbarToolMenuRendererView'
import { useGraphStore } from '@/hooks/useGraphStore'
import { getIconSizeClass } from '@/lib/ui'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { usePinnedLs } from '@/lib/ui/panelPinned'
import { uiPrimaryPillActiveClassName } from '@/features/toolbar/ui/toolbarStyles'
import { cn } from '@/lib/utils'
import { Z_INDEX_FLOATING_PANEL_DEFAULT } from '@/lib/ui/zIndex'
import {
  LS_KEYS,
  UI_LABELS,
  UI_SELECTORS,
} from '@/lib/config'
import { lsBool } from '@/lib/persistence'
import HeaderActions from '@/features/panels/ui/HeaderActions'
import { FloatingPropsPanel } from '@/features/toolbar/FloatingPropsPanel'
import DesignDomTreePanel from '@/features/design/DesignDomTreePanel'
import DesignDomInspectPanel from '@/features/design/DesignDomInspectPanel'
import type { ToolbarToolMenuProps } from '@/features/toolbar/ToolbarToolMenuTypes'
import { requestGeospatialTraversalRun, setGeospatialModeEnabled as enableGeospatialMode } from '@/features/geospatial/gympgrphBridge'
import { onGeospatialModeChanged } from '@/features/geospatial/events'
import { isFlowEditorCanvas2dRenderer } from '@/lib/config.render'
import ErrorBoundary from '@/components/ErrorBoundary'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { deriveGraphGroups } from '@/components/GraphCanvas/layout/graphGroups'
import { openOrchestratorWorkflowWorkspaceFile } from '@/features/panels/utils/orchestratorWorkspaceFiles'
import { InfiniteCanvasInteractionPanel } from '@/features/canvas/InfiniteCanvasInteractionPanel'
import { isWorkspaceEditorOverlayOpen } from '@/features/workspace-table/workspaceTableSsot'

type FloatingPanelView = 'propsPanel' | 'interaction' | 'domTree' | 'domInspect' | 'chat' | 'geo' | 'renderer' | 'graphTraversal'
type RequestedFloatingPanelView = FloatingPanelView
type FloatingManagedHeaderActionsView = 'renderer'
type FloatingHeaderActions = {
  apply?: () => void
  reset?: () => void
  applyDisabled?: boolean
  resetDisabled?: boolean
}

type FloatingPanelDevStatusMetrics = {
  counter: string
  hierarchyBadge: string
  suffix: string
} | null

type FloatingPanelViewButtonSpec = {
  view: FloatingPanelView
  title: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  disabled?: boolean
  hidden?: boolean
  spotlightView?: string
}

type FloatingPanelOverflowOption = {
  id: FloatingPanelView
  title: string
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>
  disabled?: boolean
  hidden?: boolean
}

type GeospatialPanelHostProps = {
  active?: boolean
  showDatasetsManager?: boolean
  panelTypography?: unknown
  snapshot?: unknown
  handlers?: unknown
}

const MissingGeospatialPanelHost = React.memo(function MissingGeospatialPanelHost(_props: GeospatialPanelHostProps) {
  return (
    <div className={`h-full w-full flex items-center justify-center text-xs ${UI_THEME_TOKENS.text.secondary}`}>
      Geospatial panel unavailable
    </div>
  )
})

const GeospatialPanelHostLazy = React.lazy(async (): Promise<{ default: React.ComponentType<GeospatialPanelHostProps> }> => {
  const m = (await import('gympgrph')) as unknown as Record<string, unknown>
  const c = m.GeospatialPanelHost as unknown
  if (!c) return { default: MissingGeospatialPanelHost }
  return { default: c as React.ComponentType<GeospatialPanelHostProps> }
})

const SidePanelChatLazy = React.lazy(() => import('@/features/chat/SidePanelChat'))

const FLOATING_PANEL_FULL_HEIGHT_VIEWS = new Set<FloatingPanelView>(['chat', 'geo', 'interaction'])

const FloatingPanelHeaderStatus = React.memo(function FloatingPanelHeaderStatus(props: {
  pipelineStatus: string | null
  exportStatus?: string | null
  devStatusMetrics: FloatingPanelDevStatusMetrics
  uiPanelMicroLabelTextSizeClass: string
}) {
  const { pipelineStatus, exportStatus, devStatusMetrics, uiPanelMicroLabelTextSizeClass } = props
  const statusClassName = `${uiPanelMicroLabelTextSizeClass} ${UI_THEME_TOKENS.text.tertiary} kg-truncate-chip`

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1 pl-1">
      {pipelineStatus && (
        <span className={statusClassName}>
          {pipelineStatus}
        </span>
      )}
      {devStatusMetrics && (
        <span className={statusClassName}>
          {devStatusMetrics.counter}
        </span>
      )}
      {devStatusMetrics && (
        <span className={statusClassName}>
          {devStatusMetrics.hierarchyBadge}
        </span>
      )}
      {devStatusMetrics && (
        <span className={statusClassName}>
          {devStatusMetrics.suffix}
        </span>
      )}
      {exportStatus && (
        <span className={statusClassName}>
          {exportStatus}
        </span>
      )}
    </span>
  )
})

const GeoView = React.memo(function GeoView(props: {
  geospatialModeEnabled: boolean
  isEnablingGeospatial: boolean
  geospatialEnableError: string | null
  onEnableGeospatial: () => void
}) {
  const {
    geospatialModeEnabled,
    isEnablingGeospatial,
    geospatialEnableError,
    onEnableGeospatial,
  } = props
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
    <section className="h-full flex flex-col" aria-label="Geospatial panel">
      {geospatialModeEnabled ? (
        <ErrorBoundary>
          <React.Suspense
            fallback={
              <div className={`p-3 text-xs ${UI_THEME_TOKENS.text.secondary}`}>
                Loading geospatial panel...
              </div>
            }
          >
            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
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
            </div>
          </React.Suspense>
        </ErrorBoundary>
      ) : (
        <div className="flex h-full flex-col items-start justify-center gap-3 p-3">
          <p className={cn('text-sm', UI_THEME_TOKENS.text.secondary)}>
            {isEnablingGeospatial
              ? 'Enabling Geospatial Mode...'
              : 'Enable Geospatial Mode to view this panel.'}
          </p>
          <button
            type="button"
            className={cn('App-toolbar__btn', UI_THEME_TOKENS.button.text, UI_THEME_TOKENS.button.hoverBg)}
            onClick={onEnableGeospatial}
            disabled={isEnablingGeospatial}
          >
            {isEnablingGeospatial ? 'Enabling Geo...' : 'Enable Geospatial Mode'}
          </button>
          {geospatialEnableError ? (
            <p className={cn('text-xs', UI_THEME_TOKENS.text.secondary)}>{geospatialEnableError}</p>
          ) : null}
        </div>
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
  const floatingPanelView = useGraphStore(s => (s.floatingPanelView || 'propsPanel') as FloatingPanelView)
  const setFloatingPanelView = useGraphStore(s => s.setFloatingPanelView)
  const [managedHeaderActions, setManagedHeaderActions] = React.useState<FloatingHeaderActions>({
    apply: undefined,
    reset: undefined,
    applyDisabled: true,
    resetDisabled: true,
  })
  const handledRequestedViewSeqRef = React.useRef<number | undefined>(undefined)
  const setFloatingPanelZIndex = useGraphStore(s => s.setFloatingPanelZIndex)

  const [geospatialModeEnabled, setGeospatialModeEnabledState] = React.useState<boolean>(() => {
    try {
      return lsBool(LS_KEYS.geospatialOverlayEnabled, true)
    } catch {
      return false
    }
  })
  const [isEnablingGeospatial, setIsEnablingGeospatial] = React.useState(false)
  const [geospatialEnableError, setGeospatialEnableError] = React.useState<string | null>(null)

  const {
    floatingPanelWidthRatio,
    floatingPanelHeightRatio,
    floatingPanelZIndex,
    uiIconScale,
    uiIconStrokeWidth,
    workspaceViewMode,
    workspaceCanvasPaneOpen,
    canvasRenderMode,
    canvas2dRenderer,
    designRendererWebpageLayoutKey,
  } = useGraphStore(
    useShallow(state => ({
      floatingPanelWidthRatio: state.floatingPanelWidthRatio,
      floatingPanelHeightRatio: state.floatingPanelHeightRatio,
      floatingPanelZIndex: state.floatingPanelZIndex,
      uiIconScale: state.uiIconScale,
      uiIconStrokeWidth: state.uiIconStrokeWidth,
      workspaceViewMode: state.workspaceViewMode,
      workspaceCanvasPaneOpen: state.workspaceCanvasPaneOpen,
      canvasRenderMode: state.canvasRenderMode,
      canvas2dRenderer: state.canvas2dRenderer,
      designRendererWebpageLayoutKey: state.designRendererWebpageLayoutKey,
    })),
  )
  const workspaceEditorOverlayOpen = isWorkspaceEditorOverlayOpen({ workspaceViewMode, workspaceCanvasPaneOpen })

  const activeGraphRenderData = useActiveGraphRenderData(true)
  const devStatusMetrics = React.useMemo(() => {
    const isDev = (() => {
      try {
        const m = import.meta as unknown as { env?: unknown }
        const env = m && typeof m.env === 'object' && m.env ? (m.env as Record<string, unknown>) : null
        return env ? env.DEV === true : false
      } catch {
        return false
      }
    })()
    if (!isDev) return null
    const data = activeGraphRenderData
    if (!data) return { counter: 'n0 e0 g0', hierarchyBadge: 'h0', suffix: 'bp:h0 s0 c0 m0' }
    const nodes = Array.isArray(data.nodes) ? data.nodes.length : 0
    const edges = Array.isArray(data.edges) ? data.edges.length : 0
    const groupsDerived = deriveGraphGroups(data, { forceDocumentStructure: false })
    const groups = groupsDerived.length
    const maxDepth = groupsDerived.reduce((m, g) => {
      const d = typeof g.depth === 'number' && Number.isFinite(g.depth) ? Math.max(0, Math.floor(g.depth)) : 0
      return Math.max(m, d)
    }, 0)
    const hierarchyLevels = groups > 0 ? maxDepth + 1 : 0
    const hubs = (Array.isArray(data.nodes) ? data.nodes : []).filter(n => String(n.type || '').trim().toLowerCase() === 'hub').length
    const spokes = (Array.isArray(data.edges) ? data.edges : []).filter(e => String(e.label || '') === 'spokeTo').length
    const crosses = (Array.isArray(data.edges) ? data.edges : []).filter(e => String(e.label || '') === 'linksTo').length
    const members = (Array.isArray(data.nodes) ? data.nodes : []).filter(n => {
      const t = String(n.type || '').trim().toLowerCase()
      return t === 'problem' || t === 'solution'
    }).length
    const suffix = `bp:h${hubs} s${spokes} c${crosses} m${members}`
    return { counter: `n${nodes} e${edges} g${groups}`, hierarchyBadge: `h${hierarchyLevels}`, suffix }
  }, [activeGraphRenderData])

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

  const ensureGeospatialEnabled = React.useCallback(async (): Promise<boolean> => {
    if (geospatialModeEnabled) {
      setGeospatialEnableError(null)
      return true
    }
    setIsEnablingGeospatial(true)
    setGeospatialEnableError(null)
    try {
      const nextEnabled = await enableGeospatialMode(true)
      setGeospatialModeEnabledState(nextEnabled)
      if (!nextEnabled) {
        setGeospatialEnableError('Geospatial Mode is still disabled. Check MainPanel Maps and try again.')
      }
      return nextEnabled
    } catch (err) {
      const message =
        err && typeof err === 'object' && 'message' in err
          ? String((err as { message?: unknown }).message || '').trim()
          : ''
      const fallback = message || 'Unknown error'
      setGeospatialEnableError(`Geospatial Mode failed to load: ${fallback}`)
      try {
        useGraphStore.getState().pushUiToast({
          id: 'floating-geo-enable-error',
          kind: 'error',
          message: `Geospatial Mode failed to load: ${fallback}`,
        })
      } catch {
        void 0
      }
      return false
    } finally {
      setIsEnablingGeospatial(false)
    }
  }, [geospatialModeEnabled])

  const handleSelectView = React.useCallback((view: RequestedFloatingPanelView) => {
    setFloatingPanelView(view)
  }, [setFloatingPanelView])

  const handleFloatingPanelPointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      event.stopPropagation()
      const target = event.target
      if (!(target instanceof Element)) return
      if (
        target.closest(
          UI_SELECTORS.draggablePanelIgnorePointerDown,
        )
      ) {
        return
      }
      if (floatingPanelPinned) return
      try {
        event.preventDefault()
      } catch {
        void 0
      }
      onHeaderPointerDown(event)
    },
    [floatingPanelPinned, onHeaderPointerDown],
  )

  const floatingPanelRootClassName = 'fixed inset-0 pointer-events-none'

  const handlePinToggle = toggleFloatingPanelPinned
  const registerManagedHeaderActions = React.useCallback((actions: FloatingHeaderActions) => {
    setManagedHeaderActions(actions)
  }, [])

  const floatingPanelRootStyle = React.useMemo(() => {
    const safeZ = Number.isFinite(floatingPanelZIndex) ? Math.max(1, Math.floor(floatingPanelZIndex)) : Z_INDEX_FLOATING_PANEL_DEFAULT
    if (floatingPanelPinned) return { zIndex: Math.max(safeZ, 1000) }
    return { zIndex: Math.max(safeZ, workspaceEditorOverlayOpen ? 420 : 90) }
  }, [floatingPanelPinned, floatingPanelZIndex, workspaceEditorOverlayOpen])

  const floatingPanelSizeStyle = React.useMemo(() => {
    const widthRatio = Number.isFinite(floatingPanelWidthRatio) ? floatingPanelWidthRatio : 0.25
    const heightRatio = Number.isFinite(floatingPanelHeightRatio) ? floatingPanelHeightRatio : 0.5
    const safeWidth = Math.max(0.15, Math.min(0.6, widthRatio))
    const safeHeight = Math.max(0.3, Math.min(0.9, heightRatio))
    return {
      width: `min(calc(100vw - 1rem - var(--kg-safe-left) - var(--kg-safe-right)), max(18rem, ${Math.round(safeWidth * 100)}vw))`,
      height: `min(calc(100vh - 1rem - var(--kg-safe-top) - var(--kg-safe-bottom)), max(20rem, ${Math.round(safeHeight * 100)}vh))`,
    }
  }, [floatingPanelWidthRatio, floatingPanelHeightRatio])

  void toolMenuCardRef

  const iconSizeClass = getIconSizeClass(uiIconScale)
  const domPanelsAvailable =
    !geospatialModeEnabled && workspaceViewMode === 'canvas' && canvasRenderMode === '2d' && canvas2dRenderer === 'design'
  const domLayoutReady = domPanelsAvailable && !!designRendererWebpageLayoutKey
  const managedHeaderActionsView: FloatingManagedHeaderActionsView | null =
    floatingPanelView === 'renderer'
      ? floatingPanelView
      : null
  const floatingPanelBodyClassName = cn(
    'mt-1',
    FLOATING_PANEL_FULL_HEIGHT_VIEWS.has(floatingPanelView)
      ? 'flex-1 min-h-0 overflow-hidden'
      : FLOATING_PANEL_SCROLL_CLASSNAME,
    uiPanelTextFontClass,
    uiPanelKeyValueTextSizeClass,
    UI_THEME_TOKENS.text.primary,
  )

  const floatingPanelPrimaryViewButtonSpecs = React.useMemo<FloatingPanelViewButtonSpec[]>(
    () => [
      { view: 'propsPanel', title: UI_LABELS.propsPanel, icon: SlidersHorizontal },
      { view: 'interaction', title: 'Interaction', icon: Hand },
      { view: 'chat', title: UI_LABELS.chat, icon: MessageCircle },
      { view: 'geo', title: UI_LABELS.geo, icon: Map },
      { view: 'renderer', title: UI_LABELS.renderer, icon: MonitorPlay },
    ],
    [],
  )
  const floatingPanelOverflowOptions = React.useMemo<FloatingPanelOverflowOption[]>(
    () => [
      {
        id: 'domTree',
        title: domLayoutReady ? 'DOM Tree' : domPanelsAvailable ? 'DOM Tree (loading)' : 'DOM Tree',
        icon: ListTree,
      },
      {
        id: 'domInspect',
        title: domLayoutReady ? 'Inspect (DOM)' : domPanelsAvailable ? 'Inspect (DOM) (loading)' : 'Inspect (DOM)',
        icon: FileCode,
      },
      {
        id: 'graphTraversal',
        title: UI_LABELS.graphTraversal,
        icon: GitBranch,
      },
    ],
    [domLayoutReady, domPanelsAvailable],
  )
  const visibleOverflowOptions = React.useMemo(
    () => floatingPanelOverflowOptions.filter(option => !option.hidden),
    [floatingPanelOverflowOptions],
  )
  const isOverflowViewActive = floatingPanelView === 'domTree' || floatingPanelView === 'domInspect' || floatingPanelView === 'graphTraversal'
  const overflowValue = React.useMemo(() => {
    if (floatingPanelView === 'domTree' || floatingPanelView === 'domInspect' || floatingPanelView === 'graphTraversal') {
      return floatingPanelView
    }
    const fallback = visibleOverflowOptions.find(option => !option.disabled)?.id ?? visibleOverflowOptions[0]?.id
    return fallback ?? 'graphTraversal'
  }, [floatingPanelView, visibleOverflowOptions])

  const viewButtons = (
    <>
      {floatingPanelPrimaryViewButtonSpecs.map(spec => {
        if (spec.hidden) return null
        const Icon = spec.icon
        return (
          <IconButton
            key={spec.view}
            title={spec.title}
            onClick={() => handleSelectView(spec.view)}
            disabled={spec.disabled}
            className={`App-toolbar__btn ${
              floatingPanelView === spec.view ? uiPrimaryPillActiveClassName : UI_THEME_TOKENS.text.secondary
            }`}
            showTooltip
            data-kg-spotlight-view={spec.spotlightView}
          >
            <Icon className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden={true} />
          </IconButton>
        )
      })}
      {visibleOverflowOptions.length > 0 ? (
        <ToolbarDropdownSelect
          value={overflowValue}
          options={visibleOverflowOptions}
          title="More floating views"
          showTooltip={false}
          isButtonActive={isOverflowViewActive}
          onSelect={id => handleSelectView(id as FloatingPanelView)}
          renderButtonContent={() => <ChevronDown className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />}
          renderOptionContent={option => (
            <>
              <option.icon className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
              <span className="truncate">{option.title}</span>
            </>
          )}
          menuWidthClass="w-56"
        />
      ) : null}
    </>
  )

  React.useEffect(() => {
    return onGeospatialModeChanged(detail => {
      const enabled = typeof detail.enabled === 'boolean' ? detail.enabled : null
      if (enabled == null) return
      setGeospatialModeEnabledState(enabled)
      if (enabled) setGeospatialEnableError(null)
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
  }, [requestedFloatingPanelView, requestedFloatingPanelViewSeq, setFloatingPanelView])

  React.useEffect(() => {
    if (floatingPanelView === 'renderer') return
    setManagedHeaderActions({
      apply: undefined,
      reset: undefined,
      applyDisabled: true,
      resetDisabled: true,
    })
  }, [floatingPanelView])

  React.useEffect(() => {
    const handleOpenGraphTraversal = () => {
      setFloatingPanelMinimized(false)
      setFloatingPanelView('graphTraversal')
    }
    window.addEventListener(GRAPH_TRAVERSAL_FLOATING_PANEL_EVENT, handleOpenGraphTraversal)
    return () => {
      window.removeEventListener(GRAPH_TRAVERSAL_FLOATING_PANEL_EVENT, handleOpenGraphTraversal)
    }
  }, [setFloatingPanelView])

  if (floatingPanelMinimized) {
    return (
      <section className={floatingPanelRootClassName} style={floatingPanelRootStyle}>
        <aside
          ref={toolMenuCardRef}
          className={`pointer-events-auto ModalContainer App-toolbar App-toolbar--compact select-none min-w-0 w-[min(20rem,calc(100vw-1rem))] max-w-[calc(100vw-1rem)] p-0 ${!floatingPanelPinned ? 'cursor-move' : ''}`}
          style={toolMenuCardStyle}
          data-kg-floating-panel-root="true"
        >
          <header className="flex w-full flex-wrap items-start justify-between gap-1 sm:items-center sm:gap-2" onPointerDown={handleFloatingPanelPointerDown}>
            <nav className={`flex min-w-0 flex-1 flex-wrap items-center gap-1 ${uiPanelTextFontClass}`} aria-label="Floating panel views">
              {viewButtons}
              <FloatingPanelHeaderStatus
                pipelineStatus={pipelineStatus}
                devStatusMetrics={devStatusMetrics}
                uiPanelMicroLabelTextSizeClass={uiPanelMicroLabelTextSizeClass}
              />
            </nav>
            <HeaderActions
              onPinToggle={handlePinToggle}
              pinned={floatingPanelPinned}
              onApply={managedHeaderActionsView ? managedHeaderActions.apply : undefined}
              onReset={managedHeaderActionsView ? managedHeaderActions.reset : undefined}
              applyDisabled={managedHeaderActionsView ? managedHeaderActions.applyDisabled : true}
              resetDisabled={managedHeaderActionsView ? managedHeaderActions.resetDisabled : true}
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
        className={`pointer-events-auto ModalContainer flex max-w-[calc(100vw-1rem)] flex-col overflow-hidden p-0 ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.primary}`}
        style={{ ...toolMenuCardStyle, ...floatingPanelSizeStyle }}
        data-kg-floating-panel-root="true"
      >
        <section className="px-2 py-1 flex h-full min-h-[36px] min-w-0 flex-col gap-1" aria-label="Floating panel">
          <header className={`flex w-full flex-wrap items-start justify-between gap-1 select-none sm:items-center sm:gap-2 ${!floatingPanelPinned ? 'cursor-move' : ''}`} onPointerDown={handleFloatingPanelPointerDown}>
            <nav className={`flex min-w-0 flex-1 flex-wrap items-center gap-1 ${uiPanelTextFontClass}`} aria-label="Floating panel views">
              {viewButtons}
              <FloatingPanelHeaderStatus
                pipelineStatus={pipelineStatus}
                exportStatus={exportStatus}
                devStatusMetrics={devStatusMetrics}
                uiPanelMicroLabelTextSizeClass={uiPanelMicroLabelTextSizeClass}
              />
            </nav>
            <HeaderActions
              onPinToggle={handlePinToggle}
              pinned={floatingPanelPinned}
              onApply={managedHeaderActionsView ? managedHeaderActions.apply : undefined}
              onReset={managedHeaderActionsView ? managedHeaderActions.reset : undefined}
              applyDisabled={managedHeaderActionsView ? managedHeaderActions.applyDisabled : true}
              resetDisabled={managedHeaderActionsView ? managedHeaderActions.resetDisabled : true}
              onMinimize={() => {
                setFloatingPanelMinimized(true)
              }}
              onClose={onClose}
            />
          </header>
          <section className={floatingPanelBodyClassName} aria-label={UI_LABELS.floatingPanel}>
            {floatingPanelView === 'propsPanel' && <FloatingPropsPanel />}
            {floatingPanelView === 'interaction' && (
              <section className="h-full flex flex-col" aria-label="Interaction panel">
                <header className={`flex items-center justify-between gap-2 w-full select-none ${UI_THEME_TOKENS.panel.divider}`}>
                  <div className={cn('text-xs font-semibold px-1 py-1', UI_THEME_TOKENS.text.primary)}>Interaction</div>
                </header>
                <section
                  className={cn('mt-1 flex-1 min-h-0 overflow-y-auto overflow-x-hidden', uiPanelTextFontClass, uiPanelKeyValueTextSizeClass)}
                  aria-label="Interaction panel content"
                >
                  <div className="px-1 pb-2">
                    <InfiniteCanvasInteractionPanel />
                  </div>
                </section>
              </section>
            )}
            {floatingPanelView === 'domTree' && <DesignDomTreePanel active={domPanelsAvailable} />}
            {floatingPanelView === 'domInspect' && <DesignDomInspectPanel active={domPanelsAvailable} />}
            {floatingPanelView === 'chat' && (
              <React.Suspense fallback={null}>
                <SidePanelChatLazy />
              </React.Suspense>
            )}
            {floatingPanelView === 'geo' && (
              <GeoView
                geospatialModeEnabled={geospatialModeEnabled}
                isEnablingGeospatial={isEnablingGeospatial}
                geospatialEnableError={geospatialEnableError}
                onEnableGeospatial={() => {
                  void ensureGeospatialEnabled()
                }}
              />
            )}
            {floatingPanelView === 'renderer' && <ToolbarToolMenuRendererView onRegisterActions={registerManagedHeaderActions} />}
            {floatingPanelView === 'graphTraversal' && (
              <section className="space-y-2" aria-label="Graph traversal">
                <header className="flex flex-wrap items-start justify-between gap-2 sm:items-center" aria-label="Graph traversal actions">
                  <nav className="flex flex-wrap items-center gap-2" aria-label="Traversal tools">
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
