import React, { useEffect, useRef, useState } from 'react';
import { HelpCircle, Settings, Search as SearchIcon, History as HistoryIcon, SunMoon, Plus, MessageCircle, Play, Download } from 'lucide-react';
import IconButton from '@/components/IconButton';
import { DropdownPanel } from '@/lib/ui/overlay';
import { UI_LABELS, UI_COPY } from '@/lib/config';
import {
  uiPrimaryIconActiveClassName,
  uiPrimaryIconInactiveClassName,
  uiToolbarTouchRowScrollClassName,
} from '@/features/toolbar/ui/toolbarStyles'
import { useCanvasToolbarContext } from '@/components/toolbar/useCanvasToolbarContext';
import { Canvas2dRendererSelect } from '@/components/toolbar/Canvas2dRendererSelect';
import { EditorWorkspaceSelect } from '@/components/toolbar/EditorWorkspaceSelect';
import { InteractionModeSelect } from '@/components/toolbar/InteractionModeSelect';
import { useGraphStore } from '@/hooks/useGraphStore'
import { emitFloatingPanelOpen, emitWorkflowRunAll } from '@/features/canvas/utils'
import { getToolbarRunAllFloatingPanelTab, supportsToolbarRunAll } from '@/lib/config.render'
import { getDeferredInstallPrompt, promptPwaInstall } from '@/lib/pwa/runtime'

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
  const floatingPanelOpen = useGraphStore(s => s.floatingPanelOpen)
  const floatingPanelView = useGraphStore(s => s.floatingPanelView)

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchBtnRef = useRef<HTMLButtonElement>(null);
  const searchPanelRef = useRef<HTMLDivElement>(null);
  const [isInstallable, setIsInstallable] = useState(() => getDeferredInstallPrompt() !== null);
  const canRunAll = supportsToolbarRunAll(canvas2dRenderer)
  const runAllFloatingPanelTab = getToolbarRunAllFloatingPanelTab(canvas2dRenderer)
  const runAllFloatingPanelConsumerMounted = !!runAllFloatingPanelTab && floatingPanelOpen === true && floatingPanelView === runAllFloatingPanelTab

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
  const effectiveMainPanelPinned = isNarrowViewport ? true : mainPanelPinned
  const effectiveMainPanelCollapsed = isNarrowViewport ? false : mainPanelCollapsed
  const navStyle: React.CSSProperties | undefined =
    isNarrowViewport
	      ? {
	          width: 'calc(100vw - var(--kg-safe-left) - var(--kg-safe-right) - 1rem)',
	          maxWidth: 'calc(100vw - var(--kg-safe-left) - var(--kg-safe-right) - 1rem)',
	          flexWrap: 'nowrap',
	          justifyContent: 'flex-start',
	          alignContent: 'center',
	          overflowX: 'auto',
	          overflowY: 'hidden',
	          overscrollBehaviorX: 'contain',
	          overscrollBehaviorY: 'none',
	          WebkitOverflowScrolling: 'touch',
          touchAction: 'pan-x manipulation',
        }
      : undefined

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
	      className={`${navClassBase} ${isNarrowViewport ? uiToolbarTouchRowScrollClassName : ''}`}
      role="navigation"
      aria-label="Main Toolbar"
      data-kg-canvas-wheel-ignore="true"
      style={navStyle}
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
      <div className="App-toolbar__divider" />
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
          className={`${effectiveMainPanelPinned ? 'fixed inset-0 z-[2000]' : 'fixed inset-0 z-[80]'} ${(isNarrowViewport || effectiveMainPanelPinned) ? 'pointer-events-auto' : 'pointer-events-none'}`}
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
                    requestedAnchorId={mainPanelRequestedAnchorId}
                    requestedAnchorSeq={mainPanelRequestedAnchorSeq}
                    requestedSearchQuery={mainPanelRequestedSearchQuery}
                    requestedWorkflowManagerTab={mainPanelRequestedWorkflowManagerTab}
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
                effectiveMainPanelCollapsed ? 'w-[96vw] sm:w-[80vw] max-w-[1200px] h-fit' : 'w-[96vw] sm:w-[80vw] h-[85vh] sm:h-[80vh] max-w-[1200px] max-h-[800px]',
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
            if (runAllFloatingPanelConsumerMounted) {
              emitWorkflowRunAll({ source: 'toolbar' })
              return
            }
            emitFloatingPanelOpen({ tab: runAllFloatingPanelTab, open: true })
            window.setTimeout(() => emitWorkflowRunAll({ source: 'toolbar' }), TOOLBAR_RUN_ALL_PANEL_DISPATCH_DELAY_MS)
            return
          }
          emitWorkflowRunAll({ source: 'toolbar' })
        }}
        showTooltip
      >
        <Play className={iconSizeClass} strokeWidth={iconStrokeWidth} />
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
        title={`${UI_COPY.themeTooltipPrefix}${themeMode === 'system' ? UI_LABELS.themeSystem : themeMode === 'light' ? UI_LABELS.themeLight : UI_LABELS.themeDark}`}
        onClick={actions.handleToggleTheme}
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
