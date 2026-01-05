import React, { useRef, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize, HelpCircle, Settings, Search as SearchIcon, RotateCcw, Focus, Rocket, History as HistoryIcon, Box, SunMoon, BarChart3, PanelsTopLeft, SlidersHorizontal, ListChecks, Shapes, CircleDot, TreePine, Plus, MessageCircle } from 'lucide-react';
import { useGraphStore } from '@/hooks/useGraphStore';
import { useShallow } from 'zustand/react/shallow';
import MainPanel from '@/features/panels/MainPanel';
import IconButton from '@/components/IconButton';
import { openBottomPanel } from '@/features/bottom-panel/open';
import { DropdownPanel } from '@/lib/ui/overlay';
import { getIconSizeClass } from '@/lib/ui';
import SearchPanel from '@/components/SearchPanel';
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect';
import { useLaunchSpotlight } from '@/features/panels/hooks/useLaunchSpotlight';
import { ThemeMode, applyThemeMode, getInitialThemeMode, getNextThemeMode, persistThemeMode } from '@/lib/ui/theme';
import { LS_KEYS, UI_LABELS, UI_LAYOUT } from '@/lib/config';
import { getLocalStorage, lsBool, lsNum, lsSetBool, lsSetNum } from '@/lib/persistence';
import { GraphFieldsIcon } from '@/features/graph-fields/ui/graphFieldIcons';
import { ToolbarMenuLauncher } from '@/features/toolbar/ToolbarMenuLauncher';
import { emitPropsPanelOpen, emitSidePanelOpen } from '@/features/canvas/utils';
import { deriveTidyTreeDerivation, normalizeEdgesForSim } from '@/components/GraphCanvas/simulation';

interface ToolbarProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onFit?: () => void;
  onReset?: () => void;
  onZoomSelection?: () => void;
}

