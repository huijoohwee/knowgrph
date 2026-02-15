import React, { useCallback, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, HelpCircle, Settings, Search as SearchIcon, RotateCcw, Focus, Rocket, History as HistoryIcon, Box, Map, SunMoon, BarChart3, SlidersHorizontal, ListChecks, CircleDot, Plus, MessageCircle, Image as ImageIcon, GitMerge, Share2, Circle, Square, Hexagon, Diamond, FileText, Tags, FileCode, Table, Lock, Unlock, Pencil, Compass, Palette } from 'lucide-react';
import { useGraphStore } from '@/hooks/useGraphStore';
import { useToolbarState } from '@/features/toolbar/hooks/useToolbarState';
import { useMainPanelDrag, type MainPanelTabKey } from '@/features/toolbar/hooks/useMainPanelDrag';
import MainPanel from '@/features/panels/MainPanel';
import IconButton from '@/components/IconButton';
import { DropdownPanel } from '@/lib/ui/overlay';
import { getIconSizeClass } from '@/lib/ui';
import SearchPanel from '@/components/SearchPanel';
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect';
import { useLaunchSpotlight } from '@/features/panels/hooks/useLaunchSpotlight';
import { LS_KEYS, UI_LABELS, UI_COPY } from '@/lib/config';
import { getNextCanvas2dRendererId } from '@/lib/renderer/canvas2dRendererRegistry'
import { lsBool } from '@/lib/persistence'
import { GraphFieldsIcon } from '@/features/graph-fields/ui/graphFieldIcons';
import { ToolbarMenuLauncher } from '@/features/toolbar/ToolbarMenuLauncher';
import {
  uiPrimaryIconActiveClassName,
  uiPrimaryIconInactiveClassName,
} from '@/features/graph-data-table/ui/GraphDataTableToolbarStyles';
import { useToolbarActions } from '@/features/toolbar/hooks/useToolbarActions';
import { onGeospatialModeChanged } from '@/features/geospatial/events'

import { CANVAS_INTERACTION_MODE_LABELS } from '@/lib/canvas/interaction-ssot'

import { FitToScreenButton } from '@/features/toolbar/ui/FitToScreenButton';
import { FitToViewButton } from '@/features/toolbar/ui/FitToViewButton';
import { PinToViewButton } from '@/features/toolbar/ui/PinToViewButton';

interface ToolbarProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onReset?: () => void;
  onZoomSelection?: () => void;
}

