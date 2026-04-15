import React, { useCallback, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useToolbarState } from '@/features/toolbar/hooks/useToolbarState'
import { useMainPanelDrag, type MainPanelOpenOptions, type MainPanelTabKey } from '@/features/toolbar/hooks/useMainPanelDrag'
import { MAIN_PANEL_OPEN_EVENT, MAIN_PANEL_OPEN_READY_EVENT } from '@/features/panels/utils/useMainPanelRect'
import { useLaunchSpotlight } from '@/features/panels/hooks/useLaunchSpotlight'
import { LS_KEYS, UI_COPY } from '@/lib/config'
import { lsBool } from '@/lib/persistence'
import { useToolbarActions } from '@/features/toolbar/hooks/useToolbarActions'
import { onGeospatialModeChanged } from '@/features/geospatial/events'
import { useForbidBrowserZoomWheel } from '@/lib/ui/forbidBrowserZoom'
import { getIconSizeClass } from '@/lib/ui'
import { readLayoutMode2d } from '@/lib/graph/layoutMode'

export type CanvasToolbarCallbacks = {
  onZoomIn?: () => void
  onZoomOut?: () => void
  onReset?: () => void
  onZoomSelection?: () => void
}

type MainPanelOpenReadyWindow = Window & {
  __KG_MAIN_PANEL_OPEN_READY__?: boolean
}

