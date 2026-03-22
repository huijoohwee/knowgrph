import React, { useCallback, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useGraphStore } from '@/hooks/useGraphStore'
import { useToolbarState } from '@/features/toolbar/hooks/useToolbarState'
import { useMainPanelDrag, type MainPanelTabKey } from '@/features/toolbar/hooks/useMainPanelDrag'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'
import { useLaunchSpotlight } from '@/features/panels/hooks/useLaunchSpotlight'
import { LS_KEYS, UI_COPY } from '@/lib/config'
import { getNextCanvas2dRendererId } from '@/lib/renderer/canvas2dRendererRegistry'
import { lsBool } from '@/lib/persistence'
import { useToolbarActions } from '@/features/toolbar/hooks/useToolbarActions'
import { onGeospatialModeChanged } from '@/features/geospatial/events'
import { useForbidBrowserZoomWheel } from '@/lib/ui/forbidBrowserZoom'
import { getIconSizeClass } from '@/lib/ui'

export type CanvasToolbarCallbacks = {
  onZoomIn?: () => void
  onZoomOut?: () => void
  onReset?: () => void
  onZoomSelection?: () => void
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
    editorWorkspacePane,
    setEditorWorkspacePane,
    themeMode,
    setThemeMode,
    workspaceViewMode,
    toggleWorkspaceViewMode,
    setWorkspaceViewMode,
    renderMediaAsNodes,
    setRenderMediaAsNodes,
    setBehavior,
    canvas2dRenderer,
    setCanvas2dRenderer,
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
      editorWorkspacePane: s.editorWorkspacePane,
      setEditorWorkspacePane: s.setEditorWorkspacePane,
      themeMode: s.themeMode,
      setThemeMode: s.setThemeMode,
      workspaceViewMode: s.workspaceViewMode,
      toggleWorkspaceViewMode: s.toggleWorkspaceViewMode,
      setWorkspaceViewMode: s.setWorkspaceViewMode,
      renderMediaAsNodes: s.renderMediaAsNodes,
      setRenderMediaAsNodes: s.setRenderMediaAsNodes,
      setBehavior: s.setBehavior,
      canvas2dRenderer: s.canvas2dRenderer,
      setCanvas2dRenderer: s.setCanvas2dRenderer,
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

  const layoutMode = schema.layout?.mode || 'force'

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
      const e = ev as CustomEvent<{ tab?: MainPanelTabKey } | undefined>
      const detailTab = e.detail && e.detail.tab
      const tab: MainPanelTabKey =
        detailTab === 'graphFields' ||
        detailTab === 'workflow' ||
        detailTab === 'help' ||
        detailTab === 'preview' ||
        detailTab === 'settings' ||
        detailTab === 'history'
          ? detailTab
          : 'help'
      openMainPanel(tab)
    }
    window.addEventListener(MAIN_PANEL_OPEN_EVENT, handler as EventListener)
    return () => {
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

  const handleCycleCanvas2dRenderer = useCallback(() => {
    if (!ensureBaselineUnlocked()) return
    setCanvas2dRenderer(getNextCanvas2dRendererId(canvas2dRenderer))
  }, [canvas2dRenderer, ensureBaselineUnlocked, setCanvas2dRenderer])

  return {
    actions,
    canvas2dRenderer,
    canvasGridDotRadiusPx,
    canvasGridEnabled,
    canvasGridMajorEvery,
    canvasGridVariant,
    canvasRenderMode,
    clampMainPanelPos,
    documentStructureBaselineLock,
    editorWorkspacePane,
    enableLaunchSpotlight,
    ensureBaselineUnlocked,
    geospatialEnabled,
    graphData,
    groupShapeMode,
    handleCycleCanvas2dRenderer,
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
    setEditorWorkspacePane,
    setFitToScreenMode,
    setGeospatialEnabled,
    setIsMainPanelOpen,
    setMainPanelCollapsed,
    setMainPanelPinned,
    setSchema,
    setSelectMode,
    setSelectionSource,
    setWorkspaceToolbarExpanded,
    setWorkspaceViewMode,
    snapGridEnabled,
    snapGridSize,
    themeMode,
    toggleFitToScreenMode,
    toggleWorkspaceViewMode,
    toolbarCollapsed,
    toolbarNavRef,
    workspaceToolbarExpanded,
    workspaceViewMode,
    zoomToSelectionMode,
  }
}
