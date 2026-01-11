import React, { useRef, useState } from 'react';
import { ZoomIn, ZoomOut, Maximize, HelpCircle, Settings, Search as SearchIcon, RotateCcw, Focus, Rocket, History as HistoryIcon, Box, SunMoon, BarChart3, PanelsTopLeft, SlidersHorizontal, ListChecks, CircleDot, TreePine, Plus, MessageCircle, Image as ImageIcon, Layers, Shapes } from 'lucide-react';
import { useGraphStore } from '@/hooks/useGraphStore';
import { useToolbarState } from '@/features/toolbar/hooks/useToolbarState';
import { useMainPanelDrag, type MainPanelTabKey } from '@/features/toolbar/hooks/useMainPanelDrag';
import MainPanel from '@/features/panels/MainPanel';
import IconButton from '@/components/IconButton';
import { openBottomPanel } from '@/features/bottom-panel/open';
import { DropdownPanel } from '@/lib/ui/overlay';
import { getIconSizeClass } from '@/lib/ui';
import SearchPanel from '@/components/SearchPanel';
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect';
import { useLaunchSpotlight } from '@/features/panels/hooks/useLaunchSpotlight';
import { ThemeMode, applyThemeMode, getInitialThemeMode, getNextThemeMode, persistThemeMode } from '@/lib/ui/theme';
import { UI_LABELS } from '@/lib/config';
import { getLocalStorage } from '@/lib/persistence';
import { GraphFieldsIcon } from '@/features/graph-fields/ui/graphFieldIcons';
import { ToolbarMenuLauncher } from '@/features/toolbar/ToolbarMenuLauncher';
import { emitPropsPanelOpen, emitSidePanelOpen } from '@/features/canvas/utils';
import { deriveTidyTreeDerivation, normalizeEdgesForSim } from '@/components/GraphCanvas/simulation';

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
    graphLayersVisible,
    toggleGraphLayersVisible,
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

  const searchBtnRef = useRef<HTMLButtonElement>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return getInitialThemeMode(getLocalStorage());
  });
  const renderMediaAsNodes = useGraphStore(s => s.renderMediaAsNodes);
  const setRenderMediaAsNodes = useGraphStore(s => s.setRenderMediaAsNodes);
  const launchSpotlight = useLaunchSpotlight();
  const iconSizeClass = getIconSizeClass(uiIconScale);
  const iconStrokeWidth = uiIconStrokeWidth;
  const launchIconClass = uiIconAnimationEnabled ? 'LaunchButton__icon' : '';
  const layoutMode = schema.layout?.mode || 'force';
  const rawLayerMode = schema.layers?.mode;
  const layerMode: 'property' | 'document-structure' | 'semantic' =
    rawLayerMode === 'property' || rawLayerMode === 'document-structure' || rawLayerMode === 'semantic'
      ? rawLayerMode
      : 'semantic';
  const layerModeDescriptor =
    layerMode === 'property'
      ? 'Raw data (schema)'
      : layerMode === 'document-structure'
        ? 'Layered structure (document)'
        : 'Similarity clusters (semantic)';
  const layerModeTitle = `${UI_LABELS.layerMode}: ${layerModeDescriptor}`;
  const LayerModeIcon =
    layerMode === 'property' ? PanelsTopLeft : layerMode === 'document-structure' ? Layers : CircleDot;



  React.useEffect(() => {
    applyThemeMode(themeMode);
    if (typeof window === 'undefined') return;
    persistThemeMode(getLocalStorage(), themeMode);

    if (themeMode !== 'system') return;
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyThemeMode('system');
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }
  }, [themeMode]);

  React.useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (ev: Event) => {
      const e = ev as CustomEvent<{ tab?: MainPanelTabKey } | undefined>;
      const detailTab = e.detail && e.detail.tab;
      const tab: MainPanelTabKey =
        detailTab === 'graphFields'
          || detailTab === 'graphLayer'
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

  return (
    <div className="Island App-toolbar App-toolbar--compact w-fit">
      <ToolbarMenuLauncher onOpenMainPanel={openMainPanel} />

      <IconButton
        className={`App-toolbar__btn ${enableLaunchSpotlight && launchSpotlightMode === 'stats' ? 'text-blue-600' : 'text-gray-600'}`}
        title="Status"
        tooltipContent="Status"
        onClick={() => launchSpotlight('stats')}
        showTooltip
      >
        <BarChart3 className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className={`App-toolbar__btn ${selectMode === 'multi' || selectMode === 'lasso' ? 'text-blue-600' : 'text-gray-600'}`}
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
        className={`App-toolbar__btn ${layerMode !== 'property' ? 'text-blue-600' : 'text-gray-600'}`}
        title={layerModeTitle}
        tooltipContent={layerModeTitle}
        onClick={() => {
          const currentLayers = schema.layers || {};
          const currentMode = currentLayers.mode || 'semantic';
          const nextMode: 'property' | 'document-structure' | 'semantic' =
            currentMode === 'semantic'
              ? 'document-structure'
              : currentMode === 'document-structure'
                ? 'property'
                : 'semantic';
          const next = {
            ...schema,
            layers: {
              ...currentLayers,
              mode: nextMode,
            },
          };
          setSchema(next);
        }}
        showTooltip
      >
        <LayerModeIcon className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className={`App-toolbar__btn ${graphLayersVisible ? 'text-blue-600' : 'text-gray-600'}`}
        title={UI_LABELS.graphLayersMode}
        tooltipContent={UI_LABELS.graphLayersMode}
        onClick={toggleGraphLayersVisible}
        showTooltip
      >
        <Shapes className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className={`App-toolbar__btn ${canvasRenderMode === '2d' && layoutMode === 'tidy-tree' ? 'text-blue-600' : 'text-gray-600'}`}
        title={UI_LABELS.tidyTreeLayoutMode}
        tooltipContent={UI_LABELS.tidyTreeLayoutMode}
        onClick={() => {
          const current = schema;
          const layout = current.layout || {};
          const nextMode: 'force' | 'radial' | 'tidy-tree' =
            layout.mode === 'tidy-tree' ? 'force' : 'tidy-tree';
          const baseNext: typeof current = {
            ...current,
            layout: { ...layout, mode: nextMode },
          };

          const next = (() => {
            if (nextMode !== 'tidy-tree') return baseNext;
            const tidyCfg = baseNext.layout?.tidyTree;
            const rawEdgeLabels = tidyCfg?.edgeLabels;
            const configuredLabels =
              Array.isArray(rawEdgeLabels)
                ? rawEdgeLabels.map(v => String(v || '').trim()).filter(Boolean)
                : [];
            const shouldResolveLabels = configuredLabels.length === 0;
            const shouldResolveDirection = !tidyCfg?.direction || tidyCfg.direction === 'auto';
            if (!shouldResolveLabels && !shouldResolveDirection) return baseNext;

            try {
              const graphData = useGraphStore.getState().graphData;
              const nodes = graphData?.nodes || [];
              const edges = graphData?.edges || [];
              if (!nodes.length) return baseNext;

              const edgesForSim = normalizeEdgesForSim(nodes, edges);
              const nodeIds = new Set<string>(nodes.map(n => String(n.id)));
              const derivation = deriveTidyTreeDerivation(edgesForSim, baseNext, nodeIds);
              if (!derivation) return baseNext;

              const nextTidyTree = { ...(tidyCfg || {}) };
              let changed = false;

              if (shouldResolveLabels && derivation.labelSet.size > 0) {
                nextTidyTree.edgeLabels = Array.from(derivation.labelSet).sort((a, b) => a.localeCompare(b));
                changed = true;
              }
              if (shouldResolveDirection) {
                nextTidyTree.direction = derivation.direction;
                changed = true;
              }
              if (!changed) return baseNext;

              return {
                ...baseNext,
                layout: { ...(baseNext.layout || {}), tidyTree: nextTidyTree },
              };
            } catch {
              return baseNext;
            }
          })();

          setSchema(next);
          if (nextMode === 'tidy-tree') {
            setCanvasRenderMode('2d');
          }
        }}
        showTooltip
      >
        <TreePine className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className={`App-toolbar__btn ${canvasRenderMode === '2d' && layoutMode === 'radial' ? 'text-blue-600' : 'text-gray-600'}`}
        title={UI_LABELS.radialLayoutMode}
        tooltipContent={UI_LABELS.radialLayoutMode}
        onClick={() => {
          const current = schema;
          const layout = current.layout || {};
          const nextMode: 'force' | 'radial' | 'tidy-tree' = layout.mode === 'radial' ? 'force' : 'radial';
          const next = {
            ...current,
            layout: { ...layout, mode: nextMode },
          };
          setSchema(next);
          if (nextMode === 'radial') {
            setCanvasRenderMode('2d');
          }
        }}
        showTooltip
      >
        <CircleDot className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className="App-toolbar__btn"
        title={UI_LABELS.graphFields}
        tooltipContent={UI_LABELS.graphFields}
        onClick={() => {
          openMainPanel('graphFields');
        }}
        showTooltip
      >
        <GraphFieldsIcon className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className="App-toolbar__btn"
        title={UI_LABELS.settings}
        tooltipContent={UI_LABELS.settings}
        onClick={() => {
          openMainPanel('settings');
        }}
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

      <IconButton className="App-toolbar__btn" title={UI_LABELS.history} onClick={() => { openBottomPanel('history'); }} showTooltip>
        <HistoryIcon className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>

      <IconButton className="App-toolbar__btn" title={UI_LABELS.help} onClick={() => { openMainPanel('help'); }} showTooltip>
        <HelpCircle className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>

      <div className="App-toolbar__divider" />

      <IconButton
        className={`App-toolbar__btn ${isSidebarOpen ? 'text-blue-600' : 'text-gray-600'}`}
        title={UI_LABELS.sidebar}
        onClick={() => setSidebarOpen(!isSidebarOpen)}
        showTooltip
      >
        <PanelsTopLeft className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className="App-toolbar__btn"
        title={UI_LABELS.propsPanel}
        onClick={() => {
          emitPropsPanelOpen();
        }}
        showTooltip
      >
        <SlidersHorizontal className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className="App-toolbar__btn"
        title={UI_LABELS.createNode}
        tooltipContent={UI_LABELS.createNode}
        onClick={() => {
          emitPropsPanelOpen();
        }}
        showTooltip
      >
        <Plus className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className="App-toolbar__btn"
        title={UI_LABELS.reset}
        onClick={onReset ?? (() => { try { useGraphStore.getState().resetAll(); } catch { void 0; } })}
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
      <IconButton
        className={`App-toolbar__btn ${fitToScreenMode ? 'text-blue-600' : ''}`}
        title={UI_LABELS.fitToScreen}
        tooltipContent="Fit to Screen mode: toggle to center the viewport on the full graph and clear Zoom to Selection until you turn it off."
        onClick={() => {
          const next = !fitToScreenMode;
          toggleFitToScreenMode();
          if (next) {
            setZoomToSelectionMode(false);
          }
        }}
        showTooltip
      >
        <Maximize className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className={`App-toolbar__btn ${zoomToSelectionMode ? 'text-blue-600' : ''}`}
        title={UI_LABELS.zoomToSelection}
        tooltipContent="Zoom to Selection mode: toggle to keep the camera centered on the active selection and turn off Fit to Screen while focused."
        onClick={() => {
          const next = !zoomToSelectionMode;
          setZoomToSelectionMode(next);
          if (next) {
            setFitToScreenMode(false);
            if (onZoomSelection) {
              onZoomSelection();
            }
          }
        }}
        showTooltip
      >
        <Focus className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className={`App-toolbar__btn ${renderMediaAsNodes ? 'text-blue-600' : 'text-gray-600'}`}
        title={renderMediaAsNodes ? 'Render Media as Nodes (On)' : 'Render Media as Nodes (Off)'}
        tooltipContent="View-only: shows or hides media overlays on media-capable nodes without reloading."
        onClick={() => setRenderMediaAsNodes(!renderMediaAsNodes)}
        showTooltip
      >
        <ImageIcon className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className={`App-toolbar__btn ${canvasRenderMode === '3d' ? 'text-blue-600' : 'text-gray-600'}`}
        title={canvasRenderMode === '3d' ? '3D Mode (On)' : '3D Mode (Off)'}
        onClick={() => setCanvasRenderMode(canvasRenderMode === '3d' ? '2d' : '3d')}
        showTooltip
      >
        <Box className={`${iconSizeClass} ${launchIconClass}`} strokeWidth={iconStrokeWidth} />
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
        onClick={() => emitSidePanelOpen({ tab: 'chat', open: true })}
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
        className={`App-toolbar__btn ${enableLaunchSpotlight ? 'text-blue-600' : 'text-gray-600'}`}
        title="Launch"
        tooltipContent="Launch"
        onClick={() => launchSpotlight()}
        showTooltip
      >
        <Rocket className={`${iconSizeClass} ${launchIconClass}`} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className={`App-toolbar__btn ${themeMode === 'dark' ? 'text-blue-600' : 'text-gray-600'}`}
        title={`Theme: ${themeMode === 'system' ? 'System' : themeMode === 'light' ? 'Light' : 'Dark'}`}
        onClick={() => setThemeMode(prev => getNextThemeMode(prev))}
        showTooltip
      >
        <SunMoon className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>

    </div>
  );
}