export default function Toolbar({ onZoomIn, onZoomOut, onReset, onZoomSelection }: ToolbarProps) {
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
  } = useToolbarState();

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
  } = useMainPanelDrag();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [geospatialEnabled, setGeospatialEnabled] = useState<boolean>(() => {
    try {
      return lsBool(LS_KEYS.geospatialOverlayEnabled, false)
    } catch {
      return false
    }
  })

  const searchBtnRef = useRef<HTMLButtonElement>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);

  const themeMode = useGraphStore(s => s.themeMode)
  const setThemeMode = useGraphStore(s => s.setThemeMode)
  const workspaceViewMode = useGraphStore(s => s.workspaceViewMode)
  const toggleWorkspaceViewMode = useGraphStore(s => s.toggleWorkspaceViewMode)
  const setWorkspaceViewMode = useGraphStore(s => s.setWorkspaceViewMode)
  const editorWorkspaceSection = useGraphStore(s => s.editorWorkspaceSection)
  const setEditorWorkspaceSection = useGraphStore(s => s.setEditorWorkspaceSection)
  const renderMediaAsNodes = useGraphStore(s => s.renderMediaAsNodes);
  const setRenderMediaAsNodes = useGraphStore(s => s.setRenderMediaAsNodes);
  const canvas2dRenderer = useGraphStore(s => s.canvas2dRenderer)
  const setCanvas2dRenderer = useGraphStore(s => s.setCanvas2dRenderer)
  const selectedNodeId = useGraphStore(s => s.selectedNodeId)
  const selectedEdgeId = useGraphStore(s => s.selectedEdgeId)
  const selectedGroupId = useGraphStore(s => s.selectedGroupId)
  const selectedNodeIds = useGraphStore(s => s.selectedNodeIds)
  const selectedEdgeIds = useGraphStore(s => s.selectedEdgeIds)
  const selectedGroupIds = useGraphStore(s => s.selectedGroupIds)
  const selectNode = useGraphStore(s => s.selectNode)
  const selectEdge = useGraphStore(s => s.selectEdge)
  const selectGroup = useGraphStore(s => s.selectGroup)
  const setSelectionSource = useGraphStore(s => s.setSelectionSource)
  const launchSpotlight = useLaunchSpotlight();
  const iconSizeClass = getIconSizeClass(uiIconScale);
  const iconStrokeWidth = uiIconStrokeWidth;
  const launchIconClass = uiIconAnimationEnabled ? 'LaunchButton__icon' : '';
  const layoutMode = schema.layout?.mode || 'force';
  const frontmatterModeEnabled = useGraphStore(s => s.frontmatterModeEnabled || false);
  const documentStructureBaselineLock = useGraphStore(s => s.documentStructureBaselineLock === true)
  const setDocumentStructureBaselineLock = useGraphStore(s => s.setDocumentStructureBaselineLock)
  const upsertUiToast = useGraphStore(s => s.upsertUiToast)

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
  const setFrontmatterModeEnabled = useGraphStore(s => s.setFrontmatterModeEnabled);
  const portHandlesEnabled = Boolean(schema.behavior?.portHandles?.enabled);
  const rawNodeShapeMode = schema.behavior?.nodeShapeMode
  const nodeShapeMode =
    rawNodeShapeMode === 'rect' || rawNodeShapeMode === 'diamond' || rawNodeShapeMode === 'hex'
      ? rawNodeShapeMode
      : 'circle'
  const groupShapeMode = schema.layout?.groups?.shape === 'geo' ? 'polygon' : 'rect'
  const documentSemanticMode = useGraphStore(s => s.documentSemanticMode || 'document')
  const setDocumentSemanticMode = useGraphStore(s => s.setDocumentSemanticMode)
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
  );

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<{ tab?: MainPanelTabKey } | undefined>;
      const detailTab = e.detail && e.detail.tab;
      const tab: MainPanelTabKey =
        detailTab === 'graphFields'
          || detailTab === 'workflow'
          || detailTab === 'help'
          || detailTab === 'preview'
          || detailTab === 'settings'
          || detailTab === 'history'
          ? detailTab
          : 'help';
      openMainPanel(tab);
    };
    window.addEventListener(MAIN_PANEL_OPEN_EVENT, handler as EventListener);
    return () => {
      window.removeEventListener(MAIN_PANEL_OPEN_EVENT, handler as EventListener);
    };
  }, [openMainPanel]);

  React.useEffect(() => {
    return onGeospatialModeChanged(detail => {
      const enabled = typeof detail.enabled === 'boolean' ? detail.enabled : null
      if (enabled == null) return
      setGeospatialEnabled(enabled)
    })
  }, [])

  return (
    <nav className="Island App-toolbar App-toolbar--compact w-fit" role="navigation" aria-label="Main Toolbar" data-kg-canvas-wheel-ignore="true">
      <ToolbarMenuLauncher onOpenMainPanel={openMainPanel} />

      <IconButton
        className={`App-toolbar__btn ${
          workspaceViewMode === 'editor' ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName
        }`}
        title={UI_LABELS.editor}
        tooltipContent={
          workspaceViewMode === 'editor'
            ? UI_COPY.toolbarEditorWorkspaceOnTooltip
            : UI_COPY.toolbarEditorWorkspaceOffTooltip
        }
        onClick={toggleWorkspaceViewMode}
        showTooltip
      >
        <FileCode className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>

      <IconButton
        className={`App-toolbar__btn ${
          workspaceViewMode === 'table' || (workspaceViewMode === 'editor' && editorWorkspaceSection === 'graphTable')
            ? uiPrimaryIconActiveClassName
            : uiPrimaryIconInactiveClassName
        }`}
        title={UI_COPY.toolbarGraphDataTableToggleTitle}
        tooltipContent={
          workspaceViewMode === 'table' || (workspaceViewMode === 'editor' && editorWorkspaceSection === 'graphTable')
            ? UI_COPY.toolbarGraphDataTableWorkspaceOnTooltip
            : UI_COPY.toolbarGraphDataTableWorkspaceOffTooltip
        }
        onClick={() => {
          if (workspaceViewMode === 'editor') {
            setEditorWorkspaceSection(editorWorkspaceSection === 'graphTable' ? 'markdown' : 'graphTable')
            return
          }
          setWorkspaceViewMode(workspaceViewMode === 'table' ? 'canvas' : 'table')
        }}
        showTooltip
      >
        <Table className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>

      <IconButton
        className={`App-toolbar__btn ${
          enableLaunchSpotlight && launchSpotlightMode === 'stats'
            ? uiPrimaryIconActiveClassName
            : uiPrimaryIconInactiveClassName
        }`}
        title={UI_LABELS.status}
        tooltipContent={UI_LABELS.status}
        onClick={actions.handleLaunchStats}
        showTooltip
      >
        <BarChart3 className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>

      <IconButton
        className={`App-toolbar__btn ${
          isNavigateModeActive ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName
        }`}
        title={CANVAS_INTERACTION_MODE_LABELS.navigate}
        tooltipContent="Navigate (clear selection)"
        onClick={() => {
          if (!ensureBaselineUnlocked()) return
          setSelectionSource('toolbar')
          setSelectMode('single')
          selectNode(null)
          selectEdge(null)
          selectGroup(null)
        }}
        showTooltip
      >
        <Compass className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>

      <IconButton
        className={`App-toolbar__btn ${
          documentStructureBaselineLock ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName
        }`}
        title={documentStructureBaselineLock ? 'Baseline lock on' : 'Baseline lock off'}
        tooltipContent={
          documentStructureBaselineLock
            ? 'Mode switches are locked to keep surfaces aligned. Click to unlock.'
            : 'Mode switches are unlocked. Click to lock to the baseline.'
        }
        onClick={() => setDocumentStructureBaselineLock(!documentStructureBaselineLock)}
        showTooltip
      >
        {documentStructureBaselineLock ? (
          <Lock className={iconSizeClass} strokeWidth={iconStrokeWidth} />
        ) : (
          <Unlock className={iconSizeClass} strokeWidth={iconStrokeWidth} />
        )}
      </IconButton>

      <IconButton
        className={`App-toolbar__btn ${
          canvasRenderMode === '2d' && canvas2dRenderer !== 'd3'
            ? uiPrimaryIconActiveClassName
            : uiPrimaryIconInactiveClassName
        }`}
        title={
          canvas2dRenderer === 'flowEditor'
            ? UI_COPY.twoDRendererFlowEditorTitle
            : canvas2dRenderer === 'flow'
              ? UI_COPY.twoDRendererFlowTitle
              : canvas2dRenderer === 'design'
                ? UI_COPY.twoDRendererDesignTitle
              : UI_COPY.twoDRendererD3Title
        }
        tooltipContent={UI_COPY.twoDRendererToggleTooltip}
        disabled={canvasRenderMode !== '2d' || geospatialEnabled}
        onClick={() => {
          if (!ensureBaselineUnlocked()) return
          setCanvas2dRenderer(getNextCanvas2dRendererId(canvas2dRenderer))
        }}
        showTooltip
      >
        {canvas2dRenderer === 'flowEditor' ? (
          <div className="flex items-center gap-1">
            <Pencil className={iconSizeClass} strokeWidth={iconStrokeWidth} />
            <span className="text-xs">Edit</span>
          </div>
        ) : canvas2dRenderer === 'design' ? (
          <div className="flex items-center gap-1">
            <Palette className={iconSizeClass} strokeWidth={iconStrokeWidth} />
            <span className="text-xs">Design</span>
          </div>
        ) : canvas2dRenderer === 'flow' ? (
          <div className="flex items-center gap-1">
            <GitMerge className={iconSizeClass} strokeWidth={iconStrokeWidth} />
            <span className="text-xs">Flow</span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <CircleDot className={iconSizeClass} strokeWidth={iconStrokeWidth} />
            <span className="text-xs">D3</span>
          </div>
        )}
      </IconButton>
      <IconButton
        className={`App-toolbar__btn ${
          documentSemanticMode === 'keyword' ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName
        }`}
        title={documentSemanticMode === 'keyword' ? UI_LABELS.keywordMode : UI_LABELS.documentStructureMode}
        tooltipContent={documentSemanticMode === 'keyword' ? UI_COPY.keywordModeTooltip : UI_COPY.documentStructureModeTooltip}
        onClick={() => {
          if (!ensureBaselineUnlocked()) return
          setDocumentSemanticMode(documentSemanticMode === 'keyword' ? 'document' : 'keyword')
        }}
        showTooltip
      >
        {documentSemanticMode === 'keyword' ? (
          <Tags className={iconSizeClass} strokeWidth={iconStrokeWidth} />
        ) : (
          <FileText className={iconSizeClass} strokeWidth={iconStrokeWidth} />
        )}
      </IconButton>
      <IconButton
        className={`App-toolbar__btn ${
          nodeShapeMode !== 'circle' ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName
        }`}
        title={UI_LABELS.nodeShapeMode}
        tooltipContent={UI_COPY.nodeShapeModeTooltip}
        onClick={() => {
          if (!ensureBaselineUnlocked()) return
          actions.handleToggleNodeShapeMode()
        }}
        showTooltip
      >
        {nodeShapeMode === 'rect' ? (
          <Square className={iconSizeClass} strokeWidth={iconStrokeWidth} />
        ) : nodeShapeMode === 'diamond' ? (
          <Diamond className={iconSizeClass} strokeWidth={iconStrokeWidth} />
        ) : nodeShapeMode === 'hex' ? (
          <Hexagon className={iconSizeClass} strokeWidth={iconStrokeWidth} />
        ) : (
          <Circle className={iconSizeClass} strokeWidth={iconStrokeWidth} />
        )}
      </IconButton>
      <IconButton
        className={`App-toolbar__btn ${
          frontmatterModeEnabled ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName
        }`}
        title={frontmatterModeEnabled ? UI_LABELS.frontmatterModeMermaidFocus : UI_LABELS.frontmatterMode}
        tooltipContent={
          frontmatterModeEnabled
            ? UI_COPY.frontmatterModeTooltip
            : UI_COPY.frontmatterModeToggleTooltip
        }
        onClick={() => {
          if (!ensureBaselineUnlocked()) return
          const next = !frontmatterModeEnabled;
          setFrontmatterModeEnabled(next);
        }}
        showTooltip
      >
        <GitMerge className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className={`App-toolbar__btn ${
          groupShapeMode === 'rect' ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName
        }`}
        title={groupShapeMode === 'rect' ? UI_LABELS.groupShapeRect : UI_LABELS.groupShapePolygon}
        tooltipContent={groupShapeMode === 'rect' ? UI_COPY.groupShapeRectTooltip : UI_COPY.groupShapePolygonTooltip}
        onClick={() => {
          if (!ensureBaselineUnlocked()) return
          actions.handleToggleGroupShapeMode()
        }}
        showTooltip
      >
        {groupShapeMode === 'rect' ? (
          <Square className={iconSizeClass} strokeWidth={iconStrokeWidth} />
        ) : (
          <Hexagon className={iconSizeClass} strokeWidth={iconStrokeWidth} />
        )}
      </IconButton>
      <IconButton
        className={`App-toolbar__btn ${
          selectMode === 'multi' || selectMode === 'lasso'
            ? uiPrimaryIconActiveClassName
            : uiPrimaryIconInactiveClassName
        }`}
        title={UI_LABELS.multiSelectMode}
        tooltipContent={UI_LABELS.multiSelectMode}
        onClick={() => {
          if (!ensureBaselineUnlocked()) return
          setSelectMode(selectMode === 'multi' || selectMode === 'lasso' ? 'single' : 'multi')
        }}
        showTooltip
      >
        <ListChecks className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className={`App-toolbar__btn ${
          portHandlesEnabled ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName
        }`}
        title={UI_LABELS.portHandles}
        tooltipContent={UI_COPY.portHandlesTooltip}
        onClick={() => {
          if (!ensureBaselineUnlocked()) return
          actions.handleTogglePortHandles()
        }}
        showTooltip
      >
        <Share2 className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className={`App-toolbar__btn ${
          canvasRenderMode === '2d' && layoutMode === 'radial'
            ? uiPrimaryIconActiveClassName
            : uiPrimaryIconInactiveClassName
        }`}
        title={UI_LABELS.radialLayoutMode}
        tooltipContent={UI_LABELS.radialLayoutMode}
        onClick={() => {
          if (!ensureBaselineUnlocked()) return
          actions.handleToggleRadialLayout()
        }}
        showTooltip
      >
        <CircleDot className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className="App-toolbar__btn"
        title={UI_LABELS.graphFields}
        tooltipContent={UI_LABELS.graphFields}
        onClick={actions.handleOpenGraphFields}
        showTooltip
      >
        <GraphFieldsIcon className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className="App-toolbar__btn"
        title={UI_LABELS.settings}
        tooltipContent={UI_LABELS.settings}
        onClick={actions.handleOpenSettings}
        showTooltip
      >
        <Settings className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      {isMainPanelOpen && (
        <div className={mainPanelPinned ? 'fixed inset-0 z-[2000] pointer-events-none' : 'fixed inset-0 z-[80] pointer-events-none'}>
          <div
            ref={mainPanelCardRef}
            className={[
              'pointer-events-auto',
              mainPanelCollapsed ? 'w-[80vw] max-w-[1200px] h-fit' : 'w-[80vw] h-[80vh] max-w-[1200px] max-h-[800px]',
            ].join(' ')}
            style={{
              position: 'absolute',
              top: clampMainPanelPos(mainPanelDragPos).top,
              left: clampMainPanelPos(mainPanelDragPos).left,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <MainPanel
              onClose={() => setIsMainPanelOpen(false)}
                onHeaderDragStart={!mainPanelPinned ? handleMainPanelHeaderDragStart : undefined}
              requestedTab={mainPanelRequestedTab}
              collapsed={mainPanelCollapsed}
              pinned={mainPanelPinned}
              onMinimize={() => setMainPanelCollapsed(true)}
              onRestore={handleMainPanelRestore}
              onPinToggle={() => setMainPanelPinned(v => !v)}
            />
          </div>
        </div>
      )}

      <IconButton className="App-toolbar__btn" title={UI_LABELS.history} onClick={actions.handleOpenHistory} showTooltip>
        <HistoryIcon className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>

      <IconButton className="App-toolbar__btn" title={UI_LABELS.help} onClick={actions.handleOpenHelp} showTooltip>
        <HelpCircle className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>

      <div className="App-toolbar__divider" />
      <IconButton
        className="App-toolbar__btn"
        title={UI_LABELS.propsPanel}
        onClick={actions.handleOpenPropsPanel}
        showTooltip
      >
        <SlidersHorizontal className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className="App-toolbar__btn"
        title={UI_LABELS.createNode}
        tooltipContent={UI_LABELS.createNode}
        onClick={actions.handleOpenPropsPanel}
        showTooltip
      >
        <Plus className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className="App-toolbar__btn"
        title={UI_LABELS.reset}
        onClick={actions.handleReset}
        showTooltip
      >
        <RotateCcw className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton className="App-toolbar__btn" title={UI_LABELS.zoomIn} onClick={onZoomIn} showTooltip>
        <ZoomIn className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton className="App-toolbar__btn" title={UI_LABELS.zoomOut} onClick={onZoomOut} showTooltip>
        <ZoomOut className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <PinToViewButton />
      <FitToViewButton />
      <FitToScreenButton />
      <IconButton
        className={`App-toolbar__btn ${
          zoomToSelectionMode ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName
        }`}
        title={UI_LABELS.zoomToSelection}
        tooltipContent={UI_COPY.zoomToSelectionTooltip}
        onClick={actions.handleToggleZoomToSelection}
        showTooltip
      >
        <Focus className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className={`App-toolbar__btn ${
          renderMediaAsNodes ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName
        }`}
        title={renderMediaAsNodes ? UI_LABELS.renderMediaAsNodesOn : UI_LABELS.renderMediaAsNodesOff}
        tooltipContent={UI_COPY.renderMediaAsNodesTooltip}
        onClick={actions.handleToggleRenderMedia}
        showTooltip
      >
        <ImageIcon className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className={`App-toolbar__btn ${
          canvasRenderMode === '3d' ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName
        }`}
        title={canvasRenderMode === '3d' ? UI_COPY.threeDModeOnTitle : UI_COPY.threeDModeOffTitle}
        onClick={() => {
          if (!ensureBaselineUnlocked()) return
          actions.handleToggle3DMode()
        }}
        disabled={geospatialEnabled}
        showTooltip
      >
        <Box className={`${iconSizeClass} ${launchIconClass}`} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className={`App-toolbar__btn ${
          geospatialEnabled ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName
        }`}
        title={geospatialEnabled ? UI_COPY.geospatialModeOnTitle : UI_COPY.geospatialModeOffTitle}
        onClick={() => {
          if (!ensureBaselineUnlocked()) return
          actions.handleOpenGeospatialMode()
        }}
        showTooltip
      >
        {geospatialEnabled ? (
          <Map className={`${iconSizeClass} ${launchIconClass}`} strokeWidth={iconStrokeWidth} />
        ) : (
          <FileText className={`${iconSizeClass} ${launchIconClass}`} strokeWidth={iconStrokeWidth} />
        )}
      </IconButton>
      <hr className="App-toolbar__divider" aria-hidden="true" />
      <IconButton
        className="App-toolbar__btn"
        ref={searchBtnRef}
        title={UI_LABELS.search}
        onClick={() => setIsSearchOpen(v => !v)}
        showTooltip
      >
        <SearchIcon className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className="App-toolbar__btn"
        title={UI_LABELS.chat}
        tooltipContent={UI_LABELS.chat}
        onClick={actions.handleOpenChat}
        showTooltip
      >
        <MessageCircle className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      {isSearchOpen && (
        <DropdownPanel
          anchorRef={searchBtnRef}
          open={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          align="bottom-center"
        >
          <SearchPanel ref={searchPanelRef} onClose={() => setIsSearchOpen(false)} />
        </DropdownPanel>
      )}

      <IconButton
        className={`App-toolbar__btn ${
          enableLaunchSpotlight ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName
        }`}
        title={UI_LABELS.launch}
        tooltipContent={UI_LABELS.launch}
        onClick={actions.handleLaunch}
        showTooltip
      >
        <Rocket className={`${iconSizeClass} ${launchIconClass}`} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className={`App-toolbar__btn ${
          themeMode === 'dark' ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName
        }`}
        title={`${UI_COPY.themeTooltipPrefix}${themeMode === 'system' ? UI_LABELS.themeSystem : themeMode === 'light' ? UI_LABELS.themeLight : UI_LABELS.themeDark}`}
        onClick={actions.handleToggleTheme}
        showTooltip
      >
        <SunMoon className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
    </nav>
  );
}
