import React from 'react'
import IconButton from '@/components/IconButton'
import { FloatingPanel } from '@/components/ui/FloatingPanel'
import HeaderActions from '@/features/panels/ui/HeaderActions'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_SELECTORS } from '@/lib/config'
import { WORKSPACE_LEFT_PANE_SELECTOR } from '@/lib/canvas/viewportMeasureElement'
import { getIconSizeClass } from '@/lib/ui'
import { UI_RESPONSIVE_CANVAS_BOTTOM_PANEL_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import { createRafValueScheduler } from '@/lib/react/rafValueScheduler'
import { clampOverlayTopLeftToViewport } from '@/lib/ui/overlayClamp'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import { ChartGantt, FileDiff, GitGraph, History } from 'lucide-react'
import { StrybldrTimelinePanel } from './StrybldrTimelinePanel'

type TimelineBottomPanelPosition = {
  top: number
  left: number
}

type TimelineBottomPanelView = 'timeline' | 'documentVersionGraph' | 'gitGraph' | 'gantt'

const TIMELINE_BOTTOM_PANEL_VISIBLE_PX = 32
const TIMELINE_BOTTOM_PANEL_FALLBACK_SIZE = { width: 560, height: 128 } as const
const GitGraphBottomPanelViewLazy = React.lazy(() =>
  import('@/features/gitgraph/GitGraphBottomPanelView').then(mod => ({ default: mod.GitGraphBottomPanelView })),
)
const GanttBottomPanelViewLazy = React.lazy(() =>
  import('@/features/gitgraph/GanttBottomPanelView').then(mod => ({ default: mod.GanttBottomPanelView })),
)
const DocumentVersionGitGraphPanelLazy = React.lazy(() =>
  import('@/features/document-versioning/DocumentVersionGitGraphPanel').then(mod => ({ default: mod.DocumentVersionGitGraphPanel })),
)

type TimelineLayerRect = Pick<DOMRect, 'left' | 'right' | 'width'>

function resolveWorkspaceCanvasLayerInsetLeft({
  workspaceEditorOverlayOpen,
  rootRect,
  workspaceLeftPaneRect,
}: {
  workspaceEditorOverlayOpen: boolean
  rootRect: TimelineLayerRect | null
  workspaceLeftPaneRect: TimelineLayerRect | null
}) {
  if (!workspaceEditorOverlayOpen || !rootRect || !workspaceLeftPaneRect) return 0
  if (
    !Number.isFinite(rootRect.left) ||
    !Number.isFinite(rootRect.right) ||
    !Number.isFinite(rootRect.width) ||
    rootRect.width <= 0
  ) {
    return 0
  }
  if (
    !Number.isFinite(workspaceLeftPaneRect.left) ||
    !Number.isFinite(workspaceLeftPaneRect.right) ||
    !Number.isFinite(workspaceLeftPaneRect.width) ||
    workspaceLeftPaneRect.width <= 0
  ) {
    return 0
  }
  if (workspaceLeftPaneRect.right <= rootRect.left || workspaceLeftPaneRect.left >= rootRect.right) return 0
  const insetLeft = workspaceLeftPaneRect.right - rootRect.left
  if (!Number.isFinite(insetLeft) || insetLeft <= 0) return 0
  if (insetLeft >= rootRect.width - TIMELINE_BOTTOM_PANEL_VISIBLE_PX) return 0
  return Math.max(0, Math.min(rootRect.width, insetLeft))
}

export function StrybldrTimelineBottomPanel({
  active = true,
  initialView = 'timeline',
  workspaceEditorOverlayOpen = false,
}: {
  active?: boolean
  initialView?: TimelineBottomPanelView
  workspaceEditorOverlayOpen?: boolean
}) {
  const rootLayerRef = React.useRef<HTMLElement | null>(null)
  const layerRef = React.useRef<HTMLElement | null>(null)
  const panelRef = React.useRef<HTMLElement | null>(null)
  const dragStateRef = React.useRef<{
    startX: number
    startY: number
    startTop: number
    startLeft: number
  } | null>(null)
  const [pinned, setPinned] = React.useState(true)
  const [minimized, setMinimized] = React.useState(false)
  const [view, setView] = React.useState<TimelineBottomPanelView>(initialView)
  const [position, setPosition] = React.useState<TimelineBottomPanelPosition | null>(null)
  const [workspaceLayerInsetLeft, setWorkspaceLayerInsetLeft] = React.useState(0)
  const bottomSurfaceCollapsed = useGraphStore(s => s.bottomSurfaceCollapsed)
  const bottomSurfaceTab = useGraphStore(s => s.bottomSurfaceTab)
  const setBottomSurfaceCollapsed = useGraphStore(s => s.setBottomSurfaceCollapsed)
  const setBottomSurfaceTab = useGraphStore(s => s.setBottomSurfaceTab)
  const setTimelineEnabled = useGraphStore(s => s.setTimelineEnabled)
  const markdownDocumentName = useGraphStore(s => s.markdownDocumentName)
  const resolvedThemeMode = useGraphStore(s => (s.resolvedThemeMode || 'light') as 'light' | 'dark')
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const iconSizeClass = getIconSizeClass(uiIconScale)
  const dragSchedulerRef = React.useRef(createRafValueScheduler((next: TimelineBottomPanelPosition) => setPosition(next)))

  React.useEffect(() => {
    dragSchedulerRef.current = createRafValueScheduler((next: TimelineBottomPanelPosition) => setPosition(next))
  }, [])

  React.useEffect(() => {
    setView(initialView)
  }, [initialView])

  const updateWorkspaceLayerInsetLeft = React.useCallback(() => {
    if (typeof document === 'undefined') {
      setWorkspaceLayerInsetLeft(0)
      return
    }
    const rootLayer = rootLayerRef.current
    const workspaceLeftPane = document.querySelector<HTMLElement>(WORKSPACE_LEFT_PANE_SELECTOR)
    const nextInsetLeft = resolveWorkspaceCanvasLayerInsetLeft({
      workspaceEditorOverlayOpen,
      rootRect: rootLayer?.getBoundingClientRect() || null,
      workspaceLeftPaneRect: workspaceLeftPane?.getBoundingClientRect() || null,
    })
    setWorkspaceLayerInsetLeft(current => current === nextInsetLeft ? current : nextInsetLeft)
  }, [workspaceEditorOverlayOpen])

  React.useLayoutEffect(() => {
    updateWorkspaceLayerInsetLeft()
    if (typeof window === 'undefined') return undefined
    const rootLayer = rootLayerRef.current
    const workspaceLeftPane = typeof document !== 'undefined'
      ? document.querySelector<HTMLElement>(WORKSPACE_LEFT_PANE_SELECTOR)
      : null
    const rafId = window.requestAnimationFrame(updateWorkspaceLayerInsetLeft)
    window.addEventListener('resize', updateWorkspaceLayerInsetLeft)
    let resizeObserver: ResizeObserver | null = null
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(updateWorkspaceLayerInsetLeft)
      if (rootLayer) resizeObserver.observe(rootLayer)
      if (workspaceLeftPane) resizeObserver.observe(workspaceLeftPane)
    }
    return () => {
      window.cancelAnimationFrame(rafId)
      window.removeEventListener('resize', updateWorkspaceLayerInsetLeft)
      resizeObserver?.disconnect()
    }
  }, [updateWorkspaceLayerInsetLeft])

  const getPanelSize = React.useCallback(() => {
    const rect = panelRef.current?.getBoundingClientRect()
    const width = rect && Number.isFinite(rect.width) && rect.width > 0 ? rect.width : TIMELINE_BOTTOM_PANEL_FALLBACK_SIZE.width
    const height = rect && Number.isFinite(rect.height) && rect.height > 0 ? rect.height : TIMELINE_BOTTOM_PANEL_FALLBACK_SIZE.height
    return { width, height }
  }, [])
  const getLayerRect = React.useCallback(() => {
    return layerRef.current?.getBoundingClientRect() || null
  }, [])
  const getLayerSize = React.useCallback(() => {
    const rect = getLayerRect()
    if (rect && Number.isFinite(rect.width) && rect.width > 0 && Number.isFinite(rect.height) && rect.height > 0) {
      return { width: rect.width, height: rect.height }
    }
    if (typeof window !== 'undefined') return { width: window.innerWidth, height: window.innerHeight }
    return TIMELINE_BOTTOM_PANEL_FALLBACK_SIZE
  }, [getLayerRect])
  const resolveLayerRelativePosition = React.useCallback((rect: DOMRect) => {
    const layerRect = getLayerRect()
    return {
      top: rect.top - (layerRect?.top || 0),
      left: rect.left - (layerRect?.left || 0),
    }
  }, [getLayerRect])

  const clampPosition = React.useCallback((next: TimelineBottomPanelPosition) => {
    if (typeof window === 'undefined' && !layerRef.current) return next
    return clampOverlayTopLeftToViewport({
      pos: next,
      size: getPanelSize(),
      viewport: getLayerSize(),
      visiblePx: TIMELINE_BOTTOM_PANEL_VISIBLE_PX,
    })
  }, [getLayerSize, getPanelSize])

  const getDefaultUnpinnedPosition = React.useCallback(() => {
    if (typeof window === 'undefined' && !layerRef.current) return { top: 0, left: 0 }
    const { width, height } = getPanelSize()
    const layerSize = getLayerSize()
    return clampPosition({
      top: layerSize.height - height - TIMELINE_BOTTOM_PANEL_VISIBLE_PX,
      left: (layerSize.width - width) / 2,
    })
  }, [clampPosition, getLayerSize, getPanelSize])

  React.useEffect(() => {
    if (pinned) return
    setPosition(current => {
      const next = clampPosition(current || getDefaultUnpinnedPosition())
      if (current && current.top === next.top && current.left === next.left) return current
      return next
    })
  }, [clampPosition, getDefaultUnpinnedPosition, pinned])

  const handlePinToggle = React.useCallback(() => {
    if (pinned) {
      const rect = panelRef.current?.getBoundingClientRect()
      setPosition(clampPosition(rect ? resolveLayerRelativePosition(rect) : getDefaultUnpinnedPosition()))
      setPinned(false)
      return
    }
    setPinned(true)
  }, [clampPosition, getDefaultUnpinnedPosition, pinned, resolveLayerRelativePosition])
  const handleMinimize = React.useCallback(() => setMinimized(true), [])
  const handleRestore = React.useCallback(() => setMinimized(false), [])
  const documentVersionGraphRequested = bottomSurfaceCollapsed !== true && bottomSurfaceTab === 'documentVersionGraph'
  const mermaidGitGraphRequested = bottomSurfaceCollapsed !== true && bottomSurfaceTab === 'gitGraph'
  const mermaidGanttRequested = bottomSurfaceCollapsed !== true && bottomSurfaceTab === 'gantt'
  const bottomSurfaceDiagramRequested = documentVersionGraphRequested || mermaidGitGraphRequested || mermaidGanttRequested
  const showTimelineView = React.useCallback(() => {
    setView('timeline')
    if (bottomSurfaceDiagramRequested) setBottomSurfaceCollapsed(true)
  }, [bottomSurfaceDiagramRequested, setBottomSurfaceCollapsed])
  const showDocumentVersionGraphView = React.useCallback(() => {
    setView('documentVersionGraph')
    setBottomSurfaceTab('documentVersionGraph')
    setBottomSurfaceCollapsed(false)
  }, [setBottomSurfaceCollapsed, setBottomSurfaceTab])
  const showGitGraphView = React.useCallback(() => {
    setView('gitGraph')
    setBottomSurfaceTab('gitGraph')
    setBottomSurfaceCollapsed(false)
  }, [setBottomSurfaceCollapsed, setBottomSurfaceTab])
  const showGanttView = React.useCallback(() => {
    setView('gantt')
    setBottomSurfaceTab('gantt')
    setBottomSurfaceCollapsed(false)
  }, [setBottomSurfaceCollapsed, setBottomSurfaceTab])
  const handleClose = React.useCallback(() => {
    if (bottomSurfaceDiagramRequested) {
      setBottomSurfaceCollapsed(true)
      return
    }
    setTimelineEnabled(false)
  }, [bottomSurfaceDiagramRequested, setBottomSurfaceCollapsed, setTimelineEnabled])

  const handleHeaderPointerDown = React.useCallback((event: React.PointerEvent<HTMLElement>) => {
    event.stopPropagation()
    if (pinned) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const target = event.target
    if (target instanceof Element && target.closest(UI_SELECTORS.draggablePanelIgnorePointerDown)) return
    const rect = panelRef.current?.getBoundingClientRect()
    if (!rect) return
    const relativePosition = resolveLayerRelativePosition(rect)
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startTop: relativePosition.top,
      startLeft: relativePosition.left,
    }
    const scheduler = dragSchedulerRef.current
    startPointerDrag({
      ev: event.nativeEvent,
      cursor: 'grabbing',
      onMove: moveEvent => {
        const state = dragStateRef.current
        if (!state) return
        scheduler.schedule(clampPosition({
          top: state.startTop + moveEvent.clientY - state.startY,
          left: state.startLeft + moveEvent.clientX - state.startX,
        }))
      },
      onEnd: () => {
        dragStateRef.current = null
        scheduler.flush()
      },
      onCancel: () => {
        dragStateRef.current = null
        scheduler.cancel()
      },
    })
  }, [clampPosition, pinned, resolveLayerRelativePosition])

  const panelHeightStyle = minimized
    ? { height: 'var(--kg-toolbar-compact-surface-height)' }
    : view === 'documentVersionGraph' || view === 'gitGraph' || view === 'gantt'
      ? { maxHeight: 'min(44vh, 24rem)' }
      : { maxHeight: 'min(32vh, 12rem)' }
  const panelPosition = position || getDefaultUnpinnedPosition()
  const layerStyle = React.useMemo(() => ({ left: workspaceLayerInsetLeft }), [workspaceLayerInsetLeft])
  const panelStyle = pinned
    ? {
        position: 'absolute' as const,
        ...panelHeightStyle,
      }
    : {
        position: 'absolute' as const,
        top: panelPosition.top,
        left: panelPosition.left,
        ...panelHeightStyle,
      }

  return (
    <section
      ref={rootLayerRef}
      className="absolute inset-0 z-[230] pointer-events-none"
      aria-label="Timeline bottom panel root"
      data-kg-strybldr-bottom-timeline-root="canvas-viewport"
    >
      <section
        ref={layerRef}
        className="absolute inset-y-0 right-0 pointer-events-none"
        style={layerStyle}
        aria-label="Timeline bottom panel layer"
        data-kg-strybldr-bottom-timeline-layer="canvas-viewport"
      >
        <FloatingPanel
          ref={panelRef}
          as="aside"
          ariaLabel="Strybldr Timeline"
          ariaExpanded={!minimized}
          className={cn(
            'pointer-events-auto ModalContainer flex min-h-0 flex-col overflow-hidden p-0',
            UI_RESPONSIVE_CANVAS_BOTTOM_PANEL_CLASSNAME,
            pinned && 'kg-canvas-bottom-panel--pinned',
            UI_THEME_TOKENS.panel.bg,
            UI_THEME_TOKENS.text.primary,
          )}
          style={panelStyle}
          data-kg-canvas-pointer-ignore="true"
          data-kg-canvas-wheel-ignore="true"
          data-kg-strybldr-bottom-timeline-panel="1"
          data-kg-strybldr-bottom-timeline-minimized={minimized ? 'true' : 'false'}
        >
          <header
            className={cn('flex select-none items-center justify-between gap-2', !pinned && 'cursor-move')}
            style={{
              minHeight: 'var(--kg-control-height, 28px)',
              paddingBlock: 'var(--kg-toolbar-compact-pad-y)',
              paddingInline: 'var(--kg-toolbar-compact-pad-x)',
            }}
            onPointerDown={handleHeaderPointerDown}
          >
            <section className="flex min-w-0 items-center gap-1">
              <span className="min-w-0 truncate text-xs font-semibold">Timeline</span>
              <IconButton
                className={cn(
                  'App-toolbar__btn',
                  view === 'timeline'
                    ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}`
                    : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`,
                )}
                title="Timeline"
                showTooltip
                aria-pressed={view === 'timeline'}
                onClick={showTimelineView}
                data-kg-strybldr-bottom-timeline-timeline-toggle="1"
              >
                <History className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
              </IconButton>
              <IconButton
                className={cn(
                  'App-toolbar__btn',
                  view === 'documentVersionGraph'
                    ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}`
                    : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`,
                )}
                title="Version Graph"
                showTooltip
                aria-pressed={view === 'documentVersionGraph'}
                onClick={showDocumentVersionGraphView}
                data-kg-strybldr-bottom-timeline-document-version-graph-toggle="1"
              >
                <FileDiff className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
              </IconButton>
              <IconButton
                className={cn(
                  'App-toolbar__btn',
                  view === 'gitGraph'
                    ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}`
                    : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`,
                )}
                title="GitGraph"
                showTooltip
                aria-pressed={view === 'gitGraph'}
                onClick={showGitGraphView}
                data-kg-strybldr-bottom-timeline-gitgraph-toggle="1"
              >
                <GitGraph className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
              </IconButton>
              <IconButton
                className={cn(
                  'App-toolbar__btn',
                  view === 'gantt'
                    ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}`
                    : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`,
                )}
                title="Gantt"
                showTooltip
                aria-pressed={view === 'gantt'}
                onClick={showGanttView}
                data-kg-strybldr-bottom-timeline-gantt-toggle="1"
              >
                <ChartGantt className={iconSizeClass} strokeWidth={uiIconStrokeWidth} aria-hidden="true" />
              </IconButton>
            </section>
            <HeaderActions
              onPinToggle={handlePinToggle}
              pinned={pinned}
              onMinimize={!minimized ? handleMinimize : undefined}
              onRestore={minimized ? handleRestore : undefined}
              onClose={handleClose}
            />
          </header>
          {!minimized ? (
            <section className="min-h-0 flex-1 px-2 pb-2" aria-label="Timeline bottom panel body">
              {view === 'documentVersionGraph' ? (
                <React.Suspense fallback={null}>
                  <DocumentVersionGitGraphPanelLazy
                    activePath={markdownDocumentName}
                    compact
                    emptyLabel="No document versions for the current document."
                    fallbackToLatest
                    themeMode={resolvedThemeMode}
                  />
                </React.Suspense>
              ) : view === 'gitGraph' ? (
                <React.Suspense fallback={null}>
                  <GitGraphBottomPanelViewLazy compact />
                </React.Suspense>
              ) : view === 'gantt' ? (
                <React.Suspense fallback={null}>
                  <GanttBottomPanelViewLazy compact />
                </React.Suspense>
              ) : (
                <StrybldrTimelinePanel active={active} />
              )}
            </section>
          ) : null}
        </FloatingPanel>
      </section>
    </section>
  )
}
