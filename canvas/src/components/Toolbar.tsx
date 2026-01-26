import React, { useRef, useState } from 'react';
import { ZoomIn, ZoomOut, HelpCircle, Settings, Search as SearchIcon, RotateCcw, Focus, Rocket, History as HistoryIcon, Box, Map, SunMoon, BarChart3, PanelsTopLeft, SlidersHorizontal, ListChecks, CircleDot, Plus, MessageCircle, Image as ImageIcon, GitMerge, Share2, Circle, Square, Hexagon, Diamond, FileText, Tags } from 'lucide-react';
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
import { UI_LABELS, UI_COPY } from '@/lib/config';
import { GraphFieldsIcon } from '@/features/graph-fields/ui/graphFieldIcons';
import { ToolbarMenuLauncher } from '@/features/toolbar/ToolbarMenuLauncher';
import {
  uiPrimaryIconActiveClassName,
  uiPrimaryIconInactiveClassName,
} from '@/features/graph-data-table/ui/GraphDataTableToolbarStyles';
import { useToolbarActions } from '@/features/toolbar/hooks/useToolbarActions';

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
    isSidebarOpen,
    setSidebarOpen,
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
  const [geospatialEnabled, setGeospatialEnabled] = useState(false);

  const searchBtnRef = useRef<HTMLButtonElement>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);

  const themeMode = useGraphStore(s => s.themeMode)
  const setThemeMode = useGraphStore(s => s.setThemeMode)
  const renderMediaAsNodes = useGraphStore(s => s.renderMediaAsNodes);
  const setRenderMediaAsNodes = useGraphStore(s => s.setRenderMediaAsNodes);
  const launchSpotlight = useLaunchSpotlight();
  const iconSizeClass = getIconSizeClass(uiIconScale);
  const iconStrokeWidth = uiIconStrokeWidth;
  const launchIconClass = uiIconAnimationEnabled ? 'LaunchButton__icon' : '';
  const layoutMode = schema.layout?.mode || 'force';
  const frontmatterModeEnabled = useGraphStore(s => s.frontmatterModeEnabled || false);
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
    onZoomIn,
    onZoomOut,
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
    void import('gympgrph')
      .then(m => {
        if (typeof m.isGeospatialModeEnabled !== 'function') return
        setGeospatialEnabled(Boolean(m.isGeospatialModeEnabled()))
      })
      .catch(() => void 0)
  }, []);

  return (
    <nav className="Island App-toolbar App-toolbar--compact w-fit" role="navigation" aria-label="Main Toolbar">
      <ToolbarMenuLauncher onOpenMainPanel={openMainPanel} />

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
          documentSemanticMode === 'keyword' ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName
        }`}
        title={documentSemanticMode === 'keyword' ? UI_LABELS.keywordMode : UI_LABELS.documentStructureMode}
        tooltipContent={documentSemanticMode === 'keyword' ? UI_COPY.keywordModeTooltip : UI_COPY.documentStructureModeTooltip}
        onClick={() => setDocumentSemanticMode(documentSemanticMode === 'keyword' ? 'document' : 'keyword')}
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
        onClick={actions.handleToggleNodeShapeMode}
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
        onClick={actions.handleToggleGroupShapeMode}
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
        onClick={actions.handleTogglePortHandles}
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
        onClick={actions.handleToggleRadialLayout}
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
              onHeaderDragStart={handleMainPanelHeaderDragStart}
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
        className={`App-toolbar__btn ${
          isSidebarOpen ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName
        }`}
        title={UI_LABELS.sidebar}
        onClick={() => setSidebarOpen(!isSidebarOpen)}
        showTooltip
      >
        <PanelsTopLeft className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
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
        onClick={actions.handleToggle3DMode}
        showTooltip
      >
        <Box className={`${iconSizeClass} ${launchIconClass}`} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className={`App-toolbar__btn ${
          geospatialEnabled ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName
        }`}
        title={geospatialEnabled ? UI_COPY.geospatialModeOnTitle : UI_COPY.geospatialModeOffTitle}
        onClick={actions.handleOpenGeospatialMode}
        showTooltip
      >
        {geospatialEnabled ? (
          <Map className={`${iconSizeClass} ${launchIconClass}`} strokeWidth={iconStrokeWidth} />
        ) : (
          <FileText className={`${iconSizeClass} ${launchIconClass}`} strokeWidth={iconStrokeWidth} />
        )}
      </IconButton>
      <div className="App-toolbar__divider" />
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