export default function Toolbar({ onZoomIn, onZoomOut, onFit, onReset, onZoomSelection }: ToolbarProps) {
  const {
    canvasRenderMode,
    setCanvasRenderMode,
    schema,
    setSchema,
    polygonGroupsVisible,
    togglePolygonGroupsVisible,
    fitToScreenMode,
    toggleFitToScreenMode,
    zoomToSelectionMode,
    setZoomToSelectionMode,
    setFitToScreenMode,
    enableLaunchSpotlight,
    launchSpotlightMode,
    nodesCount,
    edgesCount,
    uiIconScale,
    uiIconStrokeWidth,
    uiIconAnimationEnabled,
    uiPanelKeyValueTextSizeClass,
    selectMode,
    setSelectMode,
    isSidebarOpen,
    setSidebarOpen,
  } = useGraphStore(
    useShallow((s) => ({
      canvasRenderMode: s.canvasRenderMode,
      setCanvasRenderMode: s.setCanvasRenderMode,
      schema: s.schema,
      setSchema: s.setSchema,
      polygonGroupsVisible: s.polygonGroupsVisible,
      togglePolygonGroupsVisible: s.togglePolygonGroupsVisible,
      enableLaunchSpotlight: s.enableLaunchSpotlight,
      launchSpotlightMode: s.launchSpotlightMode,
      nodesCount: s.graphData?.nodes?.length ?? 0,
      edgesCount: s.graphData?.edges?.length ?? 0,
      uiIconScale: s.uiIconScale,
      uiIconStrokeWidth: s.uiIconStrokeWidth,
      uiIconAnimationEnabled: s.uiIconAnimationEnabled,
      uiPanelKeyValueTextSizeClass: s.uiPanelKeyValueTextSizeClass || 'text-xs',
      selectMode: s.schema.behavior?.selectMode ?? 'single',
      setSelectMode: s.setSelectMode,
      isSidebarOpen: s.isSidebarOpen,
      setSidebarOpen: s.setSidebarOpen,
      fitToScreenMode: s.fitToScreenMode,
      toggleFitToScreenMode: s.toggleFitToScreenMode,
      zoomToSelectionMode: s.zoomToSelectionMode,
      setZoomToSelectionMode: s.setZoomToSelectionMode,
      setFitToScreenMode: s.setFitToScreenMode,
    })),
  );

  const [isMainPanelOpen, setIsMainPanelOpen] = useState(false);
  const [mainPanelRequestedTab, setMainPanelRequestedTab] = useState<'workflow' | 'help' | 'graphFields' | 'preview' | 'settings'>('help');
  const mainPanelCardRef = useRef<HTMLDivElement>(null);
  const mainPanelDragStateRef = useRef<{
    startX: number;
    startY: number;
    startTop: number;
    startLeft: number;
  } | null>(null);
  const mainPanelDragPosRef = useRef<{ top: number; left: number } | null>(null);
  const [mainPanelPinned, setMainPanelPinned] = useState<boolean>(() => lsBool(LS_KEYS.mainPanelPinned, true));
  const [mainPanelCollapsed, setMainPanelCollapsed] = useState<boolean>(() => lsBool(LS_KEYS.mainPanelCollapsed, false));
  const [mainPanelDragPos, setMainPanelDragPos] = useState<{ top: number; left: number }>(() => {
    const toolbarOffsetPx = UI_LAYOUT.toolbarOffsetPx;
    const topFallback = (() => {
      if (typeof window === 'undefined') return 240;
      const toolbar = typeof document === 'undefined' ? null : document.querySelector('.App-toolbar');
      const toolbarBottomPx = toolbar instanceof HTMLElement ? toolbar.getBoundingClientRect().bottom : toolbarOffsetPx;
      const expectedHeightPx = mainPanelCollapsed
        ? 240
        : Math.min(Math.round(window.innerHeight * 0.8), 800);
      const halfHeightPx = Math.round(expectedHeightPx / 2);
      return toolbarBottomPx + toolbarOffsetPx + halfHeightPx;
    })();
    const leftFallback = typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.5) : 240;
    const initial = {
      top: lsNum(LS_KEYS.mainPanelTop, topFallback),
      left: lsNum(LS_KEYS.mainPanelLeft, leftFallback),
    };
    mainPanelDragPosRef.current = initial;
    return initial;
  });

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchBtnRef = useRef<HTMLButtonElement>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);

  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return getInitialThemeMode(getLocalStorage());
  });
  const launchSpotlight = useLaunchSpotlight();
  const iconSizeClass = getIconSizeClass(uiIconScale);
  const iconStrokeWidth = uiIconStrokeWidth;
  const launchIconClass = uiIconAnimationEnabled ? 'LaunchButton__icon' : '';
  const layoutMode = schema.layout?.mode || 'force';
  const rawLayerMode = schema.layers?.mode;
  const layerMode: 'property' | 'document-structure' | 'semantic' =
    rawLayerMode === 'document-structure' || rawLayerMode === 'semantic' ? rawLayerMode : 'property';
  const layerModeDescriptor =
    layerMode === 'property'
      ? 'property (array properties)'
      : layerMode === 'document-structure'
        ? 'document-structure (node type)'
        : 'semantic (similarity graph)';
  const layerModeTitle = `${UI_LABELS.layerMode}: ${layerModeDescriptor}`;
  const LayerModeIcon =
    layerMode === 'property' ? PanelsTopLeft : layerMode === 'document-structure' ? TreePine : CircleDot;

  const openMainPanel = useCallback(
    (tab: 'workflow' | 'help' | 'graphFields' | 'preview' | 'settings') => {
      setIsMainPanelOpen(true);
      setMainPanelRequestedTab(tab);
      if (typeof window !== 'undefined') {
        const pos = {
          top: Math.round(window.innerHeight / 2),
          left: Math.round(window.innerWidth / 2),
        };
        mainPanelDragPosRef.current = pos;
        setMainPanelDragPos(pos);
      }
    },
    [],
  );

  React.useEffect(() => {
    lsSetBool(LS_KEYS.mainPanelPinned, mainPanelPinned);
  }, [mainPanelPinned]);

  React.useEffect(() => {
    lsSetBool(LS_KEYS.mainPanelCollapsed, mainPanelCollapsed);
  }, [mainPanelCollapsed]);

  const clampMainPanelPos = useCallback((pos: { top: number; left: number }) => {
    if (typeof window === 'undefined') return pos;

    const toolbar = typeof document === 'undefined' ? null : document.querySelector('.App-toolbar');
    const toolbarOffsetPx = UI_LAYOUT.toolbarOffsetPx;
    const toolbarBottomPx = toolbar instanceof HTMLElement ? toolbar.getBoundingClientRect().bottom : toolbarOffsetPx;

    const rect = mainPanelCardRef.current?.getBoundingClientRect();
    const defaultHalfWidthPx = Math.round(window.innerWidth * 0.4);
    const defaultHalfHeightPx = Math.round(window.innerHeight * 0.4);
    const halfWidthPx = rect ? Math.round(rect.width / 2) : defaultHalfWidthPx;
    const halfHeightPx = rect
      ? Math.round(rect.height / 2)
      : mainPanelCollapsed
        ? 120
        : defaultHalfHeightPx;

    const visible = 32;

    const minTop = toolbarBottomPx + toolbarOffsetPx + visible - halfHeightPx;
    const maxTop = window.innerHeight - visible + halfHeightPx;
    const minLeft = visible - halfWidthPx;
    const maxLeft = window.innerWidth - visible + halfWidthPx;

    const clampedTop = Math.min(Math.max(pos.top, minTop), maxTop);
    const clampedLeft = Math.min(Math.max(pos.left, minLeft), maxLeft);

    return {
      top: clampedTop,
      left: clampedLeft,
    };
  }, [mainPanelCollapsed]);

  const setMainPanelDragPosSynced = useCallback((pos: { top: number; left: number }) => {
    mainPanelDragPosRef.current = pos;
    setMainPanelDragPos(pos);
  }, []);

  const persistMainPanelPos = useCallback((pos: { top: number; left: number }) => {
    const clamped = clampMainPanelPos(pos);
    setMainPanelDragPosSynced(clamped);
    lsSetNum(LS_KEYS.mainPanelTop, clamped.top);
    lsSetNum(LS_KEYS.mainPanelLeft, clamped.left);
  }, [clampMainPanelPos, setMainPanelDragPosSynced]);

  const handleMainPanelHeaderDragStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const el = mainPanelCardRef.current;
    if (!el) return;
    try {
      event.preventDefault();
    } catch {
      void 0;
    }
    const rect = el.getBoundingClientRect();
    const startTop = rect.top + rect.height / 2;
    const startLeft = rect.left + rect.width / 2;
    mainPanelDragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startTop,
      startLeft,
    };
    setMainPanelDragPosSynced(clampMainPanelPos({ top: startTop, left: startLeft }));
    const handleMove = (e: PointerEvent) => {
      const state = mainPanelDragStateRef.current;
      if (!state) return;
      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      setMainPanelDragPosSynced(clampMainPanelPos({ top: state.startTop + dy, left: state.startLeft + dx }));
    };
    const handleUp = () => {
      mainPanelDragStateRef.current = null;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      const pos = mainPanelDragPosRef.current;
      if (!pos) return;
      persistMainPanelPos(pos);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
  }, [clampMainPanelPos, persistMainPanelPos, setMainPanelDragPosSynced]);

  const handleMainPanelRestore = useCallback(() => {
    setMainPanelCollapsed(false);
    const top = (() => {
      if (typeof window === 'undefined') return 240;
      const toolbar = typeof document === 'undefined' ? null : document.querySelector('.App-toolbar');
      const toolbarOffsetPx = UI_LAYOUT.toolbarOffsetPx;
      const toolbarBottomPx = toolbar instanceof HTMLElement ? toolbar.getBoundingClientRect().bottom : toolbarOffsetPx;
      const expectedHeightPx = Math.min(Math.round(window.innerHeight * 0.8), 800);
      const halfHeightPx = Math.round(expectedHeightPx / 2);
      return toolbarBottomPx + toolbarOffsetPx + halfHeightPx;
    })();
    const left = typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.5) : 240;
    persistMainPanelPos({ top, left });
  }, [persistMainPanelPos]);

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
      const e = ev as CustomEvent<{ tab?: 'workflow' | 'help' | 'graphFields' | 'preview' | 'settings' } | undefined>;
      const detailTab = e.detail && e.detail.tab;
      const tab: 'workflow' | 'help' | 'graphFields' | 'preview' | 'settings' =
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
        <span className={`${uiPanelKeyValueTextSizeClass} leading-none whitespace-nowrap`}>
          Rows: {(nodesCount + edgesCount).toLocaleString()} (nodes: {nodesCount.toLocaleString()}, edges: {edgesCount.toLocaleString()})
        </span>
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
          const currentMode = currentLayers.mode || 'property';
          const nextMode: 'property' | 'document-structure' | 'semantic' =
            currentMode === 'property'
              ? 'document-structure'
              : currentMode === 'document-structure'
                ? 'semantic'
                : 'property';
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
        className={`App-toolbar__btn ${polygonGroupsVisible ? 'text-blue-600' : 'text-gray-600'}`}
        title={UI_LABELS.polygonGroupsMode}
        tooltipContent={UI_LABELS.polygonGroupsMode}
        onClick={() => {
          togglePolygonGroupsVisible()
        }}
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
            if (onFit) {
              onFit();
            }
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
