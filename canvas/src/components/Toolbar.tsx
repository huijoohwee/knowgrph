import React, { useRef, useState } from 'react';
import { ZoomIn, ZoomOut, HelpCircle, Settings, Search as SearchIcon, RotateCcw, Focus, Grid3x3, Rocket, History as HistoryIcon, Box, Map, SunMoon, BarChart3, SlidersHorizontal, ListChecks, CircleDot, Plus, MessageCircle, Image as ImageIcon, GitMerge, Share2, Circle, Square, Hexagon, Diamond, FileText, FileCode, Table, Lock, Unlock, Pencil, Compass, Palette, ChevronLeft, ChevronRight } from 'lucide-react';
import MainPanel from '@/features/panels/MainPanel';
import IconButton from '@/components/IconButton';
import { DropdownPanel } from '@/lib/ui/overlay';
import SearchPanel from '@/components/SearchPanel';
import { UI_LABELS, UI_COPY } from '@/lib/config';
import { GraphFieldsIcon } from '@/features/graph-fields/ui/graphFieldIcons';
import { ToolbarMenuLauncher } from '@/features/toolbar/ToolbarMenuLauncher';
import {
  uiPrimaryIconActiveClassName,
  uiPrimaryIconInactiveClassName,
} from '@/features/toolbar/ui/toolbarStyles'
import { useCanvasToolbarContext } from '@/components/toolbar/useCanvasToolbarContext';
import { DocumentModeSelect } from '@/components/toolbar/DocumentModeSelect';

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
    groupShapeMode,
    handleCycleCanvas2dRenderer,
    handleMainPanelHeaderDragStart,
    handleMainPanelRestore,
    iconSizeClass,
    iconStrokeWidth,
    isMainPanelOpen,
    isNavigateModeActive,
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
    workspaceViewMode,
    zoomToSelectionMode,
  } = useCanvasToolbarContext({ onReset, onZoomSelection })

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchBtnRef = useRef<HTMLButtonElement>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);

  const navClassBase = 'Island App-toolbar App-toolbar--compact w-fit'

  return (
    <nav
      ref={toolbarNavRef}
      className={`${navClassBase} ${toolbarCollapsed ? 'App-toolbar--collapsed' : ''}`}
      role="navigation"
      aria-label="Main Toolbar"
      data-kg-canvas-wheel-ignore="true"
    >
      {toolbarCollapsed ? (
        <>
          <IconButton
            className="App-toolbar__btn"
            title="Expand toolbar"
            tooltipContent="Expand toolbar"
            onClick={() => setWorkspaceToolbarExpanded(true)}
            showTooltip
          >
            <ChevronLeft className={iconSizeClass} strokeWidth={iconStrokeWidth} />
          </IconButton>
          <div className="hidden">
            <ToolbarMenuLauncher onOpenMainPanel={openMainPanel} />
          </div>
        </>
      ) : (
        <ToolbarMenuLauncher onOpenMainPanel={openMainPanel} />
      )}

      {toolbarCollapsed ? null : (
        <>
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
          workspaceViewMode === 'editor' && editorWorkspacePane === 'graphTable'
            ? uiPrimaryIconActiveClassName
            : uiPrimaryIconInactiveClassName
        }`}
        title={UI_COPY.toolbarGraphDataTableToggleTitle}
        tooltipContent={
          workspaceViewMode === 'editor' && editorWorkspacePane === 'graphTable'
            ? UI_COPY.toolbarGraphDataTableWorkspaceOnTooltip
            : UI_COPY.toolbarGraphDataTableWorkspaceOffTooltip
        }
        onClick={() => {
          if (workspaceViewMode !== 'editor') setWorkspaceViewMode('editor')
          setEditorWorkspacePane(editorWorkspacePane === 'graphTable' ? 'markdown' : 'graphTable')
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
        onClick={handleCycleCanvas2dRenderer}
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
      <DocumentModeSelect
        iconSizeClass={iconSizeClass}
        iconStrokeWidth={iconStrokeWidth}
        ensureBaselineUnlocked={ensureBaselineUnlocked}
      />
      <div className="App-toolbar__divider" />
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
          (snapGridEnabled || canvasGridEnabled) ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName
        }`}
        title={UI_LABELS.grid}
        tooltipContent={UI_COPY.canvasGridTooltip}
        onClick={() => {
          const nextEnabled = !(snapGridEnabled || canvasGridEnabled)
          setBehavior({
            snapGrid: { enabled: nextEnabled, size: snapGridSize },
            canvasGrid: {
              enabled: nextEnabled,
              variant: canvasGridVariant,
              majorEvery: canvasGridMajorEvery,
              dotRadiusPx: canvasGridDotRadiusPx,
            },
          })
        }}
        showTooltip
      >
        <Grid3x3 className={iconSizeClass} strokeWidth={iconStrokeWidth} />
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
      <IconButton
        className="App-toolbar__btn"
        title="Collapse toolbar"
        tooltipContent="Collapse toolbar"
        onClick={() => setWorkspaceToolbarExpanded(false)}
        showTooltip
      >
        <ChevronRight className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
        </>
      )}
    </nav>
  );
}