export function useCanvasToolbarContext({ onReset, onZoomSelection }: CanvasToolbarCallbacks) {
  const {
    canvasRenderMode,
    setCanvasRenderMode,
    schema,
    setSchema,
    fitToScreenMode,
    toggleFitToScreenMode,
    zoomToSelectionMode,
    setZoomToSelectionMode,
    setFitToScreenMode,
    enableLaunchSpotlight,
    launchSpotlightMode,
    uiIconScale,
    uiIconStrokeWidth,
    uiIconAnimationEnabled,
    selectMode,
    setSelectMode,
  } = useToolbarState()

  const {
    themeMode,
    setThemeMode,
    workspaceViewMode,
    canvas2dRenderer,
    renderMediaAsNodes,
    setRenderMediaAsNodes,
    setBehavior,
    selectedNodeId,
    selectedEdgeId,
    selectedGroupId,
    selectedNodeIds,
    selectedEdgeIds,
    selectedGroupIds,
    selectNode,
    selectEdge,
    selectGroup,
    setSelectionSource,
    documentStructureBaselineLock,
    setDocumentStructureBaselineLock,
    upsertUiToast,
    graphData,
  } = useGraphStore(
    useShallow(s => ({
      themeMode: s.themeMode,
      setThemeMode: s.setThemeMode,
      workspaceViewMode: s.workspaceViewMode,
      canvas2dRenderer: s.canvas2dRenderer,
      renderMediaAsNodes: s.renderMediaAsNodes,
      setRenderMediaAsNodes: s.setRenderMediaAsNodes,
      setBehavior: s.setBehavior,
      selectedNodeId: s.selectedNodeId,
      selectedEdgeId: s.selectedEdgeId,
      selectedGroupId: s.selectedGroupId,
      selectedNodeIds: s.selectedNodeIds,
      selectedEdgeIds: s.selectedEdgeIds,
      selectedGroupIds: s.selectedGroupIds,
      selectNode: s.selectNode,
      selectEdge: s.selectEdge,
      selectGroup: s.selectGroup,
      setSelectionSource: s.setSelectionSource,
      documentStructureBaselineLock: s.documentStructureBaselineLock === true,
      setDocumentStructureBaselineLock: s.setDocumentStructureBaselineLock,
      upsertUiToast: s.upsertUiToast,
      graphData: s.graphData,
    })),
  )

  const {
    isMainPanelOpen,
    setIsMainPanelOpen,
    mainPanelRequestedTab,
    mainPanelRequestedSearchQuery,
    mainPanelCardRef,
    mainPanelPinned,
    setMainPanelPinned,
    mainPanelCollapsed,
    setMainPanelCollapsed,
    mainPanelDragPos,
    openMainPanel,
    handleMainPanelHeaderDragStart,
    handleMainPanelRestore,
    clampMainPanelPos,
  } = useMainPanelDrag()

  const [geospatialEnabled, setGeospatialEnabled] = useState<boolean>(() => {
    try {
      return lsBool(LS_KEYS.geospatialOverlayEnabled, false)
    } catch {
      return false
    }
  })

  const toolbarNavRef = useRef<HTMLElement>(null)
  useForbidBrowserZoomWheel(toolbarNavRef, true)

  const iconSizeClass = getIconSizeClass(uiIconScale)
  const iconStrokeWidth = uiIconStrokeWidth
  const launchIconClass = uiIconAnimationEnabled ? 'LaunchButton__icon' : ''

  const layoutMode = readLayoutMode2d(schema)

  const isWorkspaceOverlayMode = workspaceViewMode === 'editor'
  const snapGridEnabled = !!schema?.behavior?.snapGrid?.enabled
  const snapGridSize =
    typeof schema?.behavior?.snapGrid?.size === 'number' && Number.isFinite(schema.behavior.snapGrid.size)
      ? Math.max(2, Math.floor(schema.behavior.snapGrid.size))
      : 10

  const canvasGridEnabled = !!schema?.behavior?.canvasGrid?.enabled
  const canvasGridVariant: 'lines' | 'dots' = schema?.behavior?.canvasGrid?.variant === 'lines' ? 'lines' : 'dots'
  const canvasGridMajorEvery =
    typeof schema?.behavior?.canvasGrid?.majorEvery === 'number' && Number.isFinite(schema.behavior.canvasGrid.majorEvery)
      ? Math.max(2, Math.min(20, Math.floor(schema.behavior.canvasGrid.majorEvery)))
      : 5
  const canvasGridDotRadiusPx =
    typeof schema?.behavior?.canvasGrid?.dotRadiusPx === 'number' && Number.isFinite(schema.behavior.canvasGrid.dotRadiusPx)
      ? Math.max(0.5, Math.min(6, schema.behavior.canvasGrid.dotRadiusPx))
      : 1

  const canvasGridMinorAlpha =
    typeof (schema?.behavior?.canvasGrid as any)?.minorAlpha === 'number' && Number.isFinite((schema?.behavior?.canvasGrid as any).minorAlpha)
      ? Math.max(0, Math.min(1, (schema?.behavior?.canvasGrid as any).minorAlpha))
      : 0.06
  const canvasGridMajorAlpha =
    typeof (schema?.behavior?.canvasGrid as any)?.majorAlpha === 'number' && Number.isFinite((schema?.behavior?.canvasGrid as any).majorAlpha)
      ? Math.max(0, Math.min(1, (schema?.behavior?.canvasGrid as any).majorAlpha))
      : 0.12
  const canvasGridMinorWidthPx =
    typeof (schema?.behavior?.canvasGrid as any)?.minorWidthPx === 'number' && Number.isFinite((schema?.behavior?.canvasGrid as any).minorWidthPx)
      ? Math.max(0.5, Math.min(4, (schema?.behavior?.canvasGrid as any).minorWidthPx))
      : 1
  const canvasGridMajorWidthPx =
    typeof (schema?.behavior?.canvasGrid as any)?.majorWidthPx === 'number' && Number.isFinite((schema?.behavior?.canvasGrid as any).majorWidthPx)
      ? Math.max(0.5, Math.min(4, (schema?.behavior?.canvasGrid as any).majorWidthPx))
      : 1
  const canvasGridMinorStroke = typeof (schema?.behavior?.canvasGrid as any)?.minorStroke === 'string'
    ? String((schema?.behavior?.canvasGrid as any).minorStroke).trim()
    : ''
  const canvasGridMajorStroke = typeof (schema?.behavior?.canvasGrid as any)?.majorStroke === 'string'
    ? String((schema?.behavior?.canvasGrid as any).majorStroke).trim()
    : ''

  const [workspaceToolbarExpanded, setWorkspaceToolbarExpanded] = useState(true)
  React.useEffect(() => {
    if (!isWorkspaceOverlayMode) return
    setWorkspaceToolbarExpanded(false)
  }, [isWorkspaceOverlayMode])
  const toolbarCollapsed = workspaceToolbarExpanded !== true

  const ensureBaselineUnlocked = useCallback((): boolean => {
    if (documentStructureBaselineLock !== true) return true
    upsertUiToast({
      id: 'baseline-locked',
      kind: 'warning',
      message: UI_COPY.baselineLockedToast,
      ttlMs: 6000,
    })
    return false
  }, [documentStructureBaselineLock, upsertUiToast])

  const hasAnySelection = Boolean(
    selectedNodeId ||
      selectedEdgeId ||
      selectedGroupId ||
      (selectedNodeIds || []).length ||
      (selectedEdgeIds || []).length ||
      (selectedGroupIds || []).length,
  )
  const isNavigateModeActive = !hasAnySelection && !(selectMode === 'multi' || selectMode === 'lasso')

  const portHandlesEnabled = Boolean(schema.behavior?.portHandles?.enabled)
  const rawNodeShapeMode = schema.behavior?.nodeShapeMode
  const nodeShapeMode =
    rawNodeShapeMode === 'rect' || rawNodeShapeMode === 'diamond' || rawNodeShapeMode === 'hex'
      ? rawNodeShapeMode
      : 'circle'
  const groupShapeMode = schema.layout?.groups?.shape === 'geo' ? 'polygon' : 'rect'

  const launchSpotlight = useLaunchSpotlight()
  const actions = useToolbarActions(
    schema,
    setSchema,
    setCanvasRenderMode,
    themeMode,
    setThemeMode,
    launchSpotlight,
    openMainPanel,
    onReset,
    onZoomSelection,
    setZoomToSelectionMode,
    setFitToScreenMode,
    toggleFitToScreenMode,
    fitToScreenMode,
    zoomToSelectionMode,
    renderMediaAsNodes,
    setRenderMediaAsNodes,
    canvasRenderMode,
    setGeospatialEnabled,
  )

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<{ tab?: MainPanelTabKey; searchQuery?: string } | undefined>
      const detailTab = e.detail && e.detail.tab
      const detailSearchQuery = e.detail && typeof e.detail.searchQuery === 'string' ? e.detail.searchQuery : ''
      const tab: MainPanelTabKey =
        detailTab === 'integrations' ||
        detailTab === 'graphFields' ||
        detailTab === 'workflow' ||
        detailTab === 'help' ||
        detailTab === 'preview' ||
        detailTab === 'settings' ||
        detailTab === 'history'
          ? detailTab
          : 'help'
      const options: MainPanelOpenOptions = detailSearchQuery ? { searchQuery: detailSearchQuery } : {}
      openMainPanel(tab, options)
    }
    ;(window as MainPanelOpenReadyWindow).__KG_MAIN_PANEL_OPEN_READY__ = true
    window.addEventListener(MAIN_PANEL_OPEN_EVENT, handler as EventListener)
    const EventCtor = typeof window.Event === 'function' ? window.Event : Event
    window.dispatchEvent(new EventCtor(MAIN_PANEL_OPEN_READY_EVENT))
    return () => {
      ;(window as MainPanelOpenReadyWindow).__KG_MAIN_PANEL_OPEN_READY__ = false
      window.removeEventListener(MAIN_PANEL_OPEN_EVENT, handler as EventListener)
    }
  }, [openMainPanel])

  React.useEffect(() => {
    return onGeospatialModeChanged(detail => {
      const enabled = typeof detail.enabled === 'boolean' ? detail.enabled : null
      if (enabled == null) return
      setGeospatialEnabled(enabled)
    })
  }, [])

  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (isMainPanelOpen) return
    if (lsBool(LS_KEYS.startupOpenWorkflowPanel, false)) {
      openMainPanel('workflow')
    }
  }, [isMainPanelOpen, openMainPanel])

  return {
    actions,
    canvasGridDotRadiusPx,
    canvasGridMajorAlpha,
    canvas2dRenderer,
    canvasGridEnabled,
    canvasGridMajorStroke,
    canvasGridMajorEvery,
    canvasGridMajorWidthPx,
    canvasGridMinorAlpha,
    canvasGridMinorStroke,
    canvasGridMinorWidthPx,
    canvasGridVariant,
    canvasRenderMode,
    clampMainPanelPos,
    documentStructureBaselineLock,
    enableLaunchSpotlight,
    ensureBaselineUnlocked,
    geospatialEnabled,
    graphData,
    groupShapeMode,
    handleMainPanelHeaderDragStart,
    handleMainPanelRestore,
    iconSizeClass,
    iconStrokeWidth,
    isMainPanelOpen,
    isNavigateModeActive,
    isWorkspaceOverlayMode,
    launchIconClass,
    launchSpotlightMode,
    layoutMode,
    mainPanelCardRef,
    mainPanelCollapsed,
    mainPanelDragPos,
    mainPanelPinned,
    mainPanelRequestedTab,
    mainPanelRequestedSearchQuery,
    nodeShapeMode,
    openMainPanel,
    portHandlesEnabled,
    renderMediaAsNodes,
    schema,
    selectEdge,
    selectGroup,
    selectMode,
    selectNode,
    setBehavior,
    setCanvasRenderMode,
    setDocumentStructureBaselineLock,
    setFitToScreenMode,
    setGeospatialEnabled,
    setIsMainPanelOpen,
    setMainPanelCollapsed,
    setMainPanelPinned,
    setSchema,
    setSelectMode,
    setSelectionSource,
    setWorkspaceToolbarExpanded,
    snapGridEnabled,
    snapGridSize,
    themeMode,
    toggleFitToScreenMode,
    toolbarCollapsed,
    toolbarNavRef,
    workspaceToolbarExpanded,
    zoomToSelectionMode,
  }
}
