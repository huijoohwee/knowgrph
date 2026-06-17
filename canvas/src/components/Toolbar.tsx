import React, { useEffect, useRef, useState } from 'react';
import { HelpCircle, Settings, Search as SearchIcon, History as HistoryIcon, SunMoon, Plus, MessageCircle, Play, Download, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import IconButton from '@/components/IconButton';
import { DropdownPanel } from '@/lib/ui/overlay';
import { UI_LABELS } from '@/lib/config';
import {
  uiPrimaryIconActiveClassName,
  uiPrimaryIconInactiveClassName,
  uiToolbarTouchRowScrollClassName,
} from '@/features/toolbar/ui/toolbarStyles'
import { getThemeModeLabel } from '@/lib/ui/theme';
import { useCanvasToolbarContext } from '@/components/toolbar/useCanvasToolbarContext';
import { Canvas2dRendererSelect } from '@/components/toolbar/Canvas2dRendererSelect';
import { EditorWorkspaceSelect } from '@/components/toolbar/EditorWorkspaceSelect';
import { InteractionModeSelect } from '@/components/toolbar/InteractionModeSelect';
import { useGraphStore } from '@/hooks/useGraphStore'
import { useActiveGraphRenderData } from '@/hooks/useActiveGraphData'
import { emitFloatingPanelOpen, emitWorkflowRunAll } from '@/features/canvas/utils'
import { getToolbarRunAllFloatingPanelTab, supportsToolbarRunAll } from '@/lib/config.render'
import { createStrybldrLocalVideoArtifactFromGraphData } from '@/features/strybldr/strybldrVideoHandoffArtifact'
import { getDeferredInstallPrompt, promptPwaInstall } from '@/lib/pwa/runtime'
import {
  UI_RESPONSIVE_MAIN_PANEL_COLLAPSED_CARD_CLASSNAME,
  UI_RESPONSIVE_MAIN_PANEL_MOBILE_SHEET_CLASSNAME,
  UI_RESPONSIVE_MAIN_PANEL_OPEN_CARD_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'

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
const TOOLBAR_RUN_ALL_PANEL_DISPATCH_DELAY_MS = 120
const TOOLBAR_RUN_ALL_PANEL_RETRY_DELAY_MS = 520

const emitToolbarRunAll = () => emitWorkflowRunAll({ source: 'toolbar' })

export default function Toolbar({ onZoomIn, onZoomOut, onReset, onZoomSelection }: ToolbarProps) {
  const {
    actions,
    clampMainPanelPos,
    documentStructureBaselineLock,
    ensureBaselineUnlocked,
    geospatialEnabled,
    handleMainPanelHeaderDragStart,
    handleMainPanelRestore,
    iconSizeClass,
    iconStrokeWidth,
    isMainPanelOpen,
    isWorkspaceOverlayMode,
    mainPanelCardRef,
    mainPanelCollapsed,
    mainPanelDragPos,
    mainPanelPinned,
    mainPanelRequestedAnchorId,
    mainPanelRequestedAnchorSeq,
    mainPanelRequestedSearchQuery,
    mainPanelRequestedTab,
    mainPanelRequestedWorkflowManagerTab,
    mainPanelRequestedWorkflowManagerEntryLabel,
    openMainPanel,
    setIsMainPanelOpen,
    setMainPanelCollapsed,
    setMainPanelPinned,
    themeMode,
    toggleFitToScreenMode,
    toolbarNavRef,
    canvas2dRenderer,
  } = useCanvasToolbarContext({ onReset, onZoomSelection })
  const pushUiToast = useGraphStore(s => s.pushUiToast)

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchBtnRef = useRef<HTMLButtonElement>(null);
  const searchPanelRef = useRef<HTMLElement>(null);
  const [isInstallable, setIsInstallable] = useState(() => getDeferredInstallPrompt() !== null);
  const canRunAll = supportsToolbarRunAll(canvas2dRenderer)
  const runAllFloatingPanelTab = getToolbarRunAllFloatingPanelTab(canvas2dRenderer)
  const strybldrRunAllGraphData = useActiveGraphRenderData(canRunAll && runAllFloatingPanelTab === 'strybldr')
  const [strybldrToolbarRunAllRunning, setStrybldrToolbarRunAllRunning] = useState(false)
  const handleToolbarZoomIn = React.useCallback(() => {
    if (onZoomIn) {
      onZoomIn()
      return
    }
    useGraphStore.getState().requestZoom('in')
  }, [onZoomIn])
  const handleToolbarZoomOut = React.useCallback(() => {
    if (onZoomOut) {
      onZoomOut()
      return
    }
    useGraphStore.getState().requestZoom('out')
  }, [onZoomOut])
  const handleToolbarZoomReset = React.useCallback(() => {
    if (onReset) {
      onReset()
      return
    }
    useGraphStore.getState().requestZoom('reset')
  }, [onReset])
  const runStrybldrToolbarRunAll = React.useCallback(async () => {
    if (strybldrToolbarRunAllRunning) return
    setStrybldrToolbarRunAllRunning(true)
    try {
      const result = await createStrybldrLocalVideoArtifactFromGraphData(strybldrRunAllGraphData || useGraphStore.getState().graphData)
      if ('reason' in result) {
        const reason = result.reason
        pushUiToast({
          id: 'toolbar-run-all-strybldr-empty',
          kind: 'warning',
          message: reason,
          dismissible: true,
        })
        return
      }
      pushUiToast({
        id: 'toolbar-run-all-strybldr-generated',
        kind: 'success',
        message: 'Strybldr video handoff saved.',
      })
    } catch (error) {
      pushUiToast({
        id: 'toolbar-run-all-strybldr-error',
        kind: 'error',
        message: `Strybldr Run all failed: ${String((error as { message?: unknown })?.message ?? error)}`,
        dismissible: true,
      })
    } finally {
      setStrybldrToolbarRunAllRunning(false)
    }
  }, [pushUiToast, strybldrRunAllGraphData, strybldrToolbarRunAllRunning])

  useEffect(() => {
    const root = document.documentElement
    if (!root) return
    const observer = new MutationObserver(() => {
      setIsInstallable(root.getAttribute('data-kg-installable') === '1')
    })
    observer.observe(root, { attributes: true, attributeFilter: ['data-kg-installable'] })
    return () => observer.disconnect()
  }, [])
  const navClassBase = 'Island App-toolbar App-toolbar--compact w-fit'
  const clampedMainPanelPos = isMainPanelOpen ? clampMainPanelPos(mainPanelDragPos) : mainPanelDragPos
  const isNarrowViewport = useMediaQuery('(max-width: 768px), (pointer: coarse)')
  const shouldUseToolbarRowScroll = isNarrowViewport || isWorkspaceOverlayMode
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
	      className={`${navClassBase} ${shouldUseToolbarRowScroll ? uiToolbarTouchRowScrollClassName : ''}`}
      role="navigation"
	      aria-label="Main Toolbar"
	      data-kg-canvas-wheel-ignore="true"
	    >
      <React.Suspense fallback={null}>
        <ToolbarMenuLauncherLazy
          onOpenMainPanel={openMainPanel}
          onCloseMainPanel={() => setIsMainPanelOpen(false)}
          onLaunchSpotlight={actions.handleLaunch}
          onLaunchStatus={actions.handleLaunchStats}
        />
      </React.Suspense>

      <EditorWorkspaceSelect
        iconSizeClass={iconSizeClass}
        iconStrokeWidth={iconStrokeWidth}
        ensureBaselineUnlocked={ensureBaselineUnlocked}
      />
      <InteractionModeSelect
        iconSizeClass={iconSizeClass}
        iconStrokeWidth={iconStrokeWidth}
        ensureBaselineUnlocked={ensureBaselineUnlocked}
      />

      <Canvas2dRendererSelect
        iconSizeClass={iconSizeClass}
        iconStrokeWidth={iconStrokeWidth}
        ensureBaselineUnlocked={ensureBaselineUnlocked}
        geospatialEnabled={geospatialEnabled}
        onOpenGeospatialMode={actions.handleOpenGeospatialMode}
      />
      <section className="App-toolbar__divider" />
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
        <section
          className={`${effectiveMainPanelPinned ? 'fixed inset-0 z-[2000]' : 'fixed inset-0 z-[80]'} ${(isNarrowViewport || effectiveMainPanelPinned) ? 'pointer-events-auto' : 'pointer-events-none'}`}
        >
          {isNarrowViewport ? (
            <>
              <section
                className="absolute inset-0 bg-black/30"
                onPointerDown={(e) => {
                  e.stopPropagation()
                  setIsMainPanelOpen(false)
                }}
                aria-hidden="true"
              />
              <section
                ref={mainPanelCardRef}
                className={UI_RESPONSIVE_MAIN_PANEL_MOBILE_SHEET_CLASSNAME}
              >
                <React.Suspense fallback={null}>
                  <MainPanelLazy
                    onClose={() => setIsMainPanelOpen(false)}
                    requestedTab={mainPanelRequestedTab}
                    requestedAnchorId={mainPanelRequestedAnchorId}
                    requestedAnchorSeq={mainPanelRequestedAnchorSeq}
                    requestedSearchQuery={mainPanelRequestedSearchQuery}
                    requestedWorkflowManagerTab={mainPanelRequestedWorkflowManagerTab}
                    requestedWorkflowManagerEntryLabel={mainPanelRequestedWorkflowManagerEntryLabel}
                    collapsed={false}
                    pinned={true}
                    onMinimize={undefined}
                    onRestore={undefined}
                    onPinToggle={undefined}
                  />
                </React.Suspense>
              </section>
            </>
          ) : (
            <section
              ref={mainPanelCardRef}
              className={[
                'pointer-events-auto',
                effectiveMainPanelCollapsed
                  ? UI_RESPONSIVE_MAIN_PANEL_COLLAPSED_CARD_CLASSNAME
                  : UI_RESPONSIVE_MAIN_PANEL_OPEN_CARD_CLASSNAME,
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
                  requestedAnchorId={mainPanelRequestedAnchorId}
                  requestedAnchorSeq={mainPanelRequestedAnchorSeq}
                  requestedSearchQuery={mainPanelRequestedSearchQuery}
                  requestedWorkflowManagerTab={mainPanelRequestedWorkflowManagerTab}
                  requestedWorkflowManagerEntryLabel={mainPanelRequestedWorkflowManagerEntryLabel}
                  collapsed={effectiveMainPanelCollapsed}
                  pinned={effectiveMainPanelPinned}
                  onMinimize={!effectiveMainPanelCollapsed ? () => setMainPanelCollapsed(true) : undefined}
                  onRestore={handleMainPanelRestore}
                  onPinToggle={() => setMainPanelPinned(v => !v)}
                />
              </React.Suspense>
            </section>
          )}
        </section>
      )}

      <IconButton className="App-toolbar__btn" title={UI_LABELS.history} onClick={actions.handleOpenHistory} showTooltip>
        <HistoryIcon className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>

      <IconButton className="App-toolbar__btn" title={UI_LABELS.help} onClick={actions.handleOpenHelp} showTooltip>
        <HelpCircle className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>

      <section className="App-toolbar__divider" />
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
        title={canRunAll ? 'Run all' : 'Run all (Flow Editor or Strybldr only)'}
        tooltipContent={canRunAll ? 'Run all' : 'Run all (Flow Editor or Strybldr only)'}
        onClick={() => {
          if (!canRunAll) {
            pushUiToast({ id: 'toolbar-run-all-disabled', kind: 'neutral', message: 'Open Flow Editor or Strybldr to run all.', ttlMs: 2200 })
            return
          }
          if (runAllFloatingPanelTab) {
            const graphStore = useGraphStore.getState()
            graphStore.setFloatingPanelView(runAllFloatingPanelTab)
            graphStore.setFloatingPanelOpen(true)
            if (runAllFloatingPanelTab === 'strybldr') {
              emitFloatingPanelOpen({ tab: runAllFloatingPanelTab, open: true })
              void runStrybldrToolbarRunAll()
              return
            }
            emitFloatingPanelOpen({ tab: runAllFloatingPanelTab, open: true, runAllOnOpen: true })
            window.setTimeout(emitToolbarRunAll, TOOLBAR_RUN_ALL_PANEL_DISPATCH_DELAY_MS)
            window.setTimeout(emitToolbarRunAll, TOOLBAR_RUN_ALL_PANEL_RETRY_DELAY_MS)
            return
          }
          emitToolbarRunAll()
        }}
        showTooltip
      >
        <Play className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className="App-toolbar__btn"
        title={UI_LABELS.zoomIn}
        tooltipContent={UI_LABELS.zoomIn}
        onClick={handleToolbarZoomIn}
        showTooltip
      >
        <ZoomIn className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className="App-toolbar__btn"
        title={UI_LABELS.zoomOut}
        tooltipContent={UI_LABELS.zoomOut}
        onClick={handleToolbarZoomOut}
        showTooltip
      >
        <ZoomOut className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className="App-toolbar__btn"
        title={UI_LABELS.reset}
        tooltipContent={UI_LABELS.reset}
        onClick={handleToolbarZoomReset}
        showTooltip
      >
        <RotateCcw className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <ZoomModeSelect iconSizeClass={iconSizeClass} iconStrokeWidth={iconStrokeWidth} onZoomSelection={onZoomSelection} />
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
        className="App-toolbar__btn"
        title={UI_LABELS.chat}
        tooltipContent={UI_LABELS.chat}
        onClick={actions.handleOpenChat}
        showTooltip
      >
        <MessageCircle className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      <IconButton
        className={`App-toolbar__btn ${
          themeMode === 'dark' ? uiPrimaryIconActiveClassName : uiPrimaryIconInactiveClassName
        }`}
        title={`${UI_LABELS.theme}: ${getThemeModeLabel(themeMode)}`}
        tooltipContent={`${UI_LABELS.theme}: ${getThemeModeLabel(themeMode)}`}
        ariaLabel={`${UI_LABELS.theme}: ${getThemeModeLabel(themeMode)}`}
        onClick={actions.handleToggleTheme}
        data-kg-theme-mode-control="toggle"
        data-kg-theme-mode-current={themeMode}
        showTooltip
      >
        <SunMoon className={iconSizeClass} strokeWidth={iconStrokeWidth} />
      </IconButton>
      {isInstallable && (
        <IconButton
          className="App-toolbar__btn"
          title={UI_LABELS.installApp}
          tooltipContent={UI_LABELS.installApp}
          onClick={() => {
            promptPwaInstall()
          }}
          showTooltip
        >
          <Download className={iconSizeClass} strokeWidth={iconStrokeWidth} />
        </IconButton>
      )}
    </nav>
  );
}
