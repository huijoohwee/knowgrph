import React from 'react'
import {
  TIMELINE_TRANSPORT_GESTURE_ZOOM_DELTA,
  TIMELINE_TRANSPORT_WHEEL_LINE_DELTA,
  TIMELINE_TRANSPORT_ZOOM_LEVELS,
  clampTimelineTransportValue,
  resolveTimelineTransportGestureZoomStepCount,
  resolveTimelineTransportNextZoomIndex,
  resolveTimelineTransportPlayheadPercent,
  resolveTimelineTransportPlayheadScrollLeft,
  resolveTimelineTransportZoom,
} from '@/components/timeline/timelineTransport'

type TimelineZoomScrollAnchor = {
  contentRatio: number
  scroller: HTMLElement
  viewportX: number
}

function resolveTimelineTransportRailScroller(contentElement: HTMLElement | null): HTMLElement | null {
  return contentElement?.closest('[data-kg-video-sequence-ruler-scroll="1"]') as HTMLElement | null
    || contentElement?.closest('[data-kg-gantt-timeline-ruler="bottomPanel"]') as HTMLElement | null
}

export function useGanttTimelineTransportView(args: {
  disabled: boolean
  maxMinutes: number
  positionMinutes: number
  rulerViewportRef: React.RefObject<HTMLElement | null>
}) {
  const [timelineZoomIndex, setTimelineZoomIndex] = React.useState(0)
  const wheelZoomClientXRef = React.useRef(0)
  const wheelZoomDeltaRef = React.useRef(0)
  const wheelZoomFrameRef = React.useRef<number | null>(null)
  const gestureScaleRef = React.useRef(1)
  const zoomScrollAnchorRef = React.useRef<TimelineZoomScrollAnchor | null>(null)

  const timelineZoom = React.useMemo(
    () => resolveTimelineTransportZoom(timelineZoomIndex),
    [timelineZoomIndex],
  )
  const playheadPercent = React.useMemo(
    () => resolveTimelineTransportPlayheadPercent(args.positionMinutes, args.maxMinutes),
    [args.maxMinutes, args.positionMinutes],
  )
  const canZoomOut = timelineZoomIndex > 0
  const canZoomIn = timelineZoomIndex < TIMELINE_TRANSPORT_ZOOM_LEVELS.length - 1
  const canFitTimeline = timelineZoomIndex !== 0
  const timelineZoomPercent = TIMELINE_TRANSPORT_ZOOM_LEVELS.length > 1
    ? (timelineZoomIndex / (TIMELINE_TRANSPORT_ZOOM_LEVELS.length - 1)) * 100
    : 0

  React.useLayoutEffect(() => {
    const anchor = zoomScrollAnchorRef.current
    if (!anchor) return
    zoomScrollAnchorRef.current = null
    const contentElement = args.rulerViewportRef.current
    if (!contentElement || !anchor.scroller.isConnected) return
    const nextScrollLeft = anchor.contentRatio * contentElement.scrollWidth - anchor.viewportX
    anchor.scroller.scrollLeft = clampTimelineTransportValue(
      nextScrollLeft,
      0,
      Math.max(0, contentElement.scrollWidth - anchor.scroller.clientWidth),
    )
  }, [args.rulerViewportRef, timelineZoom])

  const captureZoomScrollAnchor = React.useCallback((clientX: number) => {
    const contentElement = args.rulerViewportRef.current
    const scroller = resolveTimelineTransportRailScroller(contentElement)
    if (!contentElement || !scroller) return
    const scrollerRect = scroller.getBoundingClientRect()
    const viewportX = clampTimelineTransportValue(clientX - scrollerRect.left, 0, scroller.clientWidth)
    const contentWidth = Math.max(1, contentElement.scrollWidth)
    zoomScrollAnchorRef.current = {
      contentRatio: clampTimelineTransportValue((scroller.scrollLeft + viewportX) / contentWidth, 0, 1),
      scroller,
      viewportX,
    }
  }, [args.rulerViewportRef])

  const applyZoomStep = React.useCallback((direction: -1 | 1, clientX?: number, stepCount = 1) => {
    const currentIndex = timelineZoomIndex
    const nextIndex = resolveTimelineTransportNextZoomIndex(currentIndex, direction, stepCount)
    const canZoom = nextIndex !== currentIndex
    if (args.disabled || !canZoom) return
    if (typeof clientX === 'number') captureZoomScrollAnchor(clientX)
    setTimelineZoomIndex(value => resolveTimelineTransportNextZoomIndex(value, direction, stepCount))
  }, [args.disabled, captureZoomScrollAnchor, timelineZoomIndex])

  const flushWheelZoom = React.useCallback(() => {
    wheelZoomFrameRef.current = null
    const delta = wheelZoomDeltaRef.current
    if (Math.abs(delta) < TIMELINE_TRANSPORT_GESTURE_ZOOM_DELTA) return
    const direction = delta < 0 ? 1 : -1
    const stepCount = resolveTimelineTransportGestureZoomStepCount(delta)
    wheelZoomDeltaRef.current = 0
    applyZoomStep(direction, wheelZoomClientXRef.current, stepCount)
  }, [applyZoomStep])

  React.useEffect(() => () => {
    if (wheelZoomFrameRef.current != null && typeof window !== 'undefined') window.cancelAnimationFrame(wheelZoomFrameRef.current)
  }, [])

  React.useEffect(() => {
    const contentElement = args.rulerViewportRef.current
    const scroller = resolveTimelineTransportRailScroller(contentElement)
    if (!contentElement || !scroller) return
    const resolveClientX = (event: Event) => {
      const clientX = Number((event as { clientX?: number }).clientX)
      if (Number.isFinite(clientX)) return clientX
      const rect = scroller.getBoundingClientRect()
      return rect.left + rect.width / 2
    }
    const handleGestureStart = ((event: Event) => {
      if (args.disabled) return
      event.preventDefault()
      gestureScaleRef.current = 1
      captureZoomScrollAnchor(resolveClientX(event))
    }) as EventListener
    const handleGestureChange = ((event: Event) => {
      if (args.disabled) return
      const scale = Number((event as { scale?: number }).scale)
      if (!Number.isFinite(scale) || scale <= 0) return
      const delta = scale - gestureScaleRef.current
      if (Math.abs(delta) < 0.08) return
      event.preventDefault()
      const direction = delta > 0 ? 1 : -1
      gestureScaleRef.current = scale
      applyZoomStep(direction, resolveClientX(event))
    }) as EventListener
    scroller.addEventListener('gesturestart', handleGestureStart, { passive: false })
    scroller.addEventListener('gesturechange', handleGestureChange, { passive: false })
    return () => {
      scroller.removeEventListener('gesturestart', handleGestureStart)
      scroller.removeEventListener('gesturechange', handleGestureChange)
    }
  }, [applyZoomStep, args.disabled, args.rulerViewportRef, captureZoomScrollAnchor])

  const centerTimelinePlayhead = React.useCallback(() => {
    const contentElement = args.rulerViewportRef.current
    const scroller = resolveTimelineTransportRailScroller(contentElement)
    if (!contentElement || !scroller || args.maxMinutes <= 0) return
    scroller.scrollLeft = resolveTimelineTransportPlayheadScrollLeft({
      contentWidth: contentElement.scrollWidth,
      max: args.maxMinutes,
      position: args.positionMinutes,
      viewportWidth: scroller.clientWidth,
    })
  }, [args.maxMinutes, args.positionMinutes, args.rulerViewportRef])

  const handleZoomOut = React.useCallback(() => {
    applyZoomStep(-1)
  }, [applyZoomStep])

  const handleZoomIn = React.useCallback(() => {
    applyZoomStep(1)
  }, [applyZoomStep])

  const handleFitTimeline = React.useCallback(() => {
    setTimelineZoomIndex(0)
    const scroller = resolveTimelineTransportRailScroller(args.rulerViewportRef.current)
    if (scroller) scroller.scrollLeft = 0
  }, [args.rulerViewportRef])

  const handleRulerWheelZoom = React.useCallback((event: React.WheelEvent<HTMLElement>) => {
    if (args.disabled || (!event.ctrlKey && !event.metaKey)) return
    event.preventDefault()
    event.stopPropagation()
    const deltaScale = event.deltaMode === 1
      ? TIMELINE_TRANSPORT_WHEEL_LINE_DELTA
      : event.deltaMode === 2
        ? Math.max(1, event.currentTarget.clientHeight)
        : 1
    wheelZoomClientXRef.current = event.clientX
    wheelZoomDeltaRef.current += event.deltaY * deltaScale
    if (wheelZoomFrameRef.current != null) return
    if (typeof window === 'undefined') {
      flushWheelZoom()
      return
    }
    wheelZoomFrameRef.current = window.requestAnimationFrame(flushWheelZoom)
  }, [args.disabled, flushWheelZoom])

  return {
    canFitTimeline,
    canZoomIn,
    canZoomOut,
    centerTimelinePlayhead,
    handleFitTimeline,
    handleRulerWheelZoom,
    handleZoomIn,
    handleZoomOut,
    playheadPercent,
    timelineZoom,
    timelineZoomPercent,
  }
}
