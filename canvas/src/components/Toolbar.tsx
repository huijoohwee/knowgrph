import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, HelpCircle, Settings, Search as SearchIcon, RotateCcw, Grid3x3, History as HistoryIcon, Map, SunMoon, SlidersHorizontal, ListChecks, CircleDot, Plus, MessageCircle, Image as ImageIcon, GitMerge, Share2, Circle, Square, Hexagon, Diamond, FileText, Lock, Unlock, Compass, ChevronLeft, ChevronRight, Hand, Link2, Columns2 } from 'lucide-react';
import IconButton from '@/components/IconButton';
import { DropdownPanel } from '@/lib/ui/overlay';
import { UI_LABELS, UI_COPY } from '@/lib/config';
import { GraphFieldsIcon } from '@/features/graph-fields/ui/graphFieldIcons';
import {
  uiPrimaryIconActiveClassName,
  uiPrimaryIconInactiveClassName,
} from '@/features/toolbar/ui/toolbarStyles'
import { useCanvasToolbarContext } from '@/components/toolbar/useCanvasToolbarContext';
import { DocumentModeSelect } from '@/components/toolbar/DocumentModeSelect';
import { Canvas2dRendererSelect } from '@/components/toolbar/Canvas2dRendererSelect';
import { Canvas3dModeSelect } from '@/components/toolbar/Canvas3dModeSelect';
import { EditorWorkspaceSelect } from '@/components/toolbar/EditorWorkspaceSelect';
import { ToolbarDropdownSelect } from '@/components/toolbar/ToolbarDropdownSelect';
import { useGraphStore } from '@/hooks/useGraphStore'

import { CANVAS_INTERACTION_MODE_LABELS } from '@/lib/canvas/interaction-ssot'

import { ZoomModeSelect } from '@/components/toolbar/ZoomModeSelect';
import { useMediaQuery } from '@/lib/ui/useMediaQuery'

interface ToolbarProps {
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onReset?: () => void;
  onZoomSelection?: () => void;
}

const MainPanelLazy = React.lazy(() => import('@/features/panels/MainPanel'));
const SearchPanelLazy = React.lazy(() => import('@/components/SearchPanel'));
const ToolbarMenuLauncherLazy = React.lazy(() =>
  import('@/features/toolbar/ToolbarMenuLauncher').then(mod => ({ default: mod.ToolbarMenuLauncher })),
);

const TOOLBAR_ANIMATION_OPTIONS = [
  { id: 'force', title: 'Force-directed Graph (default)' },
  { id: 'orbit', title: 'Orbit-style nested radial animation' },
] as const

const VOXEL_ANIMATION_OPTIONS = [
  { id: 'on', title: 'Voxel animation (On)' },
  { id: 'off', title: 'Voxel animation (Off)' },
] as const

