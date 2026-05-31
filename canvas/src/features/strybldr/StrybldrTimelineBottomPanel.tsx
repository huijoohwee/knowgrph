import React from 'react'
import { FloatingPanel } from '@/components/ui/FloatingPanel'
import HeaderActions from '@/features/panels/ui/HeaderActions'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_SELECTORS } from '@/lib/config'
import { createRafValueScheduler } from '@/lib/react/rafValueScheduler'
import { clampOverlayTopLeftToViewport } from '@/lib/ui/overlayClamp'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { cn } from '@/lib/utils'
import { startPointerDrag } from 'grph-shared/dom/pointerDrag'
import { StrybldrTimelinePanel } from './StrybldrTimelinePanel'

type TimelineBottomPanelPosition = {
  top: number
  left: number
}

const TIMELINE_BOTTOM_PANEL_VISIBLE_PX = 32
const TIMELINE_BOTTOM_PANEL_FALLBACK_SIZE = { width: 560, height: 128 } as const

export function StrybldrTimelineBottomPanel({ active = true }: { active?: boolean }) {
  const panelRef = React.useRef<HTMLElement | null>(null)
  const dragStateRef = React.useRef<{
    startX: number
    startY: number
    startTop: number
    startLeft: number
  } | null>(null)
  const [pinned, setPinned] = React.useState(true)
  const [minimized, setMinimized] = React.useState(false)
  const [position, setPosition] = React.useState<TimelineBottomPanelPosition | null>(null)
  const setTimelineEnabled = useGraphStore(s => s.setTimelineEnabled)
  const dragSchedulerRef = React.useRef(createRafValueScheduler((next: TimelineBottomPanelPosition) => setPosition(next)))

  React.useEffect(() => {
    dragSchedulerRef.current = createRafValueScheduler((next: TimelineBottomPanelPosition) => setPosition(next))
  }, [])

  const getPanelSize = React.useCallback(() => {
    const rect = panelRef.current?.getBoundingClientRect()
    const width = rect && Number.isFinite(rect.width) && rect.width > 0 ? rect.width : TIMELINE_BOTTOM_PANEL_FALLBACK_SIZE.width
    const height = rect && Number.isFinite(rect.height) && rect.height > 0 ? rect.height : TIMELINE_BOTTOM_PANEL_FALLBACK_SIZE.height
    return { width, height }
  }, [])

  const clampPosition = React.useCallback((next: TimelineBottomPanelPosition) => {
    if (typeof window === 'undefined') return next
    return clampOverlayTopLeftToViewport({
      pos: next,
      size: getPanelSize(),
      viewport: { width: window.innerWidth, height: window.innerHeight },
      visiblePx: TIMELINE_BOTTOM_PANEL_VISIBLE_PX,
    })
  }, [getPanelSize])

  const getDefaultUnpinnedPosition = React.useCallback(() => {
    if (typeof window === 'undefined') return { top: 0, left: 0 }
    const { width, height } = getPanelSize()
    return clampPosition({
      top: window.innerHeight - height - TIMELINE_BOTTOM_PANEL_VISIBLE_PX,
      left: (window.innerWidth - width) / 2,
    })
  }, [clampPosition, getPanelSize])

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
      setPosition(clampPosition(rect ? { top: rect.top, left: rect.left } : getDefaultUnpinnedPosition()))
      setPinned(false)
      return
    }
    setPinned(true)
  }, [clampPosition, getDefaultUnpinnedPosition, pinned])
  const handleMinimize = React.useCallback(() => setMinimized(true), [])
  const handleRestore = React.useCallback(() => setMinimized(false), [])

  const handleHeaderPointerDown = React.useCallback((event: React.PointerEvent<HTMLElement>) => {
    event.stopPropagation()
    if (pinned) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const target = event.target
    if (target instanceof Element && target.closest(UI_SELECTORS.draggablePanelIgnorePointerDown)) return
    const rect = panelRef.current?.getBoundingClientRect()
    if (!rect) return
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startTop: rect.top,
      startLeft: rect.left,
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
  }, [clampPosition, pinned])

  const panelHeightStyle = minimized
    ? { height: 'var(--kg-toolbar-compact-surface-height)' }
    : { maxHeight: 'min(32vh, 12rem)' }
  const panelPosition = position || getDefaultUnpinnedPosition()
  const panelStyle = pinned
    ? {
        position: 'fixed' as const,
        left: '50%',
        bottom: 'calc(var(--kg-safe-bottom) + var(--kg-canvas-viewport-edge-gap))',
        transform: 'translateX(-50%)',
        width: 'min(calc(100vw - 1.5rem - var(--kg-safe-left) - var(--kg-safe-right)), 42rem)',
        ...panelHeightStyle,
      }
    : {
        position: 'fixed' as const,
        top: panelPosition.top,
        left: panelPosition.left,
        width: 'min(calc(100vw - 1.5rem - var(--kg-safe-left) - var(--kg-safe-right)), 42rem)',
        ...panelHeightStyle,
      }

  return (
    <section className="fixed inset-0 z-[230] pointer-events-none" aria-label="Timeline bottom panel layer">
      <FloatingPanel
        ref={panelRef}
        as="aside"
        ariaLabel="Strybldr Timeline"
        ariaExpanded={!minimized}
        className={cn(
          'pointer-events-auto ModalContainer flex min-h-0 flex-col overflow-hidden p-0',
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
          <div className="min-w-0 truncate text-xs font-semibold">Timeline</div>
          <HeaderActions
            onPinToggle={handlePinToggle}
            pinned={pinned}
            onMinimize={!minimized ? handleMinimize : undefined}
            onRestore={minimized ? handleRestore : undefined}
            onClose={() => setTimelineEnabled(false)}
          />
        </header>
        {!minimized ? (
          <section className="min-h-0 flex-1 px-2 pb-2" aria-label="Timeline bottom panel body">
            <StrybldrTimelinePanel active={active} />
          </section>
        ) : null}
      </FloatingPanel>
    </section>
  )
}