export default function Toolbar({ onZoomIn, onZoomOut, onReset, onZoomSelection }: ToolbarProps) {
  const {
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
    ensureBaselineUnlocked,
    geospatialEnabled,
    groupShapeMode,
    handleMainPanelHeaderDragStart,
    handleMainPanelRestore,
    iconSizeClass,
    iconStrokeWidth,
    isMainPanelOpen,
    isNavigateModeActive,
    isWorkspaceOverlayMode,
    launchIconClass,
    layoutMode,
    mainPanelCardRef,
    mainPanelCollapsed,
    mainPanelDragPos,
    mainPanelPinned,
    mainPanelRequestedSearchQuery,
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
    setFitToScreenMode,
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
  } = useCanvasToolbarContext({ onReset, onZoomSelection })

  const infiniteCanvasInteractionMode = useGraphStore(s => s.infiniteCanvasInteractionMode)
  const setInfiniteCanvasInteractionMode = useGraphStore(s => s.setInfiniteCanvasInteractionMode)
  const canvasWorkspaceSyncMode = useGraphStore(s => s.canvasWorkspaceSyncMode)
  const setCanvasWorkspaceSyncMode = useGraphStore(s => s.setCanvasWorkspaceSyncMode)
  const frontmatterModeEnabled = useGraphStore(s => s.frontmatterModeEnabled === true)
  const multiDimTableModeEnabled = useGraphStore(s => s.multiDimTableModeEnabled === true)
  const documentSemanticMode = useGraphStore(s => s.documentSemanticMode)
  const canvas3dMode = useGraphStore(s => s.canvas3dMode)

  const toggleInfiniteCanvasInteractionMode = useCallback(() => {
    if (!ensureBaselineUnlocked()) return
    setInfiniteCanvasInteractionMode(infiniteCanvasInteractionMode === 'interactive' ? 'static' : 'interactive')
  }, [ensureBaselineUnlocked, infiniteCanvasInteractionMode, setInfiniteCanvasInteractionMode])

  const toggleCanvasWorkspaceSyncMode = useCallback(() => {
    if (!ensureBaselineUnlocked()) return
    setCanvasWorkspaceSyncMode(canvasWorkspaceSyncMode === 'realtime' ? 'manual' : 'realtime')
  }, [canvasWorkspaceSyncMode, ensureBaselineUnlocked, setCanvasWorkspaceSyncMode])

  const [collapsedFixedPos, setCollapsedFixedPos] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    if (!toolbarCollapsed) setCollapsedFixedPos(null);
  }, [toolbarCollapsed]);

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchBtnRef = useRef<HTMLButtonElement>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);

  const navClassBase = 'Island App-toolbar App-toolbar--compact w-fit'
  const isD3Like2dLayoutToggle = canvas2dRenderer === 'd3' || canvas2dRenderer === 'd3Bipartite'
  const animationMode = (() => {
    const enabled = schema.layout?.forces?.radialOrbitEnabled !== false
    return enabled ? 'orbit' : 'force'
  })()
  const animationApplicableSemantic =
    frontmatterModeEnabled ||
    multiDimTableModeEnabled ||
    documentSemanticMode === 'document' ||
    documentSemanticMode === 'keyword'
  const animationApplicableRenderer =
    (canvasRenderMode === '3d' && canvas3dMode !== 'voxel') ||
    (canvasRenderMode === '2d' && canvas2dRenderer === 'd3')
  const animationApplicable = animationApplicableSemantic && animationApplicableRenderer && layoutMode === 'radial'
  const voxelAnimationMode = schema.three?.voxelAnimationEnabled === false ? 'off' : 'on'
  const voxelAnimationApplicable = canvasRenderMode === '3d' && canvas3dMode === 'voxel'
  const setAnimationMode = useCallback((mode: 'force' | 'orbit') => {
    if (canvasRenderMode === '3d' && canvas3dMode === 'voxel') return
    if (!ensureBaselineUnlocked()) return
    const current = schema
    const layout = current.layout || {}
    const forces = layout.forces || {}
    const enabled = mode === 'orbit'
    setSchema({
      ...current,
      layout: {
        ...layout,
        forces: {
          ...forces,
          radialOrbitEnabled: enabled,
        },
      },
    })
  }, [canvas3dMode, canvasRenderMode, ensureBaselineUnlocked, schema, setSchema])
  const setVoxelAnimationMode = useCallback((mode: 'on' | 'off') => {
    if (!voxelAnimationApplicable) return
    if (!ensureBaselineUnlocked()) return
    const current = schema
    const three = current.three || {}
    setSchema({
      ...current,
      three: {
        ...three,
        voxelAnimationEnabled: mode === 'on',
      },
    })
  }, [ensureBaselineUnlocked, schema, setSchema, voxelAnimationApplicable])
  const clampedMainPanelPos = isMainPanelOpen ? clampMainPanelPos(mainPanelDragPos) : mainPanelDragPos
  const isNarrowViewport = useMediaQuery('(max-width: 768px), (pointer: coarse)')
  const effectiveMainPanelPinned = isNarrowViewport ? true : mainPanelPinned
  const effectiveMainPanelCollapsed = isNarrowViewport ? false : mainPanelCollapsed

  useEffect(() => {
    if (!isMainPanelOpen) return
    if (!isNarrowViewport) return
    const body = document.body
    const prevOverflow = body.style.overflow
    body.style.overflow = 'hidden'
    return () => {
      body.style.overflow = prevOverflow
    }
  }, [isMainPanelOpen, isNarrowViewport])

  return (
    <nav
      ref={toolbarNavRef}
      className={`${navClassBase} ${toolbarCollapsed ? 'App-toolbar--collapsed' : ''}`}
      role="navigation"
      aria-label="Main Toolbar"
      data-kg-canvas-wheel-ignore="true"
      style={
        toolbarCollapsed && collapsedFixedPos && !isWorkspaceOverlayMode
          ? { position: 'fixed', top: collapsedFixedPos.top, left: collapsedFixedPos.left }
          : undefined
      }
    >
      {toolbarCollapsed ? (
        <>
          <React.Suspense fallback={null}>
            <ToolbarMenuLauncherLazy
              onOpenMainPanel={openMainPanel}
              onCloseMainPanel={() => setIsMainPanelOpen(false)}
              onLaunchSpotlight={actions.handleLaunch}
              onLaunchStatus={actions.handleLaunchStats}
            />
          </React.Suspense>

          <EditorWorkspaceSelect iconSizeClass={iconSizeClass} iconStrokeWidth={iconStrokeWidth} />

          <Canvas2dRendererSelect
            iconSizeClass={iconSizeClass}
            iconStrokeWidth={iconStrokeWidth}
            ensureBaselineUnlocked={ensureBaselineUnlocked}
            disabled={geospatialEnabled}
          />

          <IconButton
            className="App-toolbar__btn"
            title="Expand toolbar"
            tooltipContent="Expand toolbar"
            onClick={() => {
              setCollapsedFixedPos(null);
              setWorkspaceToolbarExpanded(true);
            }}
            showTooltip
          >
            <ChevronLeft className={iconSizeClass} strokeWidth={iconStrokeWidth} />
          </IconButton>
        </>
      ) : (
        <React.Suspense fallback={null}>
          <ToolbarMenuLauncherLazy
            onOpenMainPanel={openMainPanel}
            onCloseMainPanel={() => setIsMainPanelOpen(false)}
            onLaunchSpotlight={actions.handleLaunch}
            onLaunchStatus={actions.handleLaunchStats}
          />
        </React.Suspense>
      )}

      {toolbarCollapsed ? null : (
        <>
      <EditorWorkspaceSelect iconSizeClass={iconSizeClass} iconStrokeWidth={iconStrokeWidth} />

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

      <Canvas2dRendererSelect
        iconSizeClass={iconSizeClass}
        iconStrokeWidth={iconStrokeWidth}
        ensureBaselineUnlocked={ensureBaselineUnlocked}
        disabled={geospatialEnabled}
      />
      <DocumentModeSelect
        iconSizeClass={iconSizeClass}
        iconStrokeWidth={iconStrokeWidth}
        ensureBaselineUnlocked={ensureBaselineUnlocked}
      />
      <IconButton
        className={`App-toolbar__btn ${
          infiniteCanvasInteractionMode === 'interactive' ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName
        }`}
        title={UI_LABELS.canvasInteractionMode}
        tooltipContent={
          infiniteCanvasInteractionMode === 'interactive'
            ? UI_COPY.infiniteCanvasInteractionInteractiveTooltip
            : UI_COPY.infiniteCanvasInteractionStaticTooltip
        }
        onClick={toggleInfiniteCanvasInteractionMode}
        showTooltip
      >
        <Hand className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className={`App-toolbar__btn ${
          canvasWorkspaceSyncMode === 'realtime' ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName
        }`}
        title={UI_LABELS.workspaceSyncMode}
        tooltipContent={
          canvasWorkspaceSyncMode === 'realtime'
            ? UI_COPY.canvasWorkspaceSyncRealtimeTooltip
            : UI_COPY.canvasWorkspaceSyncManualTooltip
        }
        onClick={toggleCanvasWorkspaceSyncMode}
        showTooltip
      >
        <Link2 className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
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
          isD3Like2dLayoutToggle && layoutMode === 'radial'
            ? uiPrimaryIconActiveClassName
            : uiPrimaryIconInactiveClassName
        }`}
        title={layoutMode === 'block' ? 'Block layout' : 'Radial layout'}
        tooltipContent={layoutMode === 'block' ? 'Block layout (bipartite-style)' : 'Radial layout (blue)'}
        disabled={!isD3Like2dLayoutToggle}
        onClick={() => {
          if (!ensureBaselineUnlocked()) return
          actions.handleToggleRadialLayout()
        }}
        showTooltip
      >
        {layoutMode === 'block' ? (
          <Columns2 className={iconSizeClass} strokeWidth={iconStrokeWidth} />
        ) : (
          <CircleDot className={iconSizeClass} strokeWidth={iconStrokeWidth} />
        )}
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
        <div
          className={`${effectiveMainPanelPinned ? 'fixed inset-0 z-[2000]' : 'fixed inset-0 z-[80]'} ${isNarrowViewport ? 'pointer-events-auto' : 'pointer-events-none'}`}
        >
          {isNarrowViewport ? (
            <>
              <div
                className="absolute inset-0 bg-black/30"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  setIsMainPanelOpen(false)
                }}
                aria-hidden="true"
              />
              <div
                ref={mainPanelCardRef}
                className="absolute left-2 right-2 top-[calc(var(--kg-safe-top)+0.5rem)] bottom-[calc(var(--kg-safe-bottom)+0.5rem)] pointer-events-auto"
              >
                <React.Suspense fallback={null}>
                  <MainPanelLazy
                    onClose={() => setIsMainPanelOpen(false)}
                    requestedTab={mainPanelRequestedTab}
                    requestedSearchQuery={mainPanelRequestedSearchQuery}
                    collapsed={false}
                    pinned={true}
                    onMinimize={undefined}
                    onRestore={undefined}
                    onPinToggle={undefined}
                  />
                </React.Suspense>
              </div>
            </>
          ) : (
            <div
              ref={mainPanelCardRef}
              className={[
                'pointer-events-auto',
                effectiveMainPanelCollapsed ? 'w-[80vw] max-w-[1200px] h-fit' : 'w-[80vw] h-[80vh] max-w-[1200px] max-h-[800px]',
              ].join(' ')}
              style={{
                position: 'absolute',
                top: clampedMainPanelPos.top,
                left: clampedMainPanelPos.left,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <React.Suspense fallback={null}>
                <MainPanelLazy
                  onClose={() => setIsMainPanelOpen(false)}
                  onHeaderDragStart={!effectiveMainPanelPinned ? handleMainPanelHeaderDragStart : undefined}
                  requestedTab={mainPanelRequestedTab}
                  requestedSearchQuery={mainPanelRequestedSearchQuery}
                  collapsed={effectiveMainPanelCollapsed}
                  pinned={effectiveMainPanelPinned}
                  onMinimize={!effectiveMainPanelCollapsed ? () => setMainPanelCollapsed(true) : undefined}
                  onRestore={handleMainPanelRestore}
                  onPinToggle={() => setMainPanelPinned(v => !v)}
                />
              </React.Suspense>
            </div>
          )}
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
      <ZoomModeSelect iconSizeClass={iconSizeClass} iconStrokeWidth={iconStrokeWidth} onZoomSelection={onZoomSelection} />
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
              minorAlpha: canvasGridMinorAlpha,
              majorAlpha: canvasGridMajorAlpha,
              minorWidthPx: canvasGridMinorWidthPx,
              majorWidthPx: canvasGridMajorWidthPx,
              minorStroke: canvasGridMinorStroke || undefined,
              majorStroke: canvasGridMajorStroke || undefined,
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
      {voxelAnimationApplicable ? (
        <ToolbarDropdownSelect
          value={voxelAnimationMode}
          options={VOXEL_ANIMATION_OPTIONS}
          title={voxelAnimationMode === 'on' ? 'Voxel animation: On' : 'Voxel animation: Off'}
          tooltipContent="Voxel animation"
          disabled={false}
          isButtonActive={voxelAnimationMode === 'on'}
          menuWidthClass="w-64"
          onSelect={id => setVoxelAnimationMode(id)}
          renderButtonContent={() => <GitMerge className={iconSizeClass} strokeWidth={iconStrokeWidth} />}
        />
      ) : (
        <ToolbarDropdownSelect
          value={animationMode}
          options={TOOLBAR_ANIMATION_OPTIONS}
          title={animationMode === 'orbit' ? 'Animation: Orbit-style nested radial' : 'Animation: Force-directed Graph'}
          tooltipContent="Animation"
          disabled={!animationApplicable}
          isButtonActive={animationMode === 'orbit'}
          menuWidthClass="w-64"
          onSelect={id => setAnimationMode(id)}
          renderButtonContent={() => <GitMerge className={iconSizeClass} strokeWidth={iconStrokeWidth} />}
        />
      )}
      <Canvas3dModeSelect
        iconSizeClass={iconSizeClass}
        iconStrokeWidth={iconStrokeWidth}
        ensureBaselineUnlocked={ensureBaselineUnlocked}
        disabled={geospatialEnabled}
      />
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
          <React.Suspense fallback={null}>
            <SearchPanelLazy ref={searchPanelRef} onClose={() => setIsSearchOpen(false)} />
          </React.Suspense>
        </DropdownPanel>
      )}

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
        onClick={() => {
          if (!isWorkspaceOverlayMode) {
            const el = toolbarNavRef.current;
            if (el) {
              try {
                const rect = el.getBoundingClientRect();
                setCollapsedFixedPos({ top: rect.top, left: rect.left });
              } catch {
                void 0;
              }
            }
          }
          setWorkspaceToolbarExpanded(false);
        }}
        showTooltip
      >
        <ChevronRight className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
        </>
      )}
    </nav>
  );
}
